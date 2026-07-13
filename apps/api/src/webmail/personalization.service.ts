import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  Signature,
  SignatureRequest,
  Template,
  TemplateRequest,
} from "@justmail/contracts";
import { Db } from "../db/db.service";
import { OrgsService } from "../orgs/orgs.service";
import { sanitizeMailHtml } from "../common/html-sanitize";
import type { SessionPrincipal } from "../auth/auth.service";

@Injectable()
export class PersonalizationService {
  constructor(
    private readonly db: Db,
    private readonly orgs: OrgsService,
  ) {}

  // Membership + mailbox-tenancy check, shared by every signature/template op.
  private async assertAccess(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
  ): Promise<void> {
    await this.orgs.requireOrgAccess(principal, orgId, "member");
    const { rows } = await this.db.query(
      `SELECT 1 FROM mailboxes m JOIN domains d ON d.id = m.domain_id
        WHERE m.id = $1 AND d.org_id = $2`,
      [mailboxId, orgId],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Mailbox not found" });
  }

  async listSignatures(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
  ): Promise<Signature[]> {
    await this.assertAccess(principal, orgId, mailboxId);
    const { rows } = await this.db.query<Signature>(
      `SELECT id, name, html, text, is_default
         FROM signatures WHERE mailbox_id = $1
        ORDER BY is_default DESC, name ASC`,
      [mailboxId],
    );
    return rows;
  }

  async createSignature(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    input: SignatureRequest,
  ): Promise<Signature> {
    await this.assertAccess(principal, orgId, mailboxId);
    return this.db.tx(async (client) => {
      if (input.is_default) {
        await client.query(
          `UPDATE signatures SET is_default = false, updated_at = now()
            WHERE mailbox_id = $1 AND is_default`,
          [mailboxId],
        );
      }
      const { rows } = await client.query<Signature>(
        `INSERT INTO signatures (org_id, mailbox_id, name, html, text, is_default)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, html, text, is_default`,
        [
          orgId,
          mailboxId,
          input.name,
          sanitizeMailHtml(input.html),
          input.text,
          input.is_default,
        ],
      );
      return rows[0]!;
    });
  }

  async updateSignature(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    id: string,
    input: SignatureRequest,
  ): Promise<Signature> {
    await this.assertAccess(principal, orgId, mailboxId);
    return this.db.tx(async (client) => {
      if (input.is_default) {
        await client.query(
          `UPDATE signatures SET is_default = false, updated_at = now()
            WHERE mailbox_id = $1 AND is_default AND id <> $2`,
          [mailboxId, id],
        );
      }
      const { rows } = await client.query<Signature>(
        `UPDATE signatures
            SET name = $3, html = $4, text = $5, is_default = $6, updated_at = now()
          WHERE id = $1 AND mailbox_id = $2
          RETURNING id, name, html, text, is_default`,
        [
          id,
          mailboxId,
          input.name,
          sanitizeMailHtml(input.html),
          input.text,
          input.is_default,
        ],
      );
      if (!rows[0]) throw new NotFoundException({ title: "Signature not found" });
      return rows[0];
    });
  }

  async deleteSignature(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    id: string,
  ): Promise<void> {
    await this.assertAccess(principal, orgId, mailboxId);
    const { rowCount } = await this.db.query(
      `DELETE FROM signatures WHERE id = $1 AND mailbox_id = $2`,
      [id, mailboxId],
    );
    if (!rowCount) throw new NotFoundException({ title: "Signature not found" });
  }

  async listTemplates(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
  ): Promise<Template[]> {
    await this.assertAccess(principal, orgId, mailboxId);
    const { rows } = await this.db.query<Template>(
      `SELECT id, name, subject, html, text
         FROM templates WHERE mailbox_id = $1 ORDER BY name ASC`,
      [mailboxId],
    );
    return rows;
  }

  async createTemplate(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    input: TemplateRequest,
  ): Promise<Template> {
    await this.assertAccess(principal, orgId, mailboxId);
    const { rows } = await this.db.query<Template>(
      `INSERT INTO templates (org_id, mailbox_id, name, subject, html, text)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, subject, html, text`,
      [orgId, mailboxId, input.name, input.subject, sanitizeMailHtml(input.html), input.text],
    );
    return rows[0]!;
  }

  async updateTemplate(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    id: string,
    input: TemplateRequest,
  ): Promise<Template> {
    await this.assertAccess(principal, orgId, mailboxId);
    const { rows } = await this.db.query<Template>(
      `UPDATE templates
          SET name = $3, subject = $4, html = $5, text = $6, updated_at = now()
        WHERE id = $1 AND mailbox_id = $2
        RETURNING id, name, subject, html, text`,
      [id, mailboxId, input.name, input.subject, sanitizeMailHtml(input.html), input.text],
    );
    if (!rows[0]) throw new NotFoundException({ title: "Template not found" });
    return rows[0];
  }

  async deleteTemplate(
    principal: SessionPrincipal,
    orgId: string,
    mailboxId: string,
    id: string,
  ): Promise<void> {
    await this.assertAccess(principal, orgId, mailboxId);
    const { rowCount } = await this.db.query(
      `DELETE FROM templates WHERE id = $1 AND mailbox_id = $2`,
      [id, mailboxId],
    );
    if (!rowCount) throw new NotFoundException({ title: "Template not found" });
  }
}
