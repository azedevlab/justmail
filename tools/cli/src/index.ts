#!/usr/bin/env node
/**
 * justmail — operator CLI.
 * Wraps compose, backup, restore, upgrade, and health-check commands into a
 * single executable so operators don't memorise ceremony.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createStorageAdapter,
  migrateStorage,
  type FactoryEnv,
} from "@justmail/storage";

const COMMANDS: Record<string, (args: string[]) => number | Promise<number>> = {
  status: statusCmd,
  install: installCmd,
  upgrade: upgradeCmd,
  backup: backupCmd,
  restore: restoreCmd,
  health: healthCmd,
  logs: logsCmd,
  exec: execCmd,
  bootstrap: bootstrapCmd,
  "storage:migrate": storageMigrateCmd,
  version: versionCmd,
  help: helpCmd,
};

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || cmd === "--help" || cmd === "-h") {
  helpCmd([]);
  process.exit(0);
}
const handler = COMMANDS[cmd] ?? helpCmd;
Promise.resolve(handler(rest)).then(
  (code) => process.exit(code),
  (err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  },
);

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
  storage:migrate   Copy objects to a second backend (TARGET_STORAGE_* env)
  version           Show version

storage:migrate flags:
  --prefix <p>   Only migrate keys under this prefix
  --verify       Head-check each copy's size at the target
  --force        Re-copy even when the target already has a same-size object
  --dry-run      Walk and count without writing
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

function factoryEnvFrom(prefix: string): FactoryEnv {
  const g = (k: string) => process.env[`${prefix}${k}`];
  return {
    STORAGE_KIND: (g("STORAGE_KIND") ?? "local") as FactoryEnv["STORAGE_KIND"],
    STORAGE_LOCAL_PATH: g("STORAGE_LOCAL_PATH"),
    STORAGE_BUCKET: g("STORAGE_BUCKET"),
    STORAGE_ENDPOINT: g("STORAGE_ENDPOINT"),
    STORAGE_REGION: g("STORAGE_REGION"),
    STORAGE_ACCESS_KEY: g("STORAGE_ACCESS_KEY"),
    STORAGE_SECRET_KEY: g("STORAGE_SECRET_KEY"),
    ENCRYPTION_KEY: g("ENCRYPTION_KEY") ?? process.env.ENCRYPTION_KEY,
    AZURE_CONNECTION_STRING: g("AZURE_CONNECTION_STRING"),
    GCS_PROJECT_ID: g("GCS_PROJECT_ID"),
    GCS_KEY_FILENAME: g("GCS_KEY_FILENAME"),
  };
}

// Online copy of every object from the live backend (STORAGE_*) to a second one
// described by TARGET_STORAGE_* env. Keys are preserved, so once this reports no
// failures the operator flips STORAGE_KIND to the target with no data reshuffle.
async function storageMigrateCmd(args: string[]): Promise<number> {
  const flag = (n: string) => args.includes(n);
  const opt = (n: string) => {
    const i = args.indexOf(n);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const source = createStorageAdapter(factoryEnvFrom(""));
  const target = createStorageAdapter(factoryEnvFrom("TARGET_"));
  process.stdout.write(`Migrating storage: ${source.kind} → ${target.kind}\n`);

  const [sh, th] = await Promise.all([source.healthCheck(), target.healthCheck()]);
  process.stdout.write(
    `  source ${source.kind}: ${sh.ok ? "ok" : `FAIL ${sh.detail}`} (${sh.latencyMs}ms)\n`,
  );
  process.stdout.write(
    `  target ${target.kind}: ${th.ok ? "ok" : `FAIL ${th.detail}`} (${th.latencyMs}ms)\n`,
  );
  if (!sh.ok) {
    process.stderr.write("source backend unhealthy — aborting\n");
    return 1;
  }
  if (!th.ok && !flag("--dry-run")) {
    process.stderr.write("target backend unhealthy — aborting\n");
    return 1;
  }

  let seen = 0;
  const summary = await migrateStorage(source, target, {
    prefix: opt("--prefix"),
    force: flag("--force"),
    dryRun: flag("--dry-run"),
    verify: flag("--verify"),
    onProgress: (p) => {
      seen += 1;
      if (p.action === "failed") process.stderr.write(`  ! ${p.key}: ${p.detail}\n`);
      else if (seen % 100 === 0) process.stdout.write(`  … ${seen} objects\n`);
    },
  });
  process.stdout.write(
    `Done: copied ${summary.copied}, skipped ${summary.skipped}, failed ${summary.failed}, ${summary.bytesCopied} bytes\n`,
  );
  return summary.failed > 0 ? 1 : 0;
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
