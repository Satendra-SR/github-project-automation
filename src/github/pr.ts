import { withRetry } from "./retry";
import { logger } from "../logger";

export interface PullRequestContext {
  owner: string;
  repo: string;
  number: number;
  url: string;
  labels: string[];
}

export async function addLabelIfMissing(
  octokit: any,
  pr: PullRequestContext,
  label: string,
  dryRun: boolean,
  existingLabels?: string[]
): Promise<boolean> {
  const acceptable = (existingLabels && existingLabels.length > 0 ? existingLabels : [label]).map(
    (name) => name.toLowerCase()
  );
  const hasLabel = pr.labels.map((name) => name.toLowerCase()).some((name) => acceptable.includes(name));

  if (hasLabel) {
    logger.info(`Label already present: ${acceptable.join(", ")}`);
    return false;
  }

  if (dryRun) {
    logger.info(`[dry-run] Would add label: ${label}`);
    return false;
  }

  await withRetry(
    () =>
      octokit.rest.issues.addLabels({
        owner: pr.owner,
        repo: pr.repo,
        issue_number: pr.number,
        labels: [label]
      }),
    "addLabel"
  );

  return true;
}

export async function commentOnPr(
  octokit: any,
  pr: PullRequestContext,
  body: string,
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    logger.info(`[dry-run] Would comment on PR: ${body}`);
    return;
  }

  await withRetry(
    () =>
      octokit.rest.issues.createComment({
        owner: pr.owner,
        repo: pr.repo,
        issue_number: pr.number,
        body
      }),
    "commentOnPr"
  );
}
