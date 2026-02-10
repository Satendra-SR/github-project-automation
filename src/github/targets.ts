export interface TargetIssue {
  owner: string;
  repo: string;
  number: number;
}

const TARGETS_FULL_REGEX = /^\s*Targets:\s*([^\s#/]+)\/([^\s#]+)\s*#\s*(\d+)\s*$/im;
const TARGETS_SHORT_REGEX = /^\s*Targets:\s*#\s*(\d+)\s*$/im;

export function parseTargets(
  body: string | null | undefined,
  expectedOwner: string,
  expectedRepo: string
): { target?: TargetIssue; error?: string } {
  if (!body) {
    return { error: "PR body is empty" };
  }

  const fullMatch = body.match(TARGETS_FULL_REGEX);
  const shortMatch = body.match(TARGETS_SHORT_REGEX);

  if (!fullMatch && !shortMatch) {
    return { error: "Missing Targets line" };
  }

  const owner = fullMatch ? fullMatch[1] : expectedOwner;
  const repo = fullMatch ? fullMatch[2] : expectedRepo;
  const number = Number(fullMatch ? fullMatch[3] : shortMatch?.[1]);

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
