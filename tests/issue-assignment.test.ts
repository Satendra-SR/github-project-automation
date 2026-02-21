import { describe, expect, it, vi } from "vitest";
import { assignIssueToUserIfMissing, IssueContext } from "../src/github/issue";

function createIssueContext(overrides: Partial<IssueContext> = {}): IssueContext {
  return {
    owner: "coloredcow-admin",
    repo: "sneha-lms",
    number: 123,
    nodeId: "MDU6SXNzdWUx",
    url: "https://github.com/coloredcow-admin/sneha-lms/issues/123",
    assignees: [],
    ...overrides
  };
}

describe("assignIssueToUserIfMissing", () => {
  it("skips assignment when PR author login is missing", async () => {
    const addAssignees = vi.fn();
    const octokit = {
      rest: {
        issues: {
          addAssignees
        }
      }
    };

    const changed = await assignIssueToUserIfMissing(octokit, createIssueContext(), undefined, false);

    expect(changed).toBe(false);
    expect(addAssignees).not.toHaveBeenCalled();
  });

  it("skips assignment when assignee is already present", async () => {
    const addAssignees = vi.fn();
    const octokit = {
      rest: {
        issues: {
          addAssignees
        }
      }
    };

    const changed = await assignIssueToUserIfMissing(
      octokit,
      createIssueContext({ assignees: ["Satendra-SR"] }),
      "satendra-sr",
      false
    );

    expect(changed).toBe(false);
    expect(addAssignees).not.toHaveBeenCalled();
  });

  it("adds assignee when missing", async () => {
    const addAssignees = vi.fn().mockResolvedValue({});
    const octokit = {
      rest: {
        issues: {
          addAssignees
        }
      }
    };

    const changed = await assignIssueToUserIfMissing(
      octokit,
      createIssueContext(),
      "satendra-sr",
      false
    );

    expect(changed).toBe(true);
    expect(addAssignees).toHaveBeenCalledWith({
      owner: "coloredcow-admin",
      repo: "sneha-lms",
      issue_number: 123,
      assignees: ["satendra-sr"]
    });
  });

  it("handles unassignable user errors without failing execution", async () => {
    const addAssignees = vi.fn().mockRejectedValue({ status: 422, message: "Validation Failed" });
    const octokit = {
      rest: {
        issues: {
          addAssignees
        }
      }
    };

    const changed = await assignIssueToUserIfMissing(
      octokit,
      createIssueContext(),
      "satendra-sr",
      false
    );

    expect(changed).toBe(false);
  });
});
