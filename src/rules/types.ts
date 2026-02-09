export interface ActionPlan {
  addPrLabelIfMissing?: string;
  ensureIssueInProject: boolean;
  ensureStatusAtLeast?: string;
  auditOnChange: boolean;
}
