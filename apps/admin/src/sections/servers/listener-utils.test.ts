import { describe, expect, it } from "vitest";
import {
  appendListenerDraft,
  preserveExistingListenerKeys,
} from "./listener-utils";

describe("listener-utils", () => {
  it("appends a disabled listener draft without a key", () => {
    expect(appendListenerDraft("vless")).toMatchObject({
      type: "vless",
      enable: false,
      port: null,
    });
    expect(appendListenerDraft("vless")).not.toHaveProperty("listener_key");
  });

  it("preserves existing listener keys while keeping appended listeners keyless", () => {
    const existing = [
      {
        listener_key: "listener-1",
        listener_name: "Main",
        type: "vless",
        port: 443,
        enable: true,
      },
      {
        listener_key: "listener-2",
        listener_name: null,
        type: "vmess",
        port: 8443,
        enable: false,
      },
    ];

    const next = [
      {
        listener_key: "listener-1",
        listener_name: "Renamed",
        type: "vless",
        port: 443,
        enable: true,
      },
      {
        listener_key: "listener-2",
        listener_name: null,
        type: "vmess",
        port: 8443,
        enable: false,
      },
      appendListenerDraft("vless"),
    ];

    const result = preserveExistingListenerKeys(existing, next);

    expect(result[0]).toEqual({
      listener_key: "listener-1",
      listener_name: "Renamed",
      type: "vless",
      port: 443,
      enable: true,
    });
    expect(result[1]).toEqual({
      listener_key: "listener-2",
      listener_name: null,
      type: "vmess",
      port: 8443,
      enable: false,
    });
    expect(result[2]).toMatchObject({
      type: "vless",
      enable: false,
      port: null,
    });
    expect(result[2]).not.toHaveProperty("listener_key");
  });

  it("keeps remaining listener keys stable after deleting an earlier listener", () => {
    const existing = [
      {
        listener_key: "listener-1",
        listener_name: "First",
        type: "vless",
        port: 443,
        enable: true,
      },
      {
        listener_key: "listener-2",
        listener_name: "Second",
        type: "vless",
        port: 8443,
        enable: true,
      },
    ];

    const next = [
      {
        listener_key: "listener-2",
        listener_name: "Second",
        type: "vless",
        port: 8443,
        enable: true,
      },
    ];

    const result = preserveExistingListenerKeys(existing, next);

    expect(result).toEqual([
      {
        listener_key: "listener-2",
        listener_name: "Second",
        type: "vless",
        port: 8443,
        enable: true,
      },
    ]);
  });

  it("restores a missing listener key when one existing listener matches exactly", () => {
    const existing = [
      {
        listener_key: "listener-1",
        listener_name: "Main",
        type: "vless",
        port: 443,
        enable: true,
      },
    ];

    const next = [
      {
        listener_name: "Main",
        type: "vless",
        port: 443,
        enable: true,
      },
    ];

    const result = preserveExistingListenerKeys(existing, next);

    expect(result).toEqual([
      {
        listener_key: "listener-1",
        listener_name: "Main",
        type: "vless",
        port: 443,
        enable: true,
      },
    ]);
  });
});
