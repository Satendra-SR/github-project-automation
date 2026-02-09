export interface TargetIssue {
  owner: string;
  repo: string;
  number: number;
}

const TARGETS_REGEX = /^\s*Targets:\s*([^\s#/]+)\/([^\s#]+)\s*#\s*(\d+)\s*$/im;

export function parseTargets(
  body: string | null | undefined,
  expectedOwner: string,
  expectedRepo: string
): { target?: TargetIssue; error?: string } {
  if (!body) {
    return { error: "PR body is empty" };
  }

  const match = body.match(TARGETS_REGEX);
  if (!match) {
    return { error: "Missing Targets line" };
  }

  const owner = match[1];
  const repo = match[2];
  const number = Number(match[3]);

  if (!Number.isInteger(number) || number <= 0) {
    return { error: "Invalid issue number in Targets line" };
  }

  if (owner !== expectedOwner || repo !== expectedRepo) {
    return { error: "Targets line does not match configured issue repo" };
  }

  return {
    target: { owner, repo, number }
  };
}
