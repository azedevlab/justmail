import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { RedisModule } from "./common/redis.module";
import { ThrottlerGuard } from "./common/throttler.guard";
import { CredentialStoreModule } from "./webmail/credential.store";
import { WebmailCacheModule } from "./webmail/webmail.cache";
import { ImapSessionModule } from "./webmail/imap-session.manager";
import { ImapIdleModule } from "./webmail/imap-idle.watcher";
import { DbModule } from "./db/db.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { OrgsModule } from "./orgs/orgs.module";
import { InternalModule } from "./internal/internal.module";
import { DomainsModule } from "./domains/domains.module";
import { MailboxesModule } from "./mailboxes/mailboxes.module";
import { AliasesModule } from "./aliases/aliases.module";
import { DkimModule } from "./dkim/dkim.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { QueueModule } from "./queue/queue.module";
import { SecurityModule } from "./security/security.module";
import { SettingsModule } from "./settings/settings.module";
import { CertsModule } from "./certs/certs.module";
import { InvitesModule } from "./invites/invites.module";
import { ApiKeysModule } from "./apikeys/apikeys.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { BackupsModule } from "./backups/backups.module";
import { DeliverabilityModule } from "./deliverability/deliverability.module";
import { OpenApiModule } from "./openapi/openapi.module";
import { WebmailModule } from "./webmail/webmail.module";
import { CaldavModule } from "./caldav/caldav.module";
import { ContactsModule } from "./contacts/contacts.module";
import { CalendarModule } from "./calendar/calendar.module";
import { SsoModule } from "./sso/sso.module";
import { StorageModule } from "./storage/storage.module";
import { AvModule } from "./av/av.module";
import { AttachmentsModule } from "./attachments/attachments.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { WorkerModule } from "./worker/worker.module";
import { HealthController } from "./health/health.controller";
import { MtaStsController } from "./mtasts/mtasts.controller";

@Module({
  imports: [
    RedisModule,
    CredentialStoreModule,
    WebmailCacheModule,
    ImapSessionModule,
    ImapIdleModule,
    DbModule,
    AuditModule,
    // ApiKeysModule is @Global so SessionGuard can resolve it without a circular
    // import between AuthModule and it. Keep it above AuthModule.
    ApiKeysModule,
    AuthModule,
    OrgsModule,
    InternalModule,
    DomainsModule,
    MailboxesModule,
    AliasesModule,
    DkimModule,
    DashboardModule,
    QueueModule,
    SecurityModule,
    SettingsModule,
    CertsModule,
    InvitesModule,
    WebhooksModule,
    BackupsModule,
    DeliverabilityModule,
    OpenApiModule,
    WebmailModule,
    CaldavModule,
    ContactsModule,
    CalendarModule,
    SsoModule,
    StorageModule,
    AvModule,
    AttachmentsModule,
    NotificationsModule,
    RealtimeModule,
    WorkerModule,
  ],
  controllers: [HealthController, MtaStsController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
