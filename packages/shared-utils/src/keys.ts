/** Keyboard shortcut catalog. Each `?` menu entry pulls from this list, so
 * bindings stay documented in one place. Apps can extend at boot. */

export interface Shortcut {
  combo: string;
  description: string;
  scope?: "global" | "admin" | "webmail";
}

export const globalShortcuts: Shortcut[] = [
  { combo: "meta+k", description: "Open command palette", scope: "global" },
  { combo: "/", description: "Search", scope: "global" },
  { combo: "?", description: "Show keyboard shortcuts", scope: "global" },
  { combo: "g o", description: "Go to overview", scope: "global" },
  { combo: "g m", description: "Go to mailboxes", scope: "global" },
  { combo: "g d", description: "Go to domains", scope: "global" },
];

export const adminShortcuts: Shortcut[] = [
  { combo: "n d", description: "New domain", scope: "admin" },
  { combo: "n m", description: "New mailbox", scope: "admin" },
  { combo: "n a", description: "New alias", scope: "admin" },
  { combo: "n k", description: "Issue API key", scope: "admin" },
  { combo: "n w", description: "Add webhook", scope: "admin" },
  { combo: "n i", description: "Invite user", scope: "admin" },
];

export const webmailShortcuts: Shortcut[] = [
  { combo: "c", description: "Compose", scope: "webmail" },
  { combo: "r", description: "Reply", scope: "webmail" },
  { combo: "shift+r", description: "Reply all", scope: "webmail" },
  { combo: "f", description: "Forward", scope: "webmail" },
  { combo: "e", description: "Archive", scope: "webmail" },
  { combo: "#", description: "Delete", scope: "webmail" },
  { combo: "b", description: "Snooze", scope: "webmail" },
  { combo: "s", description: "Star", scope: "webmail" },
  { combo: "l", description: "Label", scope: "webmail" },
  { combo: "v", description: "Move", scope: "webmail" },
  { combo: "u", description: "Back to list", scope: "webmail" },
  { combo: "j", description: "Next message", scope: "webmail" },
  { combo: "k", description: "Previous message", scope: "webmail" },
];
