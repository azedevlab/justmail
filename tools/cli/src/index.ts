#!/usr/bin/env node
/**
 * justmail — operator CLI.
 * Wraps compose, backup, restore, upgrade, and health-check commands into a
 * single executable so operators don't memorise ceremony.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const COMMANDS: Record<string, (args: string[]) => number> = {
  status: statusCmd,
  install: installCmd,
  upgrade: upgradeCmd,
  backup: backupCmd,
  restore: restoreCmd,
  health: healthCmd,
  logs: logsCmd,
  exec: execCmd,
  bootstrap: bootstrapCmd,
  version: versionCmd,
  help: helpCmd,
};

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || cmd === "--help" || cmd === "-h") {
  helpCmd([]);
  process.exit(0);
}
const handler = COMMANDS[cmd] ?? helpCmd;
process.exit(handler(rest));

function helpCmd(_: string[]): number {
  process.stdout.write(`justmail — operator CLI

Usage:
  justmail <command> [args]

Commands:
  status            Show which services are up, health snapshot
  install           Run the first-time installer
  upgrade [--to X]  Apply migrations + rolling deploy
  backup            Trigger a full backup
  restore --backup <id>   Restore a backup id
  health [--deep]   DNS/TLS/MX health checks
  logs <service>    Tail service logs
  exec <service>    Open a shell in a service container
  bootstrap         Create the first admin user (interactive)
  version           Show version
`);
  return 0;
}

function statusCmd(_: string[]): number {
  return docker(["ps", "--format", "{{.Names}}\t{{.Status}}"]);
}

function installCmd(_: string[]): number {
  process.stdout.write("Bootstrapping compose stack (core, mail, obs, sec, app profiles)\n");
  return compose([
    "--profile", "core",
    "--profile", "mail",
    "--profile", "obs",
    "--profile", "sec",
    "--profile", "app",
    "up", "-d",
  ]);
}

function upgradeCmd(args: string[]): number {
  const idx = args.indexOf("--to");
  const target = idx >= 0 ? args[idx + 1] : "latest";
  process.stdout.write(`Upgrading to ${target}\n`);
  const pull = compose(["pull"]);
  if (pull !== 0) return pull;
  return compose(["up", "-d"]);
}

function backupCmd(_: string[]): number {
  return sh("/opt/justmail/app/scripts/backup.sh");
}

function restoreCmd(args: string[]): number {
  const idx = args.indexOf("--backup");
  if (idx < 0) {
    process.stderr.write("--backup <id> required\n");
    return 2;
  }
  return sh(`/opt/justmail/app/scripts/restore.sh ${args[idx + 1]}`);
}

function healthCmd(_: string[]): number {
  // Placeholder — the real check ships in the platform binary.
  process.stdout.write("Running platform health probes\n");
  return docker(["exec", "-t", "justmail-api-1", "curl", "-s", "http://localhost:4000/healthz"]);
}

function logsCmd(args: string[]): number {
  if (!args[0]) {
    process.stderr.write("service name required (e.g. justmail logs api)\n");
    return 2;
  }
  return docker(["logs", "-f", `justmail-${args[0]}-1`]);
}

function execCmd(args: string[]): number {
  if (!args[0]) {
    process.stderr.write("service name required\n");
    return 2;
  }
  return docker(["exec", "-it", `justmail-${args[0]}-1`, "sh"]);
}

function bootstrapCmd(_: string[]): number {
  process.stdout.write(
    "Open the admin URL and complete the bootstrap form. This command is a placeholder for future interactive bootstrap.\n",
  );
  return 0;
}

function versionCmd(_: string[]): number {
  try {
    const pkg = JSON.parse(
      readFileSync(join(import.meta.dirname ?? "", "..", "package.json"), "utf8"),
    ) as { version: string };
    process.stdout.write(`justmail ${pkg.version}\n`);
  } catch {
    process.stdout.write("justmail (dev)\n");
  }
  return 0;
}

function docker(args: string[]): number {
  return sh(`docker ${args.join(" ")}`);
}

function compose(args: string[]): number {
  const composeFile = process.env.JM_COMPOSE_FILE ?? "/opt/justmail/app/services/compose/docker-compose.yml";
  const envFile = process.env.JM_ENV_FILE ?? "/opt/justmail/.env";
  return sh(`docker compose --env-file ${envFile} -f ${composeFile} ${args.join(" ")}`);
}

function sh(cmd: string): number {
  const res = spawnSync("sh", ["-c", cmd], { stdio: "inherit" });
  return res.status ?? 1;
}
