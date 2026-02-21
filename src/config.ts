import fs from "fs";
import path from "path";
import yaml from "js-yaml";

export interface IssueRepoConfig {
  owner: string;
  name: string;
}

export interface ProjectConfig {
  owner: string;
  name?: string;
  number?: number;
  status_field: string;
  status_order: string[];
}

export interface LabelsConfig {
  ready_for_review: string;
  ready_for_review_any?: string[];
}

export interface RuleOnConfig {
  event: string;
  actions: string[];
}

export type RuleDoItem =
  | { ensure_issue_in_project: boolean }
  | { ensure_status_at_least: string }
  | { add_pr_label_if_missing: string }
  | { assign_issue_to_pr_author: boolean }
  | { audit_on_change: boolean };

export interface RuleConfig {
  on: RuleOnConfig;
  do: RuleDoItem[];
}

export interface AutomationConfig {
  issue_repo: IssueRepoConfig;
  project: ProjectConfig;
  labels: LabelsConfig;
  rules: RuleConfig[];
}

function assertString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Config validation failed: ${name} must be a non-empty string`);
  }
  return value;
}

function assertStringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Config validation failed: ${name} must be a non-empty array`);
  }
  const strings = value.map((item) => {
    if (typeof item !== "string") {
      throw new Error(`Config validation failed: ${name} must be an array of strings`);
    }
    return item;
  });
  return strings;
}

function assertObject(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error(`Config validation failed: ${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function loadConfig(configPath: string): AutomationConfig {
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const absolutePath = path.isAbsolute(configPath)
    ? configPath
    : path.join(workspace, configPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Config file not found at ${absolutePath}`);
  }

  const raw = fs.readFileSync(absolutePath, "utf8");
  const data = yaml.load(raw) as Record<string, unknown> | undefined;

  if (!data) {
    throw new Error("Config file is empty or invalid YAML");
  }

  const issueRepo = assertObject(data.issue_repo, "issue_repo");
  const project = assertObject(data.project, "project");
  const labels = assertObject(data.labels, "labels");
  const rules = data.rules;

  const config: AutomationConfig = {
    issue_repo: {
      owner: assertString(issueRepo.owner, "issue_repo.owner"),
      name: assertString(issueRepo.name, "issue_repo.name")
    },
    project: {
      owner: assertString(project.owner, "project.owner"),
      name: project.name ? assertString(project.name, "project.name") : undefined,
      number: project.number ? Number(project.number) : undefined,
      status_field: assertString(project.status_field, "project.status_field"),
      status_order: assertStringArray(project.status_order, "project.status_order")
    },
    labels: {
      ready_for_review: assertString(labels.ready_for_review, "labels.ready_for_review"),
      ready_for_review_any: labels.ready_for_review_any
        ? assertStringArray(labels.ready_for_review_any, "labels.ready_for_review_any")
        : undefined
    },
    rules: Array.isArray(rules)
      ? rules.map((rule, index) => {
          const ruleObj = assertObject(rule, `rules[${index}]`);
          const on = assertObject(ruleObj.on, `rules[${index}].on`);
          const doList = ruleObj.do;

          if (!Array.isArray(doList)) {
            throw new Error(`Config validation failed: rules[${index}].do must be an array`);
          }

          return {
            on: {
              event: assertString(on.event, `rules[${index}].on.event`),
              actions: assertStringArray(on.actions, `rules[${index}].on.actions`)
            },
            do: doList as RuleDoItem[]
          };
        })
      : (() => {
          throw new Error("Config validation failed: rules must be an array");
        })()
  };

  if (!config.project.name && !config.project.number) {
    throw new Error("Config validation failed: project.name or project.number must be provided");
  }

  return config;
}
