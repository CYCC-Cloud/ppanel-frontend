import { beforeEach, describe, expect, it } from "vitest";
import { useNodeStore } from "./node";

const node = (overrides: Partial<API.Node>) =>
  ({
    id: 1,
    server_id: 1,
    name: "node",
    address: "node.example.com",
    port: 443,
    protocol: "trojan",
    listener_key: "a",
    enabled: true,
    sort: 0,
    tags: [],
    created_at: 0,
    updated_at: 0,
    ...overrides,
  }) as API.Node;

describe("listener occupancy", () => {
  beforeEach(() => {
    useNodeStore.setState({ nodes: [], loaded: true, loading: false });
  });

  it("reports only the listener a node is actually bound to", () => {
    useNodeStore.setState({
      nodes: [node({ id: 1, listener_key: "a" })],
    });

    const store = useNodeStore.getState();
    expect(store.isListenerUsedInNodes(1, "a")).toBe(true);
    expect(store.isListenerUsedInNodes(1, "b")).toBe(false);
  });

  it("does not match a node on another server", () => {
    useNodeStore.setState({
      nodes: [node({ id: 1, server_id: 2, listener_key: "a" })],
    });

    expect(useNodeStore.getState().isListenerUsedInNodes(1, "a")).toBe(false);
  });

  it("treats a missing key as unused", () => {
    useNodeStore.setState({ nodes: [node({ listener_key: "" })] });

    const store = useNodeStore.getState();
    expect(store.isListenerUsedInNodes(1, "")).toBe(false);
    expect(store.isListenerUsedInNodes(1, undefined)).toBe(false);
  });
});
