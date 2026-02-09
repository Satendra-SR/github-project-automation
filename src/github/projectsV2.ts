import { AutomationConfig } from "../config";
import { isAtOrAfter } from "../domain/status";
import { logger } from "../logger";
import { withRetry } from "./retry";

interface ProjectContext {
  projectId: string;
  statusFieldId: string;
  statusOptions: Record<string, string>;
  projectTitle: string;
}

let cachedProject: ProjectContext | null = null;

async function graphql<T>(octokit: any, query: string, variables: Record<string, any>): Promise<T> {
  const graphqlClient = octokit.graphql as <R>(
    q: string,
    vars: Record<string, any>
  ) => Promise<R>;
  return withRetry(() => graphqlClient<T>(query, variables), "graphql");
}

async function findProjectByNumber(
  octokit: any,
  owner: string,
  number: number
): Promise<{ id: string; title: string } | null> {
  const query = `
    query($owner: String!, $number: Int!) {
      organization(login: $owner) {
        projectV2(number: $number) { id title }
      }
      user(login: $owner) {
        projectV2(number: $number) { id title }
      }
    }
  `;

  const result = await graphql<any>(octokit, query, { owner, number });
  const orgProject = result.organization?.projectV2;
  if (orgProject) return orgProject;
  const userProject = result.user?.projectV2;
  if (userProject) return userProject;
  return null;
}

async function findProjectByName(
  octokit: any,
  owner: string,
  name: string
): Promise<{ id: string; title: string } | null> {
  const orgQuery = `
    query($owner: String!, $cursor: String, $search: String!) {
      organization(login: $owner) {
        projectsV2(first: 50, after: $cursor, query: $search) {
          nodes { id title }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  `;

  const userQuery = `
    query($owner: String!, $cursor: String, $search: String!) {
      user(login: $owner) {
        projectsV2(first: 50, after: $cursor, query: $search) {
          nodes { id title }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  `;

  const search = async (query: string, scope: "organization" | "user") => {
    let cursor: string | null = null;
    while (true) {
      const result: any = await graphql<any>(octokit, query, { owner, cursor, search: name });
      const collection: any = result[scope]?.projectsV2;
      if (collection) {
        const node = collection.nodes.find((item: any) => item.title === name);
        if (node) return node;
        if (collection.pageInfo.hasNextPage) {
          cursor = collection.pageInfo.endCursor;
        } else {
          break;
        }
      } else {
        break;
      }
    }
    return null;
  };

  const orgResult = await search(orgQuery, "organization");
  if (orgResult) return orgResult;

  const userResult = await search(userQuery, "user");
  if (userResult) return userResult;

  return null;
}

async function loadProjectContext(octokit: any, config: AutomationConfig): Promise<ProjectContext> {
  if (cachedProject) return cachedProject;

  const projectOwner = config.project.owner;
  let project: { id: string; title: string } | null = null;

  if (config.project.number) {
    project = await findProjectByNumber(octokit, projectOwner, config.project.number);
  } else if (config.project.name) {
    project = await findProjectByName(octokit, projectOwner, config.project.name);
  }

  if (!project) {
    throw new Error(`Project not found: ${config.project.name ?? config.project.number}`);
  }

  const fieldQuery = `
    query($projectId: ID!, $cursor: String) {
      node(id: $projectId) {
        ... on ProjectV2 {
          fields(first: 50, after: $cursor) {
            nodes {
              id
              name
              dataType
              ... on ProjectV2SingleSelectField { options { id name } }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }
  `;

  let cursor: string | null = null;
  let statusFieldId: string | null = null;
  let statusOptions: Record<string, string> = {};

  while (true) {
    const result: any = await graphql<any>(octokit, fieldQuery, { projectId: project.id, cursor });
    const fields = result.node?.fields?.nodes || [];
    for (const field of fields) {
      if (field.name === config.project.status_field) {
        statusFieldId = field.id;
        statusOptions = {};
        for (const option of field.options || []) {
          statusOptions[option.name] = option.id;
        }
      }
    }

    const pageInfo: any = result.node?.fields?.pageInfo;
    if (pageInfo?.hasNextPage) {
      cursor = pageInfo.endCursor;
    } else {
      break;
    }
  }

  if (!statusFieldId) {
    throw new Error(`Status field not found: ${config.project.status_field}`);
  }

  cachedProject = {
    projectId: project.id,
    projectTitle: project.title,
    statusFieldId,
    statusOptions
  };

  return cachedProject;
}

