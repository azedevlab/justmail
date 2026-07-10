// Nest decorators call Reflect.defineMetadata at import time; the polyfill must
// load before any module under test is imported.
import "reflect-metadata";

// config.ts validates process.env at import and throws on missing required keys.
// Provide inert placeholders so importing production modules works under test —
// nothing here connects to a real service.
process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/justmail_test";
process.env.ENCRYPTION_KEY ??= "test-encryption-key-at-least-32-chars-long";
process.env.EVENTS_INGEST_TOKEN ??= "test-events-ingest-token";
