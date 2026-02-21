import { describe, expect, it, vi } from "vitest";
import { addLabelIfMissing, removeLabelsIfPresent, PullRequestContext } from "../src/github/pr";

function createPrContext(overrides: Partial<PullRequestContext> = {}): PullRequestContext {
  return {
    owner: "coloredcow-admin",
    repo: "sneha",
    number: 10,
    url: "https://github.com/coloredcow-admin/sneha/pull/10",
    labels: ["Ready For Review"],
    ...overrides
  };
}

describe("PR label helpers", () => {
  it("removes matching labels when present", async () => {
    const removeLabel = vi.fn().mockResolvedValue({});
    const octokit = {
      rest: {
        issues: {
          removeLabel
        }
      }
    };

    const changed = await removeLabelsIfPresent(
      octokit,
      createPrContext(),
      ["Ready For Review", "status: ready for review"],
      false
    );

    expect(changed).toBe(true);
    expect(removeLabel).toHaveBeenCalledTimes(1);
    expect(removeLabel).toHaveBeenCalledWith({
      owner: "coloredcow-admin",
      repo: "sneha",
      issue_number: 10,
      name: "Ready For Review"
    });
  });

  it("does not remove labels in dry-run mode", async () => {
    const removeLabel = vi.fn();
    const octokit = {
      rest: {
        issues: {
          removeLabel
        }
      }
    };

    const changed = await removeLabelsIfPresent(
      octokit,
      createPrContext(),
      ["Ready For Review"],
      true
    );

    expect(changed).toBe(false);
    expect(removeLabel).not.toHaveBeenCalled();
  });

  it("adds reviewed label if missing based on alias set", async () => {
    const addLabels = vi.fn().mockResolvedValue({});
    const octokit = {
      rest: {
        issues: {
          addLabels
        }
      }
    };

    const changed = await addLabelIfMissing(
      octokit,
      createPrContext({ labels: ["ready for review"] }),
      "status : reviewed",
      false,
      ["status : reviewed", "Reviewed"]
    );

    expect(changed).toBe(true);
    expect(addLabels).toHaveBeenCalledWith({
      owner: "coloredcow-admin",
      repo: "sneha",
      issue_number: 10,
      labels: ["status : reviewed"]
    });
  });

  it("skips adding reviewed label when an accepted variant already exists", async () => {
    const addLabels = vi.fn();
    const octokit = {
      rest: {
        issues: {
          addLabels
        }
      }
    };

    const changed = await addLabelIfMissing(
      octokit,
      createPrContext({ labels: ["Reviewed"] }),
      "status : reviewed",
      false,
      ["status : reviewed", "Reviewed"]
    );

    expect(changed).toBe(false);
    expect(addLabels).not.toHaveBeenCalled();
  });
});