async function getIssueProjectItemId(
  octokit: any,
  issueOwner: string,
  issueRepo: string,
  issueNumber: number,
  projectId: string
): Promise<string | null> {
  const query = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          id
          projectItems(first: 50) {
            nodes { id project { id } }
          }
        }
      }
    }
  `;

  const result = await graphql<any>(octokit, query, {
    owner: issueOwner,
    repo: issueRepo,
    number: issueNumber
  });

  const items = result.repository?.issue?.projectItems?.nodes || [];
  const match = items.find((item: any) => item.project?.id === projectId);
  return match ? match.id : null;
}

async function addIssueToProject(
  octokit: any,
  projectId: string,
  issueNodeId: string
): Promise<string> {
  const mutation = `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item { id }
      }
    }
  `;

  const result = await graphql<any>(octokit, mutation, {
    projectId,
    contentId: issueNodeId
  });

  return result.addProjectV2ItemById?.item?.id;
}

async function getItemStatus(
  octokit: any,
  itemId: string,
  statusFieldName: string
): Promise<string | null> {
  const query = `
    query($itemId: ID!) {
      node(id: $itemId) {
        ... on ProjectV2Item {
          fieldValues(first: 50) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field {
                  ... on ProjectV2SingleSelectField {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const result = await graphql<any>(octokit, query, { itemId });
  const values = result.node?.fieldValues?.nodes || [];
  const statusValue = values.find((value: any) => value.field?.name === statusFieldName);
  return statusValue?.name || null;
}

async function updateItemStatus(
  octokit: any,
  projectId: string,
  itemId: string,
  fieldId: string,
  optionId: string
): Promise<void> {
  const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(
        input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { singleSelectOptionId: $optionId } }
      ) {
        projectV2Item { id }
      }
    }
  `;

  await graphql<any>(octokit, mutation, {
    projectId,
    itemId,
    fieldId,
    optionId
  });
}

export async function ensureIssueInProjectAndGetStatus(
  octokit: any,
  config: AutomationConfig,
  issueNodeId: string,
  issueOwner: string,
  issueRepo: string,
  issueNumber: number,
  dryRun: boolean
): Promise<{ itemId: string; currentStatus: string | null; projectTitle: string } > {
  const projectContext = await loadProjectContext(octokit, config);

  let itemId = await getIssueProjectItemId(
    octokit,
    issueOwner,
    issueRepo,
    issueNumber,
    projectContext.projectId
  );

  if (!itemId) {
    if (dryRun) {
      logger.info(`[dry-run] Would add issue #${issueNumber} to project ${projectContext.projectTitle}`);
      itemId = "dry-run-item";
    } else {
      itemId = await addIssueToProject(octokit, projectContext.projectId, issueNodeId);
    }
  }

  if (!itemId) {
    throw new Error("Failed to resolve project item for issue");
  }

  const currentStatus = dryRun
    ? null
    : await getItemStatus(octokit, itemId, config.project.status_field);

  return { itemId, currentStatus, projectTitle: projectContext.projectTitle };
}

export async function ensureStatusAtLeast(
  octokit: any,
  config: AutomationConfig,
  itemId: string,
  currentStatus: string | null,
  targetStatus: string,
  dryRun: boolean
): Promise<{ changed: boolean; previousStatus: string | null; newStatus: string }> {
  const projectContext = await loadProjectContext(octokit, config);
  const optionId = projectContext.statusOptions[targetStatus];

  if (!optionId) {
    throw new Error(`Status option not found: ${targetStatus}`);
  }

  if (currentStatus && isAtOrAfter(config.project.status_order, currentStatus, targetStatus)) {
    logger.info(`Current status '${currentStatus}' is at/after '${targetStatus}', skipping update`);
    return { changed: false, previousStatus: currentStatus, newStatus: currentStatus };
  }

  if (dryRun) {
    logger.info(`[dry-run] Would update status to ${targetStatus}`);
    return { changed: false, previousStatus: currentStatus, newStatus: targetStatus };
  }

  await updateItemStatus(
    octokit,
    projectContext.projectId,
    itemId,
    projectContext.statusFieldId,
    optionId
  );

  return { changed: true, previousStatus: currentStatus, newStatus: targetStatus };
}
