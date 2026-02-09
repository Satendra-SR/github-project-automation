import { withRetry } from "./retry";
import { logger } from "../logger";

export interface IssueContext {
  owner: string;
  repo: string;
  number: number;
  nodeId: string;
  url: string;
}

export async function getIssueContext(
  octokit: any,
  owner: string,
  repo: string,
  number: number
): Promise<IssueContext> {
  const response = await withRetry<{ data: { node_id: string; html_url: string } }>(
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
    url: response.data.html_url
  };
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
