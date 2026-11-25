// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNodeStore } from "@/stores/node";
import ServerForm from "./server-form";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (
      _key: string,
      fallback: string,
      values?: Record<string, string | number>
    ) =>
      Object.entries(values || {}).reduce(
        (text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)),
        fallback
      ),
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@workspace/ui/components/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@workspace/ui/composed/icon", () => ({
  Icon: ({ icon }: { icon: string }) => <span data-icon={icon} />,
}));

vi.mock("@workspace/ui/composed/combobox", () => ({
  Combobox: ({
    onChange,
    options,
    placeholder,
  }: {
    onChange: (value: unknown) => void;
    options: Array<{ value: unknown; label: string }>;
    placeholder?: string;
  }) => (
    <select
      aria-label={placeholder}
      onChange={(event) => onChange(event.target.value || undefined)}
      value=""
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={String(option.value)} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

const trojan = (overrides: Partial<API.Protocol>) =>
  ({
    type: "trojan",
    enable: true,
    security: "tls",
    cert_mode: "self",
    sni: "node.example.com",
    ratio: 1,
    ...overrides,
  }) as API.Protocol;

const twoListenerServer = {
  id: 7,
  name: "Singapore 01",
  address: "203.0.113.10",
  country: "SG",
  city: "Singapore",
  protocols: [
    trojan({
      listener_key: "listener-a",
      listener_name: "Primary",
      port: 443,
      ratio: 1,
    }),
    trojan({
      listener_key: "listener-b",
      listener_name: "Fallback",
      port: 8443,
      ratio: 3,
    }),
  ],
} as unknown as Partial<API.Server>;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect = vi.fn();
      observe = vi.fn();
      unobserve = vi.fn();
    }
  );
  useNodeStore.setState({
    nodes: [],
    tags: [],
    loaded: true,
    loadedTags: true,
    loading: false,
    loadingTags: false,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const openForm = (props: Partial<Parameters<typeof ServerForm>[0]> = {}) => {
  const onSubmit = vi.fn().mockResolvedValue(true);
  render(
    <ServerForm
      onSubmit={onSubmit}
      title="Edit server"
      trigger="Open"
      {...props}
    />
  );
  fireEvent.click(screen.getByText("Open"));
  return onSubmit;
};

describe("server editor protocol preservation", () => {
  it("keeps NW3 and an uneditable protocol when submitting a server edit", async () => {
    const submit = vi.fn().mockResolvedValue(true);
    const opaque = {
      type: "future-protocol",
      enable: true,
      port: 8443,
      settings: { custom: "preserved" },
    };
    render(
      <ServerForm
        initialValues={
          {
            id: 7,
            name: "Node",
            address: "node.example",
            protocols: [
              {
                type: "nowhere",
                enable: true,
                port: 443,
                version: 3,
                security: "tls",
                alpn: ["nw3"],
                network: "mix",
                obfs: "none",
                sni: "nw.example",
                cert_mode: "self",
              },
              opaque,
            ],
          } as unknown as API.Server
        }
        onSubmit={submit}
        title="Edit server"
        trigger="Edit server"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit server" }));
    await screen.findByText(/will be preserved when saving: future-protocol/);
    fireEvent.click(screen.getByRole("button", { name: /nowhere/i }));
    expect(await screen.findByText(/NW3 · TLS 1.3/)).toBeTruthy();
    expect(screen.queryByText("Allow Insecure")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    const payload = submit.mock.calls[0]?.[0];
    expect(payload.protocols).toEqual([
      expect.objectContaining({
        type: "nowhere",
        version: 3,
        security: "tls",
        alpn: ["nw3"],
        network: "mix",
        obfs: "none",
      }),
      opaque,
    ]);
  });

  it("creates an NW3 server with valid defaults after the required fields are filled", async () => {
    const submit = vi.fn().mockResolvedValue(true);
    render(
      <ServerForm onSubmit={submit} title="Add server" trigger="Add server" />
    );
    fireEvent.click(screen.getByRole("button", { name: "Add server" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "NW3 node" },
    });
    fireEvent.change(screen.getByLabelText("Address"), {
      target: { value: "nw.example" },
    });
    fireEvent.change(screen.getByLabelText("Add listener"), {
      target: { value: "nowhere" },
    });
    await screen.findByText(/NW3 · TLS 1.3/);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByText("Nowhere requires a TLS server name.");
    expect(submit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/^Port/), {
      target: { value: "443" },
    });
    fireEvent.change(screen.getByLabelText(/^SNI/), {
      target: { value: "nw.example" },
    });
    expect(
      screen.getByRole("combobox", { name: /^Network/ }).textContent
    ).toContain("TLS + QUIC");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(submit.mock.calls[0]?.[0].protocols).toEqual([
      expect.objectContaining({
        type: "nowhere",
        version: 3,
        security: "tls",
        alpn: ["nw3"],
        network: "mix",
        obfs: "morph",
        sni: "nw.example",
        port: 443,
      }),
    ]);
  });
});

describe("server listener list", () => {
  it("shows every listener of a repeated protocol type", () => {
    openForm({ initialValues: twoListenerServer });

    expect(screen.getByText("Primary")).toBeTruthy();
    expect(screen.getByText("Fallback")).toBeTruthy();
    expect(screen.getByText("443")).toBeTruthy();
    expect(screen.getByText("8443")).toBeTruthy();
  });

  it("submits both listeners with their original keys untouched", async () => {
    const onSubmit = openForm({ initialValues: twoListenerServer });

    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const submitted = onSubmit.mock.calls[0]?.[0] as Partial<API.Server>;
    expect(submitted.protocols).toHaveLength(2);
    expect(submitted.protocols?.map((p) => p.listener_key)).toEqual([
      "listener-a",
      "listener-b",
    ]);
    expect(submitted.protocols?.map((p) => p.port)).toEqual([443, 8443]);
    expect(submitted.protocols?.map((p) => p.ratio)).toEqual([1, 3]);
  });

  it("keeps a disabled listener instead of deleting it", async () => {
    const onSubmit = openForm({
      initialValues: {
        ...twoListenerServer,
        protocols: [
          trojan({ listener_key: "listener-a", port: 443 }),
          trojan({ listener_key: "listener-b", port: 8443, enable: false }),
        ],
      } as unknown as Partial<API.Server>,
    });

    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const submitted = onSubmit.mock.calls[0]?.[0] as Partial<API.Server>;
    expect(submitted.protocols?.map((p) => p.listener_key)).toEqual([
      "listener-a",
      "listener-b",
    ]);
    expect(submitted.protocols?.at(1)?.enable).toBe(false);
  });

  it("adds an enabled listener with no key so the backend mints one", async () => {
    const onSubmit = openForm({ initialValues: twoListenerServer });

    fireEvent.change(screen.getByLabelText("Add listener"), {
      target: { value: "vmess" },
    });

    const ports = screen.getAllByRole("spinbutton", { name: /Port/ });
    fireEvent.change(ports.at(-1) as HTMLElement, {
      target: { value: "2096" },
    });

    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const submitted = onSubmit.mock.calls[0]?.[0] as Partial<API.Server>;
    expect(submitted.protocols).toHaveLength(3);
    expect(submitted.protocols?.at(2)).toMatchObject({
      type: "vmess",
      listener_key: "",
      enable: true,
      port: 2096,
    });
  });

  it("never submits the form-local draft identity", async () => {
    const onSubmit = openForm({ initialValues: twoListenerServer });

    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const submitted = onSubmit.mock.calls[0]?.[0] as Partial<API.Server>;
    for (const protocol of submitted.protocols || []) {
      expect(protocol).not.toHaveProperty("draft_id");
    }
  });

  it("starts a new server with no listeners", () => {
    openForm();

    expect(screen.queryByText("Primary")).toBeNull();
    expect(screen.queryAllByTitle("Remove listener")).toEqual([]);
  });

  it("blocks removing only the listener a node is bound to", () => {
    useNodeStore.setState({
      nodes: [
        {
          id: 1,
          server_id: 7,
          listener_key: "listener-a",
          protocol: "trojan",
        } as unknown as API.Node,
      ],
    });

    openForm({ initialValues: twoListenerServer });

    const removeButtons = screen.getAllByTitle("Remove listener");
    expect(removeButtons).toHaveLength(2);
    expect(removeButtons[0]?.hasAttribute("disabled")).toBe(true);
    expect(removeButtons[1]?.hasAttribute("disabled")).toBe(false);
  });

  it("removes a listener without disturbing its siblings' keys", async () => {
    const onSubmit = openForm({ initialValues: twoListenerServer });

    fireEvent.click(screen.getAllByTitle("Remove listener")[0] as HTMLElement);
    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const submitted = onSubmit.mock.calls[0]?.[0] as Partial<API.Server>;
    expect(submitted.protocols?.map((p) => p.listener_key)).toEqual([
      "listener-b",
    ]);
  });
});
