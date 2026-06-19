/** Error carrying an HTTP-ish status and an actionable, agent-facing message. */
export class ToolError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ToolError";
  }
}

/** Raised when a required credential/env var is missing. */
export class MissingCredentialError extends ToolError {
  constructor(
    public readonly envVar: string,
    hint?: string,
  ) {
    super(
      `Missing credential: set the ${envVar} environment variable.${hint ? " " + hint : ""}`,
      401,
    );
    this.name = "MissingCredentialError";
  }
}

/**
 * Convert an unknown error (HTTP failure, thrown value) into an actionable,
 * non-leaky message string for tool results.
 */
export function handleApiError(error: unknown, service?: string): string {
  const prefix = service ? `[${service}] ` : "";
  if (error instanceof MissingCredentialError) return prefix + error.message;
  if (error instanceof ToolError) {
    switch (error.status) {
      case 401:
        return `${prefix}Error: Authentication failed. Check your API key/token.`;
      case 403:
        return `${prefix}Error: Permission denied. Your account may lack access or the required plan.`;
      case 404:
        return `${prefix}Error: Resource not found. Verify the id is correct.`;
      case 429:
        return `${prefix}Error: Rate limit exceeded. Wait and retry.`;
      default:
        return `${prefix}Error: ${error.message}`;
    }
  }
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return `${prefix}Error: Request timed out. Try again.`;
    }
    return `${prefix}Error: ${error.message}`;
  }
  return `${prefix}Error: ${String(error)}`;
}
