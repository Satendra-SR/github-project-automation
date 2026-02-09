import * as core from "@actions/core";

export const logger = {
  info: (message: string) => core.info(message),
  warn: (message: string) => core.warning(message),
  error: (message: string) => core.error(message)
};
