import { LocalAdapter } from "./local.js";
import { S3Adapter } from "./s3.js";
import { AzureAdapter } from "./azure.js";
import { GcsAdapter } from "./gcs.js";
import type { StorageAdapter } from "./types.js";

export interface FactoryEnv {
  STORAGE_KIND: "local" | "s3" | "r2" | "minio" | "b2" | "azure" | "gcs";
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
 * Build a StorageAdapter from environment. R2, MinIO, and B2 are S3-flavoured
 * providers with slightly different defaults; the factory encodes those
 * defaults so operators only have to set `STORAGE_KIND=r2` (or whatever) and
 * the credentials — no need to know boto's addressing style.
 */
export function createStorageAdapter(env: FactoryEnv): StorageAdapter {
  switch (env.STORAGE_KIND) {
    case "local":
      return new LocalAdapter(
        env.STORAGE_LOCAL_PATH ?? "/opt/justmail/attachments",
        env.ENCRYPTION_KEY ?? "dev-only-signing-key",
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
