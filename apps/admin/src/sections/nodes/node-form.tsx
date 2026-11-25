"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@workspace/ui/components/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet";
import { Combobox } from "@workspace/ui/composed/combobox";
import { EnhancedInput } from "@workspace/ui/composed/enhanced-input";
import TagInput from "@workspace/ui/composed/tag-input";
import type { TFunction } from "i18next";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { useNode } from "@/stores/node";
import { useServer } from "@/stores/server";

const buildSchema = (t: TFunction) =>
  z.object({
    name: z
      .string()
      .trim()
      .min(1, t("errors.nameRequired", "Please enter a name")),
    server_id: z
      .number({ message: t("errors.serverRequired", "Please select a server") })
      .int()
      .gt(0, t("errors.serverRequired", "Please select a server"))
      .optional(),
    listener_key: z
      .string()
      .min(1, t("errors.listenerRequired", "Please select a listener")),
    protocol: z
      .string()
      .min(1, t("errors.protocolRequired", "Please select a protocol")),
    address: z
      .string()
      .trim()
      .min(1, t("errors.serverAddrRequired", "Please enter an entry address")),
    port: z
      .number({
        message: t("errors.portRange", "Port must be between 1 and 65535"),
      })
      .int()
      .min(1, t("errors.portRange", "Port must be between 1 and 65535"))
      .max(65_535, t("errors.portRange", "Port must be between 1 and 65535")),
    tags: z.array(z.string()),
  });

export type NodeFormValues = z.infer<ReturnType<typeof buildSchema>>;

const emptyValues: NodeFormValues = {
  name: "",
  server_id: undefined,
  listener_key: "",
  protocol: "",
  address: "",
  port: 0,
  tags: [],
};

function normalizeValues(v?: Partial<NodeFormValues>): Partial<NodeFormValues> {
  if (!v) return {};
  return { ...v, tags: Array.isArray(v.tags) ? v.tags : [] };
}

