import { Module } from "@nestjs/common";
import { QueueSnapshotService } from "./queue-snapshot.service";
import { DnsblService } from "./dnsbl.service";

@Module({
  providers: [QueueSnapshotService, DnsblService],
  exports: [QueueSnapshotService, DnsblService],
})
export class WorkerModule {}
