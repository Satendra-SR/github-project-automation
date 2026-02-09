import { describe, expect, it } from "vitest";
import { parseTargets } from "../src/github/targets";

const owner = "coloredcow-admin";
const repo = "sneha-lms";

describe("parseTargets", () => {
  it("parses exact Targets line", () => {
    const body = "Targets: coloredcow-admin/sneha-lms#123";
    const result = parseTargets(body, owner, repo);
    expect(result.target?.number).toBe(123);
  });

  it("parses whitespace variants", () => {
    const body = "Targets:coloredcow-admin/sneha-lms #123";
    const result = parseTargets(body, owner, repo);
    expect(result.target?.number).toBe(123);
  });

  it("rejects missing Targets", () => {
    const body = "No targets here";
    const result = parseTargets(body, owner, repo);
    expect(result.target).toBeUndefined();
  });

  it("rejects mismatched repo", () => {
    const body = "Targets: other-org/other-repo#123";
    const result = parseTargets(body, owner, repo);
    expect(result.target).toBeUndefined();
  });
});
