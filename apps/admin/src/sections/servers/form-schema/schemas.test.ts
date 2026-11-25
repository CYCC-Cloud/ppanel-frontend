import { describe, expect, it } from "vitest";
import { getProtocolDefaultConfig } from "./defaults";
import { formSchema } from "./schemas";

const validServer = {
  name: "Hysteria2 node",
  address: "node.example.com",
  protocols: [
    {
      type: "hysteria2",
      enable: true,
      port: 40_000,
      security: "tls",
      sni: "node.example.com",
      cert_mode: "self",
      allow_insecure: true,
      hop_ports: "40000-60000",
      hop_interval: 10,
      up_mbps: 300,
      down_mbps: 300,
      obfs: "none",
    },
  ],
};

describe("Hysteria2 protocol form schema", () => {
  it("keeps client-side TLS and port-hopping options", () => {
    const result = formSchema.parse(validServer);
    expect(result.protocols[0]).toMatchObject({
      allow_insecure: true,
      hop_ports: "40000-60000",
      hop_interval: 10,
    });
  });

  it("requires hop ports and hop interval to be configured together", () => {
    const result = formSchema.safeParse({
      ...validServer,
      protocols: [
        {
          ...validServer.protocols[0],
          hop_ports: "",
          hop_interval: 10,
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["protocols", 0, "hop_ports"] }),
        ])
      );
    }
  });

  it("rejects invalid Hysteria2 hop-port ranges", () => {
    const result = formSchema.safeParse({
      ...validServer,
      protocols: [
        {
          ...validServer.protocols[0],
          hop_ports: "40000-70000",
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["protocols", 0, "hop_ports"] }),
        ])
      );
    }
  });

  it("accepts comma-separated Hysteria2 ports and single ports", () => {
    const result = formSchema.safeParse({
      ...validServer,
      protocols: [
        {
          ...validServer.protocols[0],
          hop_ports: "40000, 40002-40005",
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});

describe("TLS protocol form schemas", () => {
  it.each([
    "shadowsocks",
    "vmess",
    "vless",
    "trojan",
    "hysteria2",
    "tuic",
    "anytls",
    "naive",
  ] as const)("keeps allow_insecure for %s", (type) => {
    const result = formSchema.parse({
      name: `${type} node`,
      address: "node.example.com",
      protocols: [{ type, allow_insecure: true }],
    });

    expect(result.protocols[0]).toMatchObject({
      type,
      allow_insecure: true,
    });
  });
});

describe("client fingerprint protocol fields", () => {
  it.each([
    "vmess",
    "vless",
    "trojan",
    "anytls",
  ] as const)("defaults %s to the Chrome fingerprint", (type) => {
    expect(getProtocolDefaultConfig(type)).toMatchObject({
      fingerprint: "chrome",
    });
  });

  it.each([
    "vmess",
    "vless",
    "trojan",
    "anytls",
  ] as const)("keeps the selected fingerprint for %s", (type) => {
    const result = formSchema.parse({
      name: `${type} node`,
      address: "node.example.com",
      protocols: [{ type, fingerprint: "firefox" }],
    });

    expect(result.protocols[0]).toMatchObject({
      type,
      fingerprint: "firefox",
    });
  });
});

describe("listener identity", () => {
  const listener = (overrides: Record<string, unknown>) => ({
    type: "trojan",
    enable: true,
    security: "tls",
    cert_mode: "self",
    sni: "node.example.com",
    listener_key: "",
    listener_name: null,
    port: 443,
    ratio: 1,
    ...overrides,
  });

  it("parses same-type listeners with independent keys", () => {
    const result = formSchema.parse({
      name: "gateway",
      address: "node.example.com",
      protocols: [
        listener({ listener_key: "a", listener_name: "Primary" }),
        listener({
          listener_key: "b",
          listener_name: "Fallback",
          port: 8443,
          ratio: 3,
        }),
      ],
    });

    expect(result.protocols.map((protocol) => protocol.listener_key)).toEqual([
      "a",
      "b",
    ]);
  });

  it("keeps a new listener key empty for backend minting", () => {
    const result = formSchema.parse({
      name: "gateway",
      address: "node.example.com",
      protocols: [listener({})],
    });

    expect(result.protocols[0]?.listener_key).toBe("");
  });

  it("accepts a disabled listener sharing an enabled listener's port", () => {
    const result = formSchema.safeParse({
      name: "gateway",
      address: "node.example.com",
      protocols: [
        listener({ listener_key: "a" }),
        listener({ listener_key: "b", enable: false }),
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects duplicate enabled ports on both offending paths", () => {
    const result = formSchema.safeParse({
      name: "gateway",
      address: "node.example.com",
      protocols: [
        listener({ listener_key: "a" }),
        listener({ listener_key: "b" }),
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["protocols", 0, "port"] }),
          expect.objectContaining({ path: ["protocols", 1, "port"] }),
        ])
      );
    }
  });
});
