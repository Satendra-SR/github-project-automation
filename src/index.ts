import * as core from "@actions/core";
import * as github from "@actions/github";
import { loadConfig } from "./config";
import { buildActionPlan } from "./rules/router";
import { parseTargets } from "./github/targets";
import { addLabelIfMissing, commentOnPr } from "./github/pr";
import { assignIssueToUserIfMissing, commentOnIssue, getIssueContext } from "./github/issue";
import { ensureIssueInProjectAndGetStatus, ensureStatusAtLeast } from "./github/projectsV2";
import { logger } from "./logger";

interface AuditDetails {
  change: string;
  trigger: string;
  prUrl: string;
  repo: string;
  details?: string;
}

function formatAuditComment({ change, trigger, prUrl, repo, details }: AuditDetails): string {
  const lines = [
    `🔄 Automation: ${change}`,
    `- Trigger: ${trigger}`,
    `- PR: ${prUrl}`,
    `- Repo: ${repo}`
  ];

  if (details) {
    lines.push(`- Details: ${details}`);
  }

  lines.push(`- Timestamp: ${new Date().toISOString()}`);
  return lines.join("\n");
}

async function run(): Promise<void> {
  try {
    const token = core.getInput("token", { required: true });
    const configPath = core.getInput("config-path") || ".github/automation.yml";
    const dryRun = (core.getInput("dry-run") || "false").toLowerCase() === "true";

    const config = loadConfig(configPath);
    const octokit = github.getOctokit(token);
    const context = github.context;

    if (context.eventName !== "pull_request") {
      logger.info(`Unsupported event: ${context.eventName}`);
      return;
    }

    const payload = context.payload as any;
    const action = payload.action as string;
    const pr = payload.pull_request;

    if (!pr) {
      throw new Error("Missing pull_request in event payload");
    }

    const plan = buildActionPlan(config, context.eventName, action);
    if (!plan) {
      logger.info(`No matching rules for ${context.eventName}/${action}`);
      return;
    }

    const prContext = {
      owner: context.repo.owner,
      repo: context.repo.repo,
      number: pr.number,
      url: pr.html_url,
      labels: (pr.labels || []).map((label: any) => label.name)
    };

    const targetResult = parseTargets(pr.body, config.issue_repo.owner, config.issue_repo.name);
    if (!targetResult.target) {
      const body =
        "⚠️ Automation: Missing Targets line.\n" +
        `Please add one of:\n` +
        `- Targets: ${config.issue_repo.owner}/${config.issue_repo.name}#<issue_id>\n` +
        `- Targets: #<issue_id> (if issues are in the same repo)`;

      await commentOnPr(octokit, prContext, body, dryRun);
      logger.warn(`Targets parsing failed: ${targetResult.error}`);
      return;
    }

    const issueNumber = targetResult.target.number;
    core.setOutput("issue_number", issueNumber.toString());

    const issueContext = await getIssueContext(
      octokit,
      config.issue_repo.owner,
      config.issue_repo.name,
      issueNumber
    );

    let didLabelChange = false;
    let didIssueAssignmentChange = false;
    let didStatusChange = false;
    const targetStatus = plan.ensureStatusAtLeast || "";
    let previousStatus: string | null = null;
    let newStatus: string | null = null;

    if (plan.addPrLabelIfMissing) {
      didLabelChange = await addLabelIfMissing(
        octokit,
        prContext,
        plan.addPrLabelIfMissing,
        dryRun,
        config.labels.ready_for_review_any
      );
    }

    if (plan.assignIssueToPrAuthor) {
      didIssueAssignmentChange = await assignIssueToUserIfMissing(
        octokit,
        issueContext,
        pr.user?.login,
        dryRun
      );
    }

    if (plan.ensureIssueInProject || plan.ensureStatusAtLeast) {
      const { itemId, currentStatus } = await ensureIssueInProjectAndGetStatus(
        octokit,
        config,
        issueContext.nodeId,
        issueContext.owner,
        issueContext.repo,
        issueContext.number,
        dryRun
      );

      if (plan.ensureStatusAtLeast) {
        const result = await ensureStatusAtLeast(
          octokit,
          config,
          itemId,
          currentStatus,
          plan.ensureStatusAtLeast,
          dryRun
        );
        didStatusChange = result.changed;
        previousStatus = result.previousStatus;
        newStatus = result.newStatus;
      }
    }

    if (plan.auditOnChange) {
      const trigger = `${context.eventName}/${action}`;
      const repoRef = `${context.repo.owner}/${context.repo.repo}`;

      if (didLabelChange) {
        const comment = formatAuditComment({
          change: `Label added: ${plan.addPrLabelIfMissing}`,
          trigger,
          prUrl: prContext.url,
          repo: repoRef
        });
        await commentOnIssue(octokit, issueContext, comment, dryRun);
      }

      if (didIssueAssignmentChange) {
        const comment = formatAuditComment({
          change: `Issue assignee added: ${pr.user?.login}`,
          trigger,
          prUrl: prContext.url,
          repo: repoRef
        });
        await commentOnIssue(octokit, issueContext, comment, dryRun);
      }

      if (didStatusChange) {
        const detail = `${previousStatus ?? "(none)"} -> ${newStatus}`;
        const comment = formatAuditComment({
          change: `Status updated: ${newStatus}`,
          trigger,
          prUrl: prContext.url,
          repo: repoRef,
          details: detail
        });
        await commentOnIssue(octokit, issueContext, comment, dryRun);
      }
    }

    core.setOutput("did_label_change", String(didLabelChange));
    core.setOutput("did_status_change", String(didStatusChange));
    core.setOutput("target_status", targetStatus);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("Unknown error");
    }
  }
}

run();
