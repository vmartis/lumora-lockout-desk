import { describe, expect, it } from "vitest";
import { appUpdate, compareVersions } from "../src/appVersion.js";

describe("compareVersions", () => {
  it.each([
    ["4.2.0", "4.3.1", -1],
    ["4.3.1", "4.3.1", 0],
    ["4.10.0", "4.9.9", 1],
    [" 4.3 ", "4.3.0", 0],
  ])("%s vs %s = %i", (a, b, r) => expect(Math.sign(compareVersions(a, b))).toBe(r));
});

describe("appUpdate", () => {
  it("flags an app older than the latest version", () => {
    expect(appUpdate("4.2.0", "4.3.1")).toEqual({ current: "4.2.0", latest: "4.3.1" });
  });
  it("does not flag the latest or a newer version", () => {
    expect(appUpdate("4.3.1", "4.3.1")).toBeNull();
    expect(appUpdate("4.4.0", "4.3.1")).toBeNull();
  });
  it("does not flag an unreadable version", () => {
    expect(appUpdate("", "4.3.1")).toBeNull();
    expect(appUpdate("beta", "4.3.1")).toBeNull();
    expect(appUpdate(undefined as unknown as string, "4.3.1")).toBeNull();
    expect(appUpdate(null as unknown as string, "4.3.1")).toBeNull();
  });
});
