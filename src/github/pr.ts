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

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return (error as { status?: number }).status === 404;
}

export async function removeLabelsIfPresent(
  octokit: any,
  pr: PullRequestContext,
  labels: string[],
  dryRun: boolean
): Promise<boolean> {
  const labelsToRemove = labels.filter((label) =>
    pr.labels.map((name) => name.toLowerCase()).includes(label.toLowerCase())
  );

  if (labelsToRemove.length === 0) {
    logger.info("No matching labels to remove");
    return false;
  }

  if (dryRun) {
    logger.info(`[dry-run] Would remove labels: ${labelsToRemove.join(", ")}`);
    return false;
  }

  let removedAny = false;
  for (const label of labelsToRemove) {
    try {
      await withRetry(
        () =>
          octokit.rest.issues.removeLabel({
            owner: pr.owner,
            repo: pr.repo,
            issue_number: pr.number,
            name: label
          }),
        "removeLabel"
      );
      removedAny = true;
    } catch (error) {
      if (isNotFoundError(error)) {
        logger.info(`Label not found while removing: ${label}`);
        continue;
      }
      throw error;
    }
  }

  return removedAny;
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
