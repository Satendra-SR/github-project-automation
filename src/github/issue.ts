import { withRetry } from "./retry";
import { logger } from "../logger";

export interface IssueContext {
  owner: string;
  repo: string;
  number: number;
  nodeId: string;
  url: string;
  assignees: string[];
}

export async function getIssueContext(
  octokit: any,
  owner: string,
  repo: string,
  number: number
): Promise<IssueContext> {
  const response = await withRetry<{
    data: { node_id: string; html_url: string; assignees?: Array<{ login?: string }> };
  }>(
    () =>
      octokit.rest.issues.get({
        owner,
        repo,
        issue_number: number
      }),
    "getIssue"
  );

  return {
    owner,
    repo,
    number,
    nodeId: response.data.node_id,
    url: response.data.html_url,
    assignees: (response.data.assignees || [])
      .map((assignee) => assignee.login)
      .filter((login): login is string => Boolean(login))
  };
}

function isUnassignableUserError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return (error as { status?: number }).status === 422;
}

export async function assignIssueToUserIfMissing(
  octokit: any,
  issue: IssueContext,
  assignee: string | undefined,
  dryRun: boolean
): Promise<boolean> {
  const assigneeLogin = assignee?.trim();
  if (!assigneeLogin) {
    logger.warn("Skipping issue self-assignment: missing PR author login");
    return false;
  }

  const alreadyAssigned = issue.assignees
    .map((login) => login.toLowerCase())
    .includes(assigneeLogin.toLowerCase());
  if (alreadyAssigned) {
    logger.info(`Issue already assigned to ${assigneeLogin}`);
    return false;
  }

  if (dryRun) {
    logger.info(`[dry-run] Would assign issue to ${assigneeLogin}`);
    return false;
  }

  try {
    await withRetry(
      () =>
        octokit.rest.issues.addAssignees({
          owner: issue.owner,
          repo: issue.repo,
          issue_number: issue.number,
          assignees: [assigneeLogin]
        }),
      "assignIssueToPrAuthor"
    );
    return true;
  } catch (error) {
    if (isUnassignableUserError(error)) {
      logger.warn(`Could not assign ${assigneeLogin} to ${issue.owner}/${issue.repo}#${issue.number}`);
      return false;
    }
    throw error;
  }
}

export async function commentOnIssue(
  octokit: any,
  issue: IssueContext,
  body: string,
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    logger.info(`[dry-run] Would comment on issue: ${body}`);
    return;
  }

  await withRetry(
    () =>
      octokit.rest.issues.createComment({
        owner: issue.owner,
        repo: issue.repo,
        issue_number: issue.number,
        body
      }),
    "commentOnIssue"
  );
}
