import { describe, expect, it } from "vitest";
import { compareStatus, isAtOrAfter } from "../src/domain/status";

const order = ["Backlog", "Ready", "On Hold", "In Progress", "In review", "QA", "Completed"];

describe("status ordering", () => {
  it("compares ordering", () => {
    expect(compareStatus(order, "Ready", "In Progress")).toBe(-1);
    expect(compareStatus(order, "QA", "In review")).toBe(1);
    expect(compareStatus(order, "Backlog", "Backlog")).toBe(0);
  });

  it("checks at or after", () => {
    expect(isAtOrAfter(order, "QA", "In review")).toBe(true);
    expect(isAtOrAfter(order, "In Progress", "In review")).toBe(false);
  });
});