export default function NodeForm(props: {
  trigger: string;
  title: string;
  loading?: boolean;
  initialValues?: Partial<NodeFormValues>;
  onSubmit: (values: NodeFormValues) => Promise<boolean> | boolean;
}) {
  const { trigger, title, loading, initialValues, onSubmit } = props;
  const { t } = useTranslation("nodes");
  const Scheme = useMemo(() => buildSchema(t), [t]);
  const [open, setOpen] = useState(false);

  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(
    new Set()
  );

  const removeAutoFilledField = (fieldName: string) => {
    setAutoFilledFields((prev) => {
      const newSet = new Set(prev);
      newSet.delete(fieldName);
      return newSet;
    });
  };

  const form = useForm<NodeFormValues, any, NodeFormValues>({
    resolver: zodResolver(Scheme),
    defaultValues: {
      ...emptyValues,
      ...normalizeValues(initialValues),
    },
  });

  const serverId = form.watch("server_id");

  const { servers, getAvailableListeners, getListenerByKey } = useServer();
  const { tags } = useNode();

  const existingTags: string[] = tags || [];

  const availableListeners = getAvailableListeners(serverId);

  useEffect(() => {
    if (initialValues) {
      form.reset({
        ...emptyValues,
        ...normalizeValues(initialValues),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues]);

  // The server cache loads asynchronously, so a stored binding cannot be
  // resolved during the reset above. Once the listeners arrive, refresh the
  // protocol and port from the bound listener. A key that resolves to nothing
  // is left alone: the listener may have been disabled or removed, and
  // silently rebinding the node would move its traffic to another listener.
  const boundListenerKey = form.watch("listener_key");
  useEffect(() => {
    const listener = getListenerByKey(serverId, boundListenerKey);
    if (!listener) return;
    form.setValue("protocol", listener.protocol, { shouldDirty: false });
    if (listener.port) {
      form.setValue("port", listener.port, { shouldDirty: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, boundListenerKey, availableListeners.length]);

  function handleServerChange(nextId?: number | null) {
    const id = nextId ?? undefined;
    const previousServerId = form.getValues("server_id");
    form.setValue("server_id", id);

    if (id === previousServerId) return;

    if (!id) {
      applyListenerSelection("");
      setAutoFilledFields(new Set());
      return;
    }

    const selectedServer = servers.find((s) => s.id === id);
    if (!selectedServer) return;

    const currentValues = form.getValues();
    const fieldsToFill: string[] = [];

    if (!currentValues.name || autoFilledFields.has("name")) {
      form.setValue("name", selectedServer.name as string, {
        shouldDirty: false,
      });
      fieldsToFill.push("name");
    }

    if (!currentValues.address || autoFilledFields.has("address")) {
      form.setValue("address", selectedServer.address as string, {
        shouldDirty: false,
      });
      fieldsToFill.push("address");
    }

    const [firstListener] = getAvailableListeners(id);

    if (firstListener) {
      applyListenerSelection(firstListener.listener_key, id);
      fieldsToFill.push("listener_key", "protocol", "port");
    } else {
      applyListenerSelection("", id);
    }

    setAutoFilledFields(new Set(fieldsToFill));
  }

  const handleManualFieldChange = (
    fieldName: keyof NodeFormValues,
    value: any
  ) => {
    form.setValue(fieldName, value);
    removeAutoFilledField(fieldName);
  };

  // A listener is the only unambiguous selector: a server may run several
  // listeners of one protocol type, so the protocol and port are always taken
  // from the chosen listener rather than typed independently.
  function applyListenerSelection(
    nextListenerKey?: string | null,
    nextServerId?: number
  ) {
    const listenerKey = nextListenerKey || "";
    form.setValue("listener_key", listenerKey);

    const listener = getListenerByKey(nextServerId ?? serverId, listenerKey);
    if (!listener) {
      form.setValue("protocol", "");
      form.setValue("port", 0);
      return;
    }

    form.setValue("protocol", listener.protocol, { shouldDirty: false });
    form.setValue("port", listener.port || 0, { shouldDirty: false });
  }

  async function handleSubmit(values: NodeFormValues) {
    const result = await onSubmit(values);
    if (result) {
      setOpen(false);
      setAutoFilledFields(new Set());
    }
  }

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button
          onClick={() => {
            form.reset({
              ...emptyValues,
              ...normalizeValues(initialValues),
            });
            setAutoFilledFields(new Set());
          }}
        >
          {trigger}
        </Button>
      </SheetTrigger>

      <SheetContent className="w-[560px] max-w-full">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100dvh-48px-36px-36px-env(safe-area-inset-top))] px-6 pt-4">
          <Form {...form}>
            <form className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="server_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("server", "Server")}</FormLabel>
                    <FormControl>
                      <Combobox<number, false>
                        onChange={(v) => handleServerChange(v)}
                        options={servers.map((s) => ({
                          value: s.id,
                          label: `${s.name} (${(s.address as any) || ""})`,
                        }))}
                        placeholder={t("select_server", "Select server…")}
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="listener_key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("listener", "Listener")}</FormLabel>
                    <FormControl>
                      <Combobox<string, false>
                        onChange={(v) => applyListenerSelection(v)}
                        options={availableListeners.map((listener) => ({
                          value: listener.listener_key,
                          label: `${listener.listener_name} (${listener.protocol}${
                            listener.port ? `:${listener.port}` : ""
                          })`,
                        }))}
                        placeholder={t("select_listener", "Select listener…")}
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="protocol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("protocol", "Protocol")}</FormLabel>
                    <FormControl>
                      {/* The protocol always comes from the bound listener, so
                          it is shown rather than chosen. */}
                      <EnhancedInput
                        {...field}
                        disabled
                        placeholder={t("unavailable", "—")}
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("name", "Name")}</FormLabel>
                    <FormControl>
                      <EnhancedInput
                        {...field}
                        onValueChange={(v) =>
                          handleManualFieldChange("name", v as string)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("address", "Address")}</FormLabel>
                    <FormControl>
                      <EnhancedInput
                        {...field}
                        onValueChange={(v) =>
                          handleManualFieldChange("address", v as string)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="port"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("port", "Port")}</FormLabel>
                    <FormControl>
                      <EnhancedInput
                        {...field}
                        max={65_535}
                        min={1}
                        onValueChange={(v) =>
                          handleManualFieldChange("port", Number(v))
                        }
                        placeholder="1-65535"
                        type="number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("tags", "Tags")}</FormLabel>
                    <FormControl>
                      <TagInput
                        onChange={(v) => form.setValue(field.name, v)}
                        options={existingTags}
                        placeholder={t(
                          "tags_placeholder",
                          "Use Enter or comma (,) to add multiple tags"
                        )}
                        value={field.value || []}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        "tags_description",
                        "Permission grouping tag (incl. plan binding and delivery policies)."
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </ScrollArea>

        <SheetFooter className="flex-row justify-end gap-2 pt-3">
          <Button
            disabled={loading}
            onClick={() => setOpen(false)}
            variant="outline"
          >
            {t("cancel", "Cancel")}
          </Button>
          <Button
            disabled={loading}
            onClick={form.handleSubmit(handleSubmit, (errors) => {
              const key = Object.keys(errors)[0] as keyof typeof errors;
              if (key) toast.error(String(errors[key]?.message));
              return false;
            })}
          >
            {t("confirm", "Confirm")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
