export interface ActionPlan {
  addPrLabelIfMissing?: string;
  removePrLabelsIfPresent?: string[];
  assignIssueToPrAuthor: boolean;
  ensureIssueInProject: boolean;
  ensureStatusAtLeast?: string;
  auditOnChange: boolean;
}
