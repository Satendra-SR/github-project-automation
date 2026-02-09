import { logger } from "../logger";

function isSecondaryRateLimit(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = (error as { message?: string }).message || "";
  const status = (error as { status?: number }).status;
  return (
    status === 403 &&
    (message.toLowerCase().includes("secondary rate limit") ||
      message.toLowerCase().includes("rate limit"))
  );
}

export async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const maxAttempts = 3;
  let attempt = 0;
  let delayMs = 1000;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;

      if (!isSecondaryRateLimit(error) || attempt >= maxAttempts) {
        throw error;
      }

      logger.warn(`${label} hit rate limit. Retrying in ${delayMs}ms (attempt ${attempt})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }
}
