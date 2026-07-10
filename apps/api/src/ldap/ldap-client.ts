import { Client } from "ldapts";
import {
  mapEntry,
  normalizeDn,
  type LdapEntry,
  type MappedUser,
} from "./mapping";

// Thin ldapts wrapper. Opens a (optionally TLS) connection, binds as the
// service account, and pulls the user set plus the group-of-groups graph used
// for nested-group role resolution.

export interface LdapConnConfig {
  host: string;
  port: number;
  encryption: "none" | "starttls" | "ldaps";
  verifyTls: boolean;
  bindDn: string;
  bindPassword: string;
  baseDn: string;
  userFilter: string;
  groupFilter: string | null;
  emailAttribute: string;
  nameAttribute: string;
  uidAttribute: string;
  memberAttribute: string;
}

export interface DirectorySnapshot {
  users: MappedUser[];
  groupParents: Map<string, string[]>;
}

function clientFor(cfg: LdapConnConfig): Client {
  const scheme = cfg.encryption === "ldaps" ? "ldaps" : "ldap";
  return new Client({
    url: `${scheme}://${cfg.host}:${cfg.port}`,
    tlsOptions: { rejectUnauthorized: cfg.verifyTls },
  });
}

async function withBoundClient<T>(
  cfg: LdapConnConfig,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = clientFor(cfg);
  try {
    if (cfg.encryption === "starttls") {
      await client.startTLS({ rejectUnauthorized: cfg.verifyTls });
    }
    await client.bind(cfg.bindDn, cfg.bindPassword);
    return await fn(client);
  } finally {
    try {
      await client.unbind();
    } catch {
      // ignore unbind failures during teardown
    }
  }
}

async function searchGroupParents(
  client: Client,
  cfg: LdapConnConfig,
): Promise<Map<string, string[]>> {
  const parents = new Map<string, string[]>();
  if (!cfg.groupFilter) return parents;
  const { searchEntries } = await client.search(cfg.baseDn, {
    scope: "sub",
    filter: cfg.groupFilter,
    attributes: ["dn", cfg.memberAttribute],
    paged: true,
  });
  for (const raw of searchEntries as unknown as LdapEntry[]) {
    const dn = normalizeDn(raw.dn);
    const memberOf = raw[cfg.memberAttribute];
    const arr = memberOf == null ? [] : Array.isArray(memberOf) ? memberOf : [memberOf];
    parents.set(
      dn,
      arr.map((v) => normalizeDn(String(v))),
    );
  }
  return parents;
}

export async function fetchDirectory(
  cfg: LdapConnConfig,
): Promise<DirectorySnapshot> {
  return withBoundClient(cfg, async (client) => {
    const { searchEntries } = await client.search(cfg.baseDn, {
      scope: "sub",
      filter: cfg.userFilter,
      attributes: [
        "dn",
        cfg.emailAttribute,
        cfg.nameAttribute,
        cfg.uidAttribute,
        cfg.memberAttribute,
      ],
      paged: true,
    });
    const users = (searchEntries as unknown as LdapEntry[]).map((e) =>
      mapEntry(e, cfg),
    );
    const groupParents = await searchGroupParents(client, cfg);
    return { users, groupParents };
  });
}
