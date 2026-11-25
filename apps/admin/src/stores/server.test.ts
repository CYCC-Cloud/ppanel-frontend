import { beforeEach, describe, expect, it } from "vitest";
import { useServerStore } from "./server";

const protocol = (overrides: Partial<API.Protocol>) =>
  ({
    type: "trojan",
    port: 443,
    enable: true,
    listener_key: "",
    listener_name: "",
    ...overrides,
  }) as API.Protocol;

const seed = (protocols: API.Protocol[]) => {
  useServerStore.setState({
    servers: [{ id: 1, name: "server", protocols } as API.Server],
    loaded: true,
    loading: false,
  });
};

describe("server listener selectors", () => {
  beforeEach(() => {
    useServerStore.setState({ servers: [], loaded: false, loading: false });
  });

  it("exposes every enabled listener, including same-type siblings", () => {
    seed([
      protocol({ listener_key: "a", listener_name: "Primary", port: 443 }),
      protocol({ listener_key: "b", listener_name: "Fallback", port: 8443 }),
    ]);

    expect(useServerStore.getState().getAvailableListeners(1)).toEqual([
      {
        listener_key: "a",
        listener_name: "Primary",
        protocol: "trojan",
        port: 443,
      },
      {
        listener_key: "b",
        listener_name: "Fallback",
        protocol: "trojan",
        port: 8443,
      },
    ]);
  });

  it("resolves each same-type listener by its own key", () => {
    seed([
      protocol({ listener_key: "a", port: 443 }),
      protocol({ listener_key: "b", port: 8443 }),
    ]);

    const store = useServerStore.getState();
    expect(store.getListenerByKey(1, "a")?.port).toBe(443);
    expect(store.getListenerByKey(1, "b")?.port).toBe(8443);
    expect(store.getListenerByKey(1, "missing")).toBeUndefined();
  });

  it("falls back to the protocol type when a listener has no label", () => {
    seed([protocol({ listener_key: "a", listener_name: "" })]);

    expect(useServerStore.getState().getListenerByKey(1, "a")).toMatchObject({
      listener_name: "trojan",
    });
  });

  it("omits disabled and keyless listeners", () => {
    seed([
      protocol({ listener_key: "a", port: 443, enable: false }),
      protocol({ listener_key: "", port: 8443 }),
    ]);

    expect(useServerStore.getState().getAvailableListeners(1)).toEqual([]);
  });

  it("returns nothing for an unknown server", () => {
    seed([protocol({ listener_key: "a" })]);

    const store = useServerStore.getState();
    expect(store.getAvailableListeners(2)).toEqual([]);
    expect(store.getAvailableListeners(undefined)).toEqual([]);
    expect(store.getListenerByKey(undefined, "a")).toBeUndefined();
  });
});
