/**
 * Hand-authored OpenAPI 3.1 index of the JustMail public API. The controllers
 * remain the source of truth for routing; this file describes them for tooling
 * (Redoc, generated SDKs, IDE plugins). Update alongside route changes.
 */

const bearer = { $ref: "#/components/securitySchemes/BearerAuth" };
const session = { $ref: "#/components/securitySchemes/CookieAuth" };

function route(
  summary: string,
  responses: number[] = [200, 400, 401, 404],
  auth: Array<"bearer" | "session"> = ["session"],
  requestBody?: Record<string, unknown>,
) {
  const security = auth.map((a) => (a === "bearer" ? { BearerAuth: [] } : { CookieAuth: [] }));
  return {
    summary,
    security,
    ...(requestBody ? { requestBody } : {}),
    responses: Object.fromEntries(
      responses.map((code) => [
        String(code),
        {
          description: code === 200 || code === 201 || code === 204 ? "OK" : "Error",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/Problem" } },
          },
        },
      ]),
    ),
  };
}

const jsonBody = (schema: string) => ({
  required: true,
  content: {
    "application/json": { schema: { $ref: `#/components/schemas/${schema}` } },
  },
});

export function buildOpenApiSpec() {
  void bearer;
  void session;
  return {
    openapi: "3.1.0",
    info: {
      title: "JustMail API",
      version: "1.0.0",
      description:
        "Control-plane API for JustMail. Authenticate via session cookie (web UI) or bearer API key (programmatic).",
    },
    servers: [{ url: "/v1", description: "Versioned base path" }],
    security: [{ CookieAuth: [] }],
    tags: [
      { name: "auth" },
      { name: "orgs" },
      { name: "domains" },
      { name: "mailboxes" },
      { name: "aliases" },
      { name: "dkim" },
      { name: "dashboard" },
      { name: "queue" },
      { name: "security" },
      { name: "webhooks" },
      { name: "api-keys" },
      { name: "invites" },
      { name: "backups" },
      { name: "deliverability" },
    ],
    paths: {
      "/auth/status": { get: { ...route("Is the platform bootstrapped?", [200], []) } },
      "/auth/bootstrap": {
        post: {
          ...route("Create the first owner account", [201, 403], [], jsonBody("BootstrapRequest")),
        },
      },
      "/auth/login": {
        post: {
          ...route("Log in (may return 401 with totp-required)", [200, 401], [], jsonBody("LoginRequest")),
        },
      },
      "/auth/logout": { post: { ...route("Sign out", [204]) } },
      "/auth/me": { get: { ...route("Current user + orgs", [200, 401]) } },
      "/orgs": { get: { ...route("List my organizations") } },
      "/orgs/{orgId}/domains": {
        get: { ...route("List domains") },
        post: { ...route("Add domain", [201, 409], ["session"], jsonBody("CreateDomainRequest")) },
      },
      "/orgs/{orgId}/domains/{id}": {
        get: { ...route("Get a domain") },
        patch: { ...route("Update domain", [200], ["session"], jsonBody("UpdateDomainRequest")) },
        delete: { ...route("Delete domain", [204, 409]) },
      },
      "/orgs/{orgId}/domains/{id}/dns": { get: { ...route("Expected + observed DNS records") } },
      "/orgs/{orgId}/domains/{id}/dns/sync": { post: { ...route("Upsert managed records to Cloudflare") } },
      "/orgs/{orgId}/domains/{id}/dns/check": { post: { ...route("Resolve all records now") } },
      "/orgs/{orgId}/domains/{id}/verify": { post: { ...route("Verify domain ownership") } },
      "/orgs/{orgId}/domains/{id}/dkim": {
        get: { ...route("List DKIM keys") },
        post: { ...route("Generate a new DKIM key", [201], ["session"]) },
      },
      "/orgs/{orgId}/domains/{id}/dkim/{keyId}/activate": { post: { ...route("Activate a key (retires others)", [204]) } },
      "/orgs/{orgId}/domains/{id}/dkim/{keyId}/retire": { post: { ...route("Retire a key", [204]) } },
      "/orgs/{orgId}/mailboxes": { get: { ...route("List all mailboxes in the org") } },
      "/orgs/{orgId}/mailboxes.csv": { get: { ...route("Export mailboxes as CSV", [200]) } },
      "/orgs/{orgId}/domains/{domainId}/mailboxes": {
        get: { ...route("List mailboxes on a domain") },
        post: { ...route("Create mailbox", [201, 409], ["session"], jsonBody("CreateMailboxRequest")) },
      },
      "/orgs/{orgId}/mailboxes/{id}": {
        get: { ...route("Get mailbox") },
        patch: { ...route("Update mailbox", [200], ["session"], jsonBody("UpdateMailboxRequest")) },
        delete: { ...route("Delete mailbox", [204]) },
      },
      "/orgs/{orgId}/mailboxes/{id}/password": { put: { ...route("Set mailbox password", [204], ["session"], jsonBody("SetMailboxPasswordRequest")) } },
      "/orgs/{orgId}/aliases": { get: { ...route("List aliases") } },
      "/orgs/{orgId}/domains/{domainId}/aliases": {
        get: { ...route("List aliases on a domain") },
        post: { ...route("Create alias", [201, 409], ["session"], jsonBody("CreateAliasRequest")) },
      },
      "/orgs/{orgId}/aliases/{id}": {
        patch: { ...route("Update alias", [200], ["session"], jsonBody("UpdateAliasRequest")) },
        delete: { ...route("Delete alias", [204]) },
      },
      "/orgs/{orgId}/dashboard": { get: { ...route("Live overview stats") } },
      "/orgs/{orgId}/events": { get: { ...route("Recent mail_events") } },
      "/orgs/{orgId}/queue": { get: { ...route("Latest queue snapshot") } },
      "/orgs/{orgId}/queue/deferred": { get: { ...route("Deferred queue-ids in the last 24h") } },
      "/orgs/{orgId}/queue/trace/{queueId}": { get: { ...route("Event trace for a queue id") } },
      "/orgs/{orgId}/security/score": { get: { ...route("Deliverability score + factors") } },
      "/orgs/{orgId}/security/blocked-ips": {
        get: { ...route("List blocked IPs") },
        post: { ...route("Block an IP", [200], ["session"], jsonBody("CreateBlockedIpRequest")) },
      },
      "/orgs/{orgId}/security/blocked-ips/{id}": { delete: { ...route("Unblock IP", [204]) } },
      "/orgs/{orgId}/settings": { get: { ...route("List settings") } },
      "/orgs/{orgId}/settings/{key}": { put: { ...route("Upsert a setting", [204], ["session"], jsonBody("UpsertSettingRequest")) } },
      "/orgs/{orgId}/certs": { get: { ...route("List issued certs") } },
      "/orgs/{orgId}/invites": {
        get: { ...route("List invites") },
        post: { ...route("Invite a user", [201], ["session"], jsonBody("CreateInviteRequest")) },
      },
      "/orgs/{orgId}/invites/{id}": { delete: { ...route("Revoke invite", [204]) } },
      "/invites/{token}": { get: { ...route("Preview an invite token", [200, 400, 404], []) } },
      "/invites/{token}/accept": { post: { ...route("Accept an invite", [200, 400, 404], [], jsonBody("AcceptInviteRequest")) } },
      "/orgs/{orgId}/api-keys": {
        get: { ...route("List API keys") },
        post: { ...route("Issue an API key (returns raw token once)", [201], ["session"], jsonBody("CreateApiKeyRequest")) },
      },
      "/orgs/{orgId}/api-keys/{id}": { delete: { ...route("Revoke API key", [204]) } },
      "/orgs/{orgId}/webhooks": {
        get: { ...route("List webhooks") },
        post: { ...route("Register a webhook", [201], ["session"], jsonBody("CreateWebhookRequest")) },
      },
      "/orgs/{orgId}/webhooks/{id}": { delete: { ...route("Delete webhook", [204]) } },
      "/orgs/{orgId}/webhooks/{id}/deliveries": { get: { ...route("Recent deliveries") } },
      "/orgs/{orgId}/backups/schedule": {
        get: { ...route("Backup schedule") },
        put: { ...route("Update backup schedule", [200], ["session"], jsonBody("UpdateBackupScheduleRequest")) },
      },
      "/orgs/{orgId}/backups": { get: { ...route("Backup run history") } },
      "/orgs/{orgId}/deliverability/dmarc": { get: { ...route("Recent DMARC aggregate reports") } },
    },
    components: {
      securitySchemes: {
        CookieAuth: { type: "apiKey", in: "cookie", name: "jm_session" },
        BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "jm_*" },
      },
      schemas: schemas(),
    },
  };
}

function schemas() {
  const base = { type: "object", additionalProperties: true };
  const problem = {
    type: "object",
    properties: {
      type: { type: "string" },
      title: { type: "string" },
      status: { type: "integer" },
      detail: { type: "string" },
      errors: {
        type: "array",
        items: { type: "object", properties: { path: { type: "string" }, message: { type: "string" } } },
      },
    },
    required: ["type", "title", "status"],
  };
  return {
    Problem: problem,
    BootstrapRequest: base,
    LoginRequest: base,
    CreateDomainRequest: base,
    UpdateDomainRequest: base,
    CreateMailboxRequest: base,
    UpdateMailboxRequest: base,
    SetMailboxPasswordRequest: base,
    CreateAliasRequest: base,
    UpdateAliasRequest: base,
    CreateBlockedIpRequest: base,
    UpsertSettingRequest: base,
    CreateInviteRequest: base,
    AcceptInviteRequest: base,
    CreateApiKeyRequest: base,
    CreateWebhookRequest: base,
    UpdateBackupScheduleRequest: base,
  };
}
