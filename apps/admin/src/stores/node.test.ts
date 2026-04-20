import { beforeEach, describe, expect, it } from "vitest";
import { useNodeStore } from "./node";

describe("node store", () => {
  beforeEach(() => {
    useNodeStore.setState({
      nodes: [],
      tags: [],
      loading: false,
      loadingTags: false,
      loaded: true,
      loadedTags: true,
    });
  });

  it("checks listener usage by listener key instead of protocol type", () => {
    useNodeStore.setState({
      nodes: [
        {
          id: 1,
          name: "node-a",
          tags: [],
          port: 443,
          address: "server.example.com",
          server_id: 10,
          protocol: "vless",
          listener_name: "Listener 2",
          enabled: true,
          created_at: 1,
          updated_at: 1,
          listener_key: "listener-2",
        } as API.Node,
      ],
    });

    const store = useNodeStore.getState();

    expect(store.isListenerUsedInNodes(10, "listener-1")).toBe(false);
    expect(store.isListenerUsedInNodes(10, "listener-2")).toBe(true);
  });
});
