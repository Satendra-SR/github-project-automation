export interface ActionPlan {
  addPrLabelIfMissing?: string;
  assignIssueToPrAuthor: boolean;
  ensureIssueInProject: boolean;
  ensureStatusAtLeast?: string;
  auditOnChange: boolean;
}
