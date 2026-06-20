/**
 * @edu-agent-kit/google-shared
 *
 * Shared OAuth2 client, token store, scope registry, and consent flow used by
 * every Google adapter (Classroom + Workspace). A single stored token covers
 * the union of scopes for the services the user enabled.
 */
export {
  createOAuthClient,
  getAuthorizedClient,
  getTokenStore,
  tokenStorePath,
  runAuthFlow,
  logout,
  isLoggedIn,
  DEFAULT_REDIRECT_URI,
  type OAuth2Client,
  type Credentials,
} from "./auth.js";
export {
  SCOPE_REGISTRY,
  ALL_SERVICES,
  scopesFor,
  type GoogleService,
} from "./scopes.js";
