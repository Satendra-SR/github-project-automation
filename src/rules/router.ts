import { AutomationConfig, RuleDoItem } from "../config";
import { maxStatus } from "../domain/status";
import { ActionPlan } from "./types";

function applyDoItem(plan: ActionPlan, item: RuleDoItem, statusOrder: string[]): ActionPlan {
  if ("add_pr_label_if_missing" in item) {
    return { ...plan, addPrLabelIfMissing: item.add_pr_label_if_missing };
  }
  if ("ensure_issue_in_project" in item) {
    return { ...plan, ensureIssueInProject: Boolean(item.ensure_issue_in_project) };
  }
  if ("ensure_status_at_least" in item) {
    if (!plan.ensureStatusAtLeast) {
      return { ...plan, ensureStatusAtLeast: item.ensure_status_at_least };
    }
    return {
      ...plan,
      ensureStatusAtLeast: maxStatus(statusOrder, plan.ensureStatusAtLeast, item.ensure_status_at_least)
    };
  }
  if ("audit_on_change" in item) {
    return { ...plan, auditOnChange: Boolean(item.audit_on_change) };
  }
  return plan;
}

export function buildActionPlan(
  config: AutomationConfig,
  eventName: string,
  action: string
): ActionPlan | null {
  const rules = config.rules.filter(
    (rule) => rule.on.event === eventName && rule.on.actions.includes(action)
  );

  if (rules.length === 0) return null;

  const initial: ActionPlan = {
    ensureIssueInProject: false,
    auditOnChange: false
  };

  return rules.reduce((plan, rule) => {
    return rule.do.reduce(
      (current, item) => applyDoItem(current, item, config.project.status_order),
      plan
    );
  }, initial);
}
