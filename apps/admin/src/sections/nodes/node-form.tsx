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

type NodeFormPayload = Partial<API.Node> & { listener_key?: string };

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

export default function NodeForm(props: {
  trigger: string;
  title: string;
  loading?: boolean;
  initialValues?: Partial<NodeFormValues>;
  onSubmit: (values: NodeFormValues) => Promise<boolean> | boolean;
}) {
  const { trigger, title, loading, initialValues, onSubmit } = props;
  const { t } = useTranslation("nodes");
  const schema = useMemo(() => buildSchema(t), [t]);
  const [open, setOpen] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(
    new Set()
  );

  const form = useForm<NodeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...emptyValues,
      ...initialValues,
      listener_key:
        (initialValues as NodeFormPayload | undefined)?.listener_key || "",
    },
  });

  const serverId = form.watch("server_id");

  const { servers, getAvailableListeners } = useServer();
  const { tags } = useNode();

  const existingTags: string[] = tags || [];
  const availableListeners = getAvailableListeners(serverId);

  const removeAutoFilledField = (fieldName: string) => {
    setAutoFilledFields((prev) => {
      const next = new Set(prev);
      next.delete(fieldName);
      return next;
    });
  };

  useEffect(() => {
    if (!initialValues) return;

    const payload = initialValues as Partial<NodeFormValues> & NodeFormPayload;

    form.reset({
      ...emptyValues,
      ...initialValues,
      listener_key: payload.listener_key || "",
    });
    setAutoFilledFields(new Set());
  }, [form, initialValues]);

  useEffect(() => {
    if (!serverId) return;

    const currentListenerKey = form.getValues("listener_key");
    const selectedListener = availableListeners.find(
      (listener) => listener.listener_key === currentListenerKey
    );

    if (selectedListener) {
      return;
    }

    if (currentListenerKey) {
      return;
    }

    const matchingListener = availableListeners.find(
      (listener) =>
        listener.protocol === form.getValues("protocol") &&
        listener.port === form.getValues("port")
    );

    if (matchingListener) {
      form.setValue("listener_key", matchingListener.listener_key, {
        shouldDirty: false,
      });
      form.setValue("protocol", matchingListener.protocol, {
        shouldDirty: false,
      });
      form.setValue("port", matchingListener.port, {
        shouldDirty: false,
      });
      return;
    }

    if (availableListeners[0]) {
      applyListenerSelection(availableListeners[0].listener_key);
    }
  }, [availableListeners, form, serverId]);

  function applyListenerSelection(nextListenerKey?: string | null) {
    const listenerKey = nextListenerKey || "";
    form.setValue("listener_key", listenerKey);

    if (!listenerKey) {
      form.setValue("protocol", "");
      form.setValue("port", 0);
      return;
    }

    const selectedListener = availableListeners.find(
      (listener) => listener.listener_key === listenerKey
    );

    if (!selectedListener) return;

    form.setValue("protocol", selectedListener.protocol, {
      shouldDirty: false,
    });
    form.setValue("port", selectedListener.port, {
      shouldDirty: false,
    });
  }

  function handleServerChange(nextId?: number | null) {
    const id = nextId ?? undefined;
    form.setValue("server_id", id);

    if (!id) {
      form.setValue("listener_key", "");
      form.setValue("protocol", "");
      form.setValue("port", 0);
      setAutoFilledFields(new Set());
      return;
    }

    const selectedServer = servers.find((server) => server.id === id);

    if (!selectedServer) return;

    const currentValues = form.getValues();
    const nextAutoFilled = new Set<string>();

    if (!currentValues.name || autoFilledFields.has("name")) {
      form.setValue("name", String(selectedServer.name || ""), {
        shouldDirty: false,
      });
      nextAutoFilled.add("name");
    }

    if (!currentValues.address || autoFilledFields.has("address")) {
      form.setValue("address", String(selectedServer.address || ""), {
        shouldDirty: false,
      });
      nextAutoFilled.add("address");
    }

    setAutoFilledFields(nextAutoFilled);

    const firstListener = getAvailableListeners(id)[0];

    if (firstListener) {
      form.setValue("listener_key", firstListener.listener_key, {
        shouldDirty: false,
      });
      form.setValue("protocol", firstListener.protocol, {
        shouldDirty: false,
      });
      form.setValue("port", firstListener.port, {
        shouldDirty: false,
      });
      return;
    }

    form.setValue("listener_key", "");
    form.setValue("protocol", "");
    form.setValue("port", 0);
  }

  const handleManualFieldChange = (
    fieldName: keyof NodeFormValues,
    value: string | number | string[] | undefined
  ) => {
    form.setValue(fieldName, value as never);
    removeAutoFilledField(fieldName);
  };

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
              ...initialValues,
              listener_key:
                (initialValues as NodeFormPayload | undefined)?.listener_key ||
                "",
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
                        onChange={(value) => handleServerChange(value)}
                        options={servers.map((server) => ({
                          value: server.id,
                          label: `${server.name} (${String(server.address || "")})`,
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
                        onChange={(value) => applyListenerSelection(value)}
                        options={[
                          ...availableListeners.map((listener) => ({
                            value: listener.listener_key,
                            label: `${listener.listener_name} | ${listener.protocol}:${listener.port}`,
                          })),
                          ...(!field.value ||
                          availableListeners.some(
                            (listener) => listener.listener_key === field.value
                          )
                            ? []
                            : [
                                {
                                  value: field.value,
                                  label: `${field.value} (${t("unavailable", "Unavailable")})`,
                                },
                              ]),
                        ]}
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
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("name", "Name")}</FormLabel>
                    <FormControl>
                      <EnhancedInput
                        {...field}
                        onValueChange={(value) =>
                          handleManualFieldChange("name", value as string)
                        }
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
                      <EnhancedInput {...field} disabled />
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
                        onValueChange={(value) =>
                          handleManualFieldChange("address", value as string)
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
                        disabled
                        max={65_535}
                        min={1}
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
                        onChange={(value) => form.setValue(field.name, value)}
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
