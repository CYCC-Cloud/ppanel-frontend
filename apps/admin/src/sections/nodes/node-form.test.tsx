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
import { useServerStore } from "@/stores/server";
import NodeForm from "./node-form";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
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

vi.mock("@workspace/ui/composed/combobox", () => ({
  Combobox: ({
    onChange,
    options,
    placeholder,
    value,
  }: {
    onChange: (value: unknown) => void;
    options: Array<{ value: unknown; label: string }>;
    placeholder?: string;
    value?: unknown;
  }) => (
    <select
      aria-label={placeholder}
      onChange={(event) => {
        const selected = options.find(
          (option) => String(option.value) === event.target.value
        );
        onChange(selected?.value);
      }}
      value={value === undefined || value === "" ? "" : String(value)}
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

vi.mock("@workspace/ui/composed/tag-input", () => ({
  default: () => <div>tags</div>,
}));

const trojan = (listenerKey: string, name: string, port: number) =>
  ({
    type: "trojan",
    port,
    enable: true,
    listener_key: listenerKey,
    listener_name: name,
  }) as API.Protocol;

beforeEach(() => {
  useServerStore.setState({
    servers: [
      {
        id: 1,
        name: "Singapore 01",
        address: "203.0.113.10",
        protocols: [
          trojan("listener-a", "Primary", 443),
          trojan("listener-b", "Fallback", 8443),
        ],
      } as unknown as API.Server,
      {
        id: 2,
        name: "Tokyo 01",
        address: "203.0.113.20",
        protocols: [
          {
            type: "vmess",
            port: 2096,
            enable: true,
            listener_key: "listener-c",
            listener_name: "Tokyo",
          } as API.Protocol,
        ],
      } as unknown as API.Server,
    ],
    loaded: true,
    loading: false,
  });
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
});

describe("node listener binding", () => {
  it("submits the selected listener with its protocol and port", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);

    render(
      <NodeForm onSubmit={onSubmit} title="Create node" trigger="Create" />
    );
    fireEvent.click(screen.getByText("Create"));

    fireEvent.change(screen.getByLabelText("Select server…"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Select listener…"), {
      target: { value: "listener-b" },
    });

    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      server_id: 1,
      listener_key: "listener-b",
      protocol: "trojan",
      port: 8443,
    });
  });

  it("binds a freshly selected server to its first listener", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);

    render(
      <NodeForm onSubmit={onSubmit} title="Create node" trigger="Create" />
    );
    fireEvent.click(screen.getByText("Create"));

    fireEvent.change(screen.getByLabelText("Select server…"), {
      target: { value: "1" },
    });

    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      listener_key: "listener-a",
      protocol: "trojan",
      port: 443,
    });
  });

  it("rebinds an edited node when its server changes", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);

    render(
      <NodeForm
        initialValues={{
          name: "edge-1",
          server_id: 1,
          listener_key: "listener-a",
          protocol: "trojan",
          address: "edge.example.com",
          port: 443,
          tags: [],
        }}
        onSubmit={onSubmit}
        title="Save node"
        trigger="Edit"
      />
    );
    fireEvent.click(screen.getByText("Edit"));

    fireEvent.change(screen.getByLabelText("Select server…"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      server_id: 2,
      listener_key: "listener-c",
      protocol: "vmess",
      port: 2096,
    });
  });

  it("preserves a stored key that no longer resolves", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);

    render(
      <NodeForm
        initialValues={{
          name: "edge-1",
          server_id: 1,
          listener_key: "listener-gone",
          protocol: "vmess",
          address: "edge.example.com",
          port: 2096,
          tags: [],
        }}
        onSubmit={onSubmit}
        title="Save node"
        trigger="Edit"
      />
    );
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      listener_key: "listener-gone",
      protocol: "vmess",
      port: 2096,
    });
  });

  it("refuses to submit a node with no listener", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);

    render(
      <NodeForm onSubmit={onSubmit} title="Create node" trigger="Create" />
    );
    fireEvent.click(screen.getByText("Create"));

    fireEvent.change(screen.getByLabelText("Select server…"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() =>
      expect(screen.getByText("Please select a listener")).toBeTruthy()
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
