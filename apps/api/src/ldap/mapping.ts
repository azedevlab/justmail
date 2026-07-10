import type { OrgRole } from "@justmail/contracts";

// Pure helpers for turning raw LDAP entries into JustMail users. Kept free of
// any network or DB dependency so directory logic (attribute mapping, nested
// group expansion, role resolution) is unit-testable in isolation.

export type LdapEntry = { dn: string } & Record<string, unknown>;

export interface MappingConfig {
  emailAttribute: string;
  nameAttribute: string;
  uidAttribute: string;
  memberAttribute: string;
}

export interface MappedUser {
  externalId: string;
  email: string | null;
  name: string | null;
  uid: string | null;
  groups: string[];
}

const ROLE_RANK: Record<OrgRole, number> = {
  owner: 3,
  admin: 2,
  member: 1,
  viewer: 0,
};

// RFC 4515 filter assertion-value escaping, so a DN can be dropped into a
// search filter without injection.
export function escapeFilterValue(value: string): string {
  return value.replace(/[\\*()\0]/g, (c) => {
    switch (c) {
      case "\\":
        return "\\5c";
      case "*":
        return "\\2a";
      case "(":
        return "\\28";
      case ")":
        return "\\29";
      default:
        return "\\00";
    }
  });
}

function asArray(value: unknown): string[] {
  if (value == null) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr
    .map((v) => (Buffer.isBuffer(v) ? v.toString("utf8") : String(v)))
    .filter((v) => v.length > 0);
}

export function firstAttr(entry: LdapEntry, attr: string): string | null {
  return asArray(entry[attr])[0] ?? null;
}

export function allAttr(entry: LdapEntry, attr: string): string[] {
  return asArray(entry[attr]);
}

export function normalizeDn(dn: string): string {
  return dn.trim().toLowerCase();
}

export function mapEntry(entry: LdapEntry, cfg: MappingConfig): MappedUser {
  const email = firstAttr(entry, cfg.emailAttribute);
  return {
    externalId: normalizeDn(entry.dn),
    email: email ? email.toLowerCase() : null,
    name: firstAttr(entry, cfg.nameAttribute),
    uid: firstAttr(entry, cfg.uidAttribute),
    groups: allAttr(entry, cfg.memberAttribute).map(normalizeDn),
  };
}

// Expand direct group memberships through the group-of-groups graph so a user
// in a child group inherits the roles of its ancestor groups (nested groups).
// `parents` maps a group DN to the groups it is itself a direct member of.
export function expandGroups(
  direct: string[],
  parents: Map<string, string[]>,
): string[] {
  const seen = new Set<string>();
  const queue = [...direct.map(normalizeDn)];
  while (queue.length > 0) {
    const g = queue.shift()!;
    if (seen.has(g)) continue;
    seen.add(g);
    for (const parent of parents.get(g) ?? []) {
      const p = normalizeDn(parent);
      if (!seen.has(p)) queue.push(p);
    }
  }
  return [...seen];
}

// Highest-ranked role among the groups the user belongs to, falling back to the
// directory default when no mapped group matches.
export function resolveRole(
  groups: string[],
  roleMap: Record<string, OrgRole>,
  defaultRole: OrgRole,
): OrgRole {
  const normalizedMap = new Map<string, OrgRole>();
  for (const [dn, role] of Object.entries(roleMap)) {
    normalizedMap.set(normalizeDn(dn), role);
  }
  let best: OrgRole | null = null;
  for (const g of groups) {
    const role = normalizedMap.get(normalizeDn(g));
    if (role && (best === null || ROLE_RANK[role] > ROLE_RANK[best])) {
      best = role;
    }
  }
  return best ?? defaultRole;
}
