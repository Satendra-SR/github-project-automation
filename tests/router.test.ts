import { describe, expect, it } from "vitest";
import { buildActionPlan } from "../src/rules/router";
import { AutomationConfig } from "../src/config";

const config: AutomationConfig = {
  issue_repo: {
    owner: "coloredcow-admin",
    name: "sneha-lms"
  },
  project: {
    owner: "coloredcow-admin",
    name: "SNEHA LMS",
    status_field: "Status",
    status_order: ["Backlog", "Ready", "In Progress", "In review", "Completed"]
  },
  labels: {
    ready_for_review: "Ready For Review",
    reviewed: "status : reviewed",
    reviewed_any: ["status : reviewed", "Reviewed"]
  },
  rules: [
    {
      on: {
        event: "pull_request",
        actions: ["opened"]
      },
      do: [{ assign_issue_to_pr_author: true }]
    }
  ]
};

describe("buildActionPlan", () => {
  it("maps assign_issue_to_pr_author from config rules", () => {
    const plan = buildActionPlan(config, "pull_request", "opened");
    expect(plan).not.toBeNull();
    expect(plan?.assignIssueToPrAuthor).toBe(true);
  });

  it("defaults assignment flag to false when rule does not include it", () => {
    const noAssignConfig: AutomationConfig = {
      ...config,
      rules: [
        {
          on: {
            event: "pull_request",
            actions: ["synchronize"]
          },
          do: [{ ensure_issue_in_project: true }]
        }
      ]
    };
    const plan = buildActionPlan(noAssignConfig, "pull_request", "synchronize");
    expect(plan).not.toBeNull();
    expect(plan?.assignIssueToPrAuthor).toBe(false);
  });

  it("maps remove_pr_labels_if_present from config rules", () => {
    const removeLabelConfig: AutomationConfig = {
      ...config,
      rules: [
        {
          on: {
            event: "pull_request_review",
            actions: ["submitted"]
          },
          do: [
            { remove_pr_labels_if_present: ["Ready For Review", "status: ready for review"] },
            { add_pr_label_if_missing: "status : reviewed" }
          ]
        }
      ]
    };
    const plan = buildActionPlan(removeLabelConfig, "pull_request_review", "submitted");
    expect(plan).not.toBeNull();
    expect(plan?.removePrLabelsIfPresent).toEqual(["Ready For Review", "status: ready for review"]);
    expect(plan?.addPrLabelIfMissing).toBe("status : reviewed");
  });
});
