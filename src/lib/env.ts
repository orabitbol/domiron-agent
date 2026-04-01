/**
 * Runtime environment validation.
 *
 * Call requireEnv() (or individual getEnv() calls) at the top of any route
 * handler or service that depends on these values.  Throws with a clear
 * message listing every missing variable rather than throwing cryptically
 * inside a library call.
 */

const REQUIRED_META_ENV = [
  "META_APP_ID",
  "META_APP_SECRET",
  "META_REDIRECT_URI",
  "TOKEN_ENCRYPTION_KEY",
] as const;

const REQUIRED_AUTH_ENV = [
  "AUTH_SECRET",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
] as const;

const REQUIRED_AGENT_ENV = ["AGENT_API_KEY"] as const;

type MetaEnvKey = (typeof REQUIRED_META_ENV)[number];
type AuthEnvKey = (typeof REQUIRED_AUTH_ENV)[number];
type AgentEnvKey = (typeof REQUIRED_AGENT_ENV)[number];
type KnownEnvKey = MetaEnvKey | AuthEnvKey | AgentEnvKey;

/**
 * Returns the value of an env var, throwing a clear error if it is missing.
 * Use this inside route handlers instead of `process.env.X ?? ""`.
 */
export function getEnv(key: KnownEnvKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `Check .env.example for the expected format.`
    );
  }
  return value;
}

/**
 * Validates that all Meta-related env vars are present.
 * Throws with a list of every missing var if any are absent.
 */
export function requireMetaEnv(): void {
  const missing = REQUIRED_META_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required Meta environment variables: ${missing.join(", ")}. ` +
        `Check .env.example for the expected format.`
    );
  }
}
