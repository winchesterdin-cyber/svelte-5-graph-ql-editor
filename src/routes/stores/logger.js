/**
 * Structured logging helper for the GraphQL editor.
 * Logs are normalized so debugging can key off of level/message/context.
 */
const LEVELS = {
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
}

/**
 * Emit a structured log event to the console.
 * @param {"INFO"|"WARN"|"ERROR"} level
 * @param {string} message
 * @param {Record<string, unknown>} [context]
 */
export function logEvent(level, message, context = {}) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  }

  console.info(`[GraphQL Editor][${level}] ${message}`, payload)
}

export { LEVELS }
