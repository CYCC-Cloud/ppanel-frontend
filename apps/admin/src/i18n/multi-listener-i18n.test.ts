import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readLocale(namespace: string, locale: "en-US" | "zh-CN") {
  const filePath = new URL(
    `../../public/assets/locales/${locale}/${namespace}.json`,
    import.meta.url
  );

  return JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
}

function getNestedValue(
  object: Record<string, unknown>,
  keyPath: string
): unknown {
  let current: unknown = object;

  for (const key of keyPath.split(".")) {
    if (!current || typeof current !== "object") {
      return;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

describe("multi-listener locale coverage", () => {
  const serverKeys = [
    "protocol_configurations",
    "protocol_configurations_desc",
    "listener_type",
    "add_listener",
    "listener_name",
    "listener_name_placeholder",
    "remove_listener",
  ];

  const nodeKeys = [
    "listener",
    "select_listener",
    "unavailable",
    "errors.nameRequired",
    "errors.serverRequired",
    "errors.listenerRequired",
    "errors.protocolRequired",
    "errors.serverAddrRequired",
    "errors.portRange",
  ];

  for (const locale of ["en-US", "zh-CN"] as const) {
    it(`includes required server locale keys in ${locale}`, () => {
      const messages = readLocale("servers", locale);

      for (const key of serverKeys) {
        expect(
          getNestedValue(messages, key),
          `${locale} servers missing ${key}`
        ).toBeDefined();
      }
    });

    it(`includes required node locale keys in ${locale}`, () => {
      const messages = readLocale("nodes", locale);

      for (const key of nodeKeys) {
        expect(
          getNestedValue(messages, key),
          `${locale} nodes missing ${key}`
        ).toBeDefined();
      }
    });
  }
});
