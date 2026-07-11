import { Global, Module } from "@nestjs/common";
import { StorageService, STORAGE_ADAPTER } from "./storage.service";
import { createStorageAdapter } from "@justmail/storage";
import { config } from "../config";

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_ADAPTER,
      useFactory: () =>
        createStorageAdapter({
          STORAGE_KIND: (config as unknown as { STORAGE_KIND?: "local" | "nfs" | "smb" | "cephfs" | "zfs" | "s3" | "r2" | "minio" | "b2" | "wasabi" | "do" | "scaleway" | "ceph" | "azure" | "gcs" }).STORAGE_KIND ?? "local",
          STORAGE_LOCAL_PATH: (config as unknown as { STORAGE_LOCAL_PATH?: string }).STORAGE_LOCAL_PATH,
          STORAGE_BUCKET: (config as unknown as { STORAGE_BUCKET?: string }).STORAGE_BUCKET,
          STORAGE_ENDPOINT: (config as unknown as { STORAGE_ENDPOINT?: string }).STORAGE_ENDPOINT,
          STORAGE_REGION: (config as unknown as { STORAGE_REGION?: string }).STORAGE_REGION,
          STORAGE_ACCESS_KEY: (config as unknown as { STORAGE_ACCESS_KEY?: string }).STORAGE_ACCESS_KEY,
          STORAGE_SECRET_KEY: (config as unknown as { STORAGE_SECRET_KEY?: string }).STORAGE_SECRET_KEY,
          ENCRYPTION_KEY: config.ENCRYPTION_KEY,
        }),
    },
    StorageService,
  ],
  exports: [StorageService, STORAGE_ADAPTER],
})
export class StorageModule {}
