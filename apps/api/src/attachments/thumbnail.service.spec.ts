import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { ThumbnailService } from "./thumbnail.service";

// A real 64x48 PNG so sharp has something to decode/resize.
async function samplePng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 64,
      height: 48,
      channels: 3,
      background: { r: 10, g: 120, b: 200 },
    },
  })
    .png()
    .toBuffer();
}

function svc(source: Buffer) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const puts: { key: string; mime: string }[] = [];
  const db = {
    query: async (sql: string, params: unknown[]) => {
      queries.push({ sql, params });
      if (sql.startsWith("SELECT storage_key")) {
        return { rows: [{ storage_key: `org/thumbnails/abc123` }] };
      }
      return { rows: [] };
    },
  };
  const storage = {
    stream: async () => Readable.from([source]),
    put: async (_org: string, key: string, _data: Buffer, mime: string) => {
      puts.push({ key, mime });
    },
    key: (org: string, key: string) => `${org}/${key}`,
  };
  return {
    service: new ThumbnailService(db as never, storage as never),
    queries,
    puts,
  };
}

describe("ThumbnailService", () => {
  it("skips non-image mimes", () => {
    const { service } = svc(Buffer.alloc(0));
    expect(service.canThumbnail("application/pdf", 100)).toBe(false);
    expect(service.canThumbnail("image/png", 100)).toBe(true);
  });

  it("generates a webp thumbnail and records it", async () => {
    const png = await samplePng();
    const { service, queries, puts } = svc(png);
    await service.generate("org-1", "att-1", "abc123", "image/png", png.length);

    // Stored a webp under the content-addressed thumbnail key.
    expect(puts).toContainEqual({ key: "thumbnails/abc123", mime: "image/webp" });
    // Inserted a thumbnails row and marked the attachment ready.
    expect(queries.some((q) => q.sql.startsWith("INSERT INTO thumbnails"))).toBe(true);
    expect(
      queries.some(
        (q) => q.sql.includes("preview_state") && q.params.includes("ready"),
      ),
    ).toBe(true);
  });

  it("marks failed on undecodable input without throwing", async () => {
    const { service, queries } = svc(Buffer.from("not an image"));
    await expect(
      service.generate("org-1", "att-1", "abc123", "image/png", 12),
    ).resolves.toBeUndefined();
    expect(
      queries.some(
        (q) => q.sql.includes("preview_state") && q.params.includes("failed"),
      ),
    ).toBe(true);
  });
});
