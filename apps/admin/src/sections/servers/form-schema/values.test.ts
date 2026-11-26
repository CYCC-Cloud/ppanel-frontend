import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { protocols } from "./constants";
import { getProtocolDefaultConfig } from "./defaults";
import { buildFormSchema } from "./schemas";
import { getListenerFormValues, preserveUneditableProtocols } from "./values";

const formSchema = buildFormSchema(
  ((_key: string, fallback: string) => fallback) as TFunction
);

const nowhere = {
  type: "nowhere",
  enable: true,
  port: 443,
  ratio: 1,
  version: 3,
  security: "tls",
  alpn: ["nw3"],
  network: "mix",
  obfs: "none",
  sni: "nw.example",
  cert_mode: "self",
};
function parse(values: Record<string, unknown>[]) {
  return formSchema.parse({
    name: "Renamed server",
    address: "node.example",
    protocols: values,
  });
}

describe("NW3 server form", () => {
  it("offers Nowhere with fixed NW3 defaults and no legacy transport knobs", () => {
    expect(protocols).toContain("nowhere");
    const defaults = getProtocolDefaultConfig("nowhere");
    expect(defaults).toMatchObject({
      type: "nowhere",
      version: 3,
      security: "tls",
      alpn: ["nw3"],
      network: "mix",
      obfs: "morph",
      cert_mode: "self",
    });
    for (const key of [
      "transport",
      "multiplex",
      "server_key",
      "fingerprint",
      "ech_enable",
      "obfs_password",
    ])
      expect(defaults).not.toHaveProperty(key);
    expect(() => parse(getListenerFormValues())).not.toThrow();
  });

  it.each([
    "morph",
    "none",
  ])("retains Nowhere and its %s setting across editing and submission", (obfs) => {
    const initial = [{ ...nowhere, obfs }];
    const values = getListenerFormValues(initial);
    const edited = parse(values).protocols.filter(
      (protocol) => protocol.enable
    );
    expect(preserveUneditableProtocols(edited, initial)).toEqual([
      expect.objectContaining({ ...nowhere, obfs }),
    ]);
    expect(edited[0]).not.toHaveProperty("plugin");
    expect(edited[0]).not.toHaveProperty("multiplex");
  });

  it.each([
    0, 1,
  ])("upgrades stored version %s to NW3 while preserving disabled Morph", (version) => {
    const values = getListenerFormValues([
      { ...nowhere, version, alpn: ["now/1"], network: "both", obfs: " NONE " },
    ]);
    expect(
      parse(values).protocols.find((p) => p.type === "nowhere")
    ).toMatchObject({
      ...nowhere,
      version: 3,
      alpn: ["nw3"],
      network: "mix",
      obfs: "none",
    });
  });

  it.each([
    { version: 1 },
    { alpn: ["now/1"] },
    { alpn: ["nw3", "h2"] },
    { security: "reality" },
    { network: "ws" },
    { obfs: "http" },
    { allow_insecure: true },
    { cert_mode: "none" },
    { sni: " " },
    { port: 0 },
  ])("rejects incompatible enabled settings: %j", (change) => {
    expect(() => parse([{ ...nowhere, ...change }])).toThrow();
  });

  it("preserves uneditable backend protocols while allowing explicit removal of an editable protocol", () => {
    const opaque = {
      type: "future-protocol",
      enable: true,
      port: 8443,
      settings: { custom: "keep" },
    };
    const initial = [nowhere, opaque];
    const edited = parse(getListenerFormValues(initial)).protocols.filter(
      (p) => p.enable
    );
    const payload = preserveUneditableProtocols(edited, initial);
    expect(payload).toHaveLength(2);
    expect(payload[1]).toEqual(opaque);
    expect(preserveUneditableProtocols([], initial)).toEqual([opaque]);
    expect(initial).toEqual([nowhere, opaque]);
  });

  it("does not duplicate Hysteria aliases or rewrite REALITY transports", () => {
    const initial = [
      { type: "hysteria", enable: false },
      {
        type: "vless",
        enable: false,
        security: "reality",
        transport: "xhttp",
        path: "/existing",
      },
    ];
    const values = getListenerFormValues(initial);
    expect(values.find((p) => p.type === "vless")).toMatchObject({
      security: "reality",
      transport: "xhttp",
      path: "/existing",
      cert_mode: "none",
    });
    expect(preserveUneditableProtocols([], initial)).toEqual([]);
  });

  it("keeps every stored listener of one type instead of collapsing them", () => {
    const initial = [
      { type: "trojan", enable: true, port: 443, listener_key: "a" },
      { type: "trojan", enable: false, port: 8443, listener_key: "b" },
    ];
    const values = getListenerFormValues(initial);

    expect(values.map((value) => value.listener_key)).toEqual(["a", "b"]);
    expect(new Set(values.map((value) => value.draft_id)).size).toBe(2);
  });

  it("falls back to the protocol default when a stored transport is undefined", () => {
    const values = getListenerFormValues([
      { type: "trojan", enable: true, port: 443, transport: undefined },
    ]);

    expect(values[0]?.transport).toBe("tcp");
    expect(() => parse(values)).not.toThrow();
  });
});
