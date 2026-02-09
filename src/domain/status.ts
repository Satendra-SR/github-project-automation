export function compareStatus(order: string[], a: string, b: string): number {
  const indexA = order.indexOf(a);
  const indexB = order.indexOf(b);

  if (indexA === -1) {
    throw new Error(`Unknown status in order list: ${a}`);
  }
  if (indexB === -1) {
    throw new Error(`Unknown status in order list: ${b}`);
  }

  if (indexA === indexB) return 0;
  return indexA < indexB ? -1 : 1;
}

export function isAtOrAfter(order: string[], current: string, target: string): boolean {
  return compareStatus(order, current, target) >= 0;
}

export function maxStatus(order: string[], a: string, b: string): string {
  return compareStatus(order, a, b) >= 0 ? a : b;
}
