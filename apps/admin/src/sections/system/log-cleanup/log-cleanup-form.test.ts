// @vitest-environment jsdom

import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { buildLogCleanupSchema } from "./log-cleanup-form";

// Interpolates like i18next so failures can assert the localized message.
const t = ((
  key: string,
  _fallback: string,
  options?: Record<string, unknown>
) =>
  options
    ? `${key}:${options.min}-${options.max}`
    : key) as unknown as TFunction;

const logCleanupSchema = buildLogCleanupSchema(t);

const valid = {
  auto_clear: true,
  clear_days: 7,
  traffic_hourly_retention_days: 90,
  traffic_daily_retention_days: 0,
  audit_log_retention_days: 365,
};

describe("log cleanup schema", () => {
  it("accepts the backend defaults", () => {
    expect(logCleanupSchema.parse(valid)).toEqual(valid);
  });

  it("accepts configured daily and audit retention", () => {
    const result = logCleanupSchema.safeParse({
      ...valid,
      traffic_daily_retention_days: 30,
      audit_log_retention_days: 3650,
    });

    expect(result.success).toBe(true);
  });

  it("rejects retention values outside the backend ranges", () => {
    expect(
      logCleanupSchema.safeParse({ ...valid, clear_days: 6 }).success
    ).toBe(false);
    expect(
      logCleanupSchema.safeParse({
        ...valid,
        traffic_hourly_retention_days: 3651,
      }).success
    ).toBe(false);
    expect(
      logCleanupSchema.safeParse({
        ...valid,
        traffic_daily_retention_days: 10,
      }).success
    ).toBe(false);
    expect(
      logCleanupSchema.safeParse({
        ...valid,
        audit_log_retention_days: 29,
      }).success
    ).toBe(false);
  });

  it("reports range failures through the admin translations", () => {
    const daysIssue = logCleanupSchema.safeParse({
      ...valid,
      clear_days: 6,
    }).error?.issues[0];
    expect(daysIssue?.message).toBe("logCleanup.validation.daysRange:7-3650");

    const retentionIssue = logCleanupSchema.safeParse({
      ...valid,
      audit_log_retention_days: 29,
    }).error?.issues[0];
    expect(retentionIssue?.message).toBe(
      "logCleanup.validation.retentionRange:30-3650"
    );
  });
});
