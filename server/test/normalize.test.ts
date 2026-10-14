import { describe, expect, it } from "vitest";
import { normalizeAttempt, normalizeCountry, normalizeDeviceId, parseTimestamp, sortNewestFirst } from "../src/normalize.js";
import type { Attempt } from "../src/verdict.js";

describe("parseTimestamp", () => {
  it("keeps ISO UTC timestamps as they are", () => {
    expect(parseTimestamp("2026-10-13T18:55:01Z")).toBe("2026-10-13T18:55:01Z");
  });

  it("drops fractional seconds from ISO timestamps", () => {
    expect(parseTimestamp("2026-10-13T18:55:01.250Z")).toBe("2026-10-13T18:55:01Z");
  });

  it("reads day.month.year CEST as UTC+2", () => {
    expect(parseTimestamp("12.10.2026 08:03:17 CEST")).toBe("2026-10-12T06:03:17Z");
  });

  it("reads day.month.year CET as UTC+1", () => {
    expect(parseTimestamp("05.01.2026 00:30:00 CET")).toBe("2026-01-04T23:30:00Z");
  });

  it("rolls over the day, month and year when converting to UTC", () => {
    expect(parseTimestamp("01.01.2027 01:00:00 CEST")).toBe("2026-12-31T23:00:00Z");
  });

  it("ignores surrounding spaces", () => {
    expect(parseTimestamp("  12.10.2026 08:03:17 CEST ")).toBe("2026-10-12T06:03:17Z");
  });

  it.each([
    [""],
    ["yesterday"],
    ["2026-13-01T00:00:00Z"],
    ["2026-02-30T00:00:00Z"],
    ["2026-10-13T24:00:00Z"],
    ["31.02.2026 08:00:00 CEST"],
    ["12.10.2026 08:03:17 PST"],
    ["12.10.2026 08:03:17"],
    ["2026-10-13 18:55:01"],
  ])("returns null for %j", (raw) => {
    expect(parseTimestamp(raw)).toBeNull();
  });
});

describe("normalize country and device", () => {
  it("trims and upper-cases countries", () => {
    expect(normalizeCountry(" sk ")).toBe("SK");
  });

  it("trims device ids", () => {
    expect(normalizeDeviceId(" dev-1 ")).toBe("dev-1");
  });
});

const attempt = (id: string, timestamp: string): Attempt => ({
  attempt_id: id, timestamp, customer_id: "LB-000001", device_id: "dev-1", device_model: "iPhone 13",
  app_version: "4.2.0", ip_country: "SK", liveness_score: "0.9", match_score: "", result: "FAIL", fail_reason: "POOR_LIGHT",
});

describe("normalizeAttempt", () => {
  it("normalises time, country and device", () => {
    const a = normalizeAttempt({ ...attempt("A1", "12.10.2026 08:03:17 CEST"), ip_country: " cz", device_id: "dev-2 " });
    expect(a).toMatchObject({ timestamp: "2026-10-12T06:03:17Z", ip_country: "CZ", device_id: "dev-2" });
  });

  it("keeps an unparseable time as the trimmed raw text", () => {
    expect(normalizeAttempt(attempt("A1", " garbage ")).timestamp).toBe("garbage");
  });
});

describe("sortNewestFirst", () => {
  it("sorts by real time across formats, unparseable times last", () => {
    const sorted = sortNewestFirst([
      attempt("iso-old", "2026-10-12T05:00:00Z"),
      attempt("bad", "not a date"),
      attempt("cest", "12.10.2026 08:03:17 CEST"), // 06:03:17Z
      attempt("iso-new", "2026-10-13T18:55:01Z"),
      attempt("cest-early", "12.10.2026 06:30:00 CEST"), // 04:30:00Z
    ]);
    expect(sorted.map((a) => a.attempt_id)).toEqual(["iso-new", "cest", "iso-old", "cest-early", "bad"]);
  });
});
