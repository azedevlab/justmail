import { LocalAdapter } from "./local.js";
import { S3Adapter } from "./s3.js";
import { AzureAdapter } from "./azure.js";
import { GcsAdapter } from "./gcs.js";
import type { StorageAdapter } from "./types.js";

export interface FactoryEnv {
  STORAGE_KIND:
    | "local"
    | "nfs"
    | "smb"
    | "cephfs"
    | "zfs"
    | "s3"
    | "r2"
    | "minio"
    | "b2"
    | "wasabi"
    | "do"
    | "scaleway"
    | "ceph"
    | "azure"
    | "gcs";
  STORAGE_LOCAL_PATH?: string;
  STORAGE_BUCKET?: string;
  STORAGE_ENDPOINT?: string;
  STORAGE_REGION?: string;
  STORAGE_ACCESS_KEY?: string;
  STORAGE_SECRET_KEY?: string;
  ENCRYPTION_KEY?: string;
  AZURE_CONNECTION_STRING?: string;
  GCS_PROJECT_ID?: string;
  GCS_KEY_FILENAME?: string;
}

/**
 * Build a StorageAdapter from environment. R2, MinIO, B2, Wasabi, DigitalOcean
 * Spaces, Scaleway and Ceph are all S3-flavoured providers with slightly
 * different defaults (region, endpoint host pattern, path-style addressing);
 * the factory encodes those defaults so operators only have to set
 * `STORAGE_KIND=<provider>` and the credentials — no need to know boto's
 * addressing style. For providers with a stable host pattern the endpoint is
 * derived from the region when `STORAGE_ENDPOINT` is omitted.
 */
export function createStorageAdapter(env: FactoryEnv): StorageAdapter {
  switch (env.STORAGE_KIND) {
    // Filesystem-backed: local disk or any POSIX-mounted network/distributed
    // filesystem. All share LocalAdapter; the kind just records which mount
    // type backs it (STORAGE_LOCAL_PATH points at the mount). NFS/SMB/CephFS
    // need Dovecot's index/lock settings tuned for shared storage — see
    // docs/deployment for the required mail_location/lock_method guidance.
    case "local":
    case "nfs":
    case "smb":
    case "cephfs":
    case "zfs":
      return new LocalAdapter(
        env.STORAGE_LOCAL_PATH ?? "/opt/justmail/attachments",
        env.ENCRYPTION_KEY ?? "dev-only-signing-key",
        env.STORAGE_KIND,
      );
    case "s3":
      return new S3Adapter({
        bucket: mustBucket(env),
        region: env.STORAGE_REGION ?? "us-east-1",
        credentials: keyPair(env),
      });
    case "r2":
      return new S3Adapter(
        {
          bucket: mustBucket(env),
          region: "auto",
          endpoint: env.STORAGE_ENDPOINT,
          credentials: keyPair(env),
          forcePathStyle: false,
        },
        "r2",
      );
    case "minio":
      return new S3Adapter(
        {
          bucket: mustBucket(env),
          region: env.STORAGE_REGION ?? "us-east-1",
          endpoint: env.STORAGE_ENDPOINT,
          credentials: keyPair(env),
          forcePathStyle: true,
        },
        "minio",
      );
    case "b2":
      return new S3Adapter(
        {
          bucket: mustBucket(env),
          region: env.STORAGE_REGION ?? "us-west-004",
          endpoint: env.STORAGE_ENDPOINT,
          credentials: keyPair(env),
        },
        "b2",
      );
    case "wasabi": {
      const region = env.STORAGE_REGION ?? "us-east-1";
      return new S3Adapter(
        {
          bucket: mustBucket(env),
          region,
          endpoint:
            env.STORAGE_ENDPOINT ?? `https://s3.${region}.wasabisys.com`,
          credentials: keyPair(env),
        },
        "wasabi",
      );
    }
    case "do": {
      // DigitalOcean Spaces: region-keyed host, virtual-hosted addressing.
      const region = env.STORAGE_REGION ?? "nyc3";
      return new S3Adapter(
        {
          bucket: mustBucket(env),
          region,
          endpoint:
            env.STORAGE_ENDPOINT ?? `https://${region}.digitaloceanspaces.com`,
          credentials: keyPair(env),
        },
        "do",
      );
    }
    case "scaleway": {
      const region = env.STORAGE_REGION ?? "fr-par";
      return new S3Adapter(
        {
          bucket: mustBucket(env),
          region,
          endpoint: env.STORAGE_ENDPOINT ?? `https://s3.${region}.scw.cloud`,
          credentials: keyPair(env),
        },
        "scaleway",
      );
    }
    case "ceph":
      // Ceph RadosGW has no canonical host and typically needs path-style
      // addressing, so the endpoint is mandatory.
      return new S3Adapter(
        {
          bucket: mustBucket(env),
          region: env.STORAGE_REGION ?? "us-east-1",
          endpoint: mustEndpoint(env, "ceph"),
          credentials: keyPair(env),
          forcePathStyle: true,
        },
        "ceph",
      );
    case "azure":
      if (!env.AZURE_CONNECTION_STRING)
        throw new Error("AZURE_CONNECTION_STRING required for azure adapter");
      return new AzureAdapter({
        connectionString: env.AZURE_CONNECTION_STRING,
        container: mustBucket(env),
      });
    case "gcs":
      return new GcsAdapter({
        bucket: mustBucket(env),
        projectId: env.GCS_PROJECT_ID,
        keyFilename: env.GCS_KEY_FILENAME,
      });
  }
}

function mustBucket(env: FactoryEnv): string {
  if (!env.STORAGE_BUCKET) throw new Error("STORAGE_BUCKET required");
  return env.STORAGE_BUCKET;
}

function mustEndpoint(env: FactoryEnv, kind: string): string {
  if (!env.STORAGE_ENDPOINT)
    throw new Error(`STORAGE_ENDPOINT required for ${kind} adapter`);
  return env.STORAGE_ENDPOINT;
}

function keyPair(env: FactoryEnv) {
  if (!env.STORAGE_ACCESS_KEY || !env.STORAGE_SECRET_KEY) {
    // Allow env-provided credentials (STS/instance profile).
    return undefined as never;
  }
  return {
    accessKeyId: env.STORAGE_ACCESS_KEY,
    secretAccessKey: env.STORAGE_SECRET_KEY,
  };
}
