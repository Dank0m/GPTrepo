import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export interface Purchase {
  session_id: string;
  state_hash: string;
  status: 'pending' | 'paid' | 'revoked' | 'expired';
  payment_intent: string | null;
  license_hash: string | null;
}

export class PurchaseStore {
  readonly db: DatabaseSync;

  constructor(filename: string) {
    if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS purchases (
        session_id TEXT PRIMARY KEY,
        state_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'revoked', 'expired')),
        payment_intent TEXT,
        license_hash TEXT UNIQUE,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS purchases_payment_intent ON purchases(payment_intent);
      CREATE TABLE IF NOT EXISTS webhook_events (
        id TEXT PRIMARY KEY,
        processed_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE TABLE IF NOT EXISTS revoked_payment_intents (
        payment_intent TEXT PRIMARY KEY
      );
    `);
  }

  create(sessionId: string, stateHash: string) {
    this.db.prepare('INSERT INTO purchases (session_id, state_hash) VALUES (?, ?)').run(sessionId, stateHash);
  }

  get(sessionId: string): Purchase | undefined {
    return this.db.prepare('SELECT * FROM purchases WHERE session_id = ?').get(sessionId) as unknown as Purchase | undefined;
  }

  license(licenseHash: string): Purchase | undefined {
    return this.db.prepare("SELECT * FROM purchases WHERE license_hash = ? AND status = 'paid'").get(licenseHash) as unknown as Purchase | undefined;
  }

  markPaid(sessionId: string, paymentIntent: string | null) {
    if (paymentIntent && this.db.prepare('SELECT 1 FROM revoked_payment_intents WHERE payment_intent = ?').get(paymentIntent)) {
      this.db.prepare("UPDATE purchases SET status = 'revoked', payment_intent = ? WHERE session_id = ?").run(paymentIntent, sessionId);
      return;
    }
    this.db.prepare("UPDATE purchases SET status = 'paid', payment_intent = ? WHERE session_id = ? AND status != 'revoked'").run(paymentIntent, sessionId);
  }

  activate(sessionId: string, licenseHash: string, paymentIntent: string | null) {
    return this.transaction(() => {
      this.markPaid(sessionId, paymentIntent);
      return this.db.prepare("UPDATE purchases SET status = 'paid', license_hash = ?, payment_intent = ? WHERE session_id = ? AND status = 'paid' AND license_hash IS NULL").run(licenseHash, paymentIntent, sessionId).changes > 0;
    });
  }

  revoke(paymentIntent: string) {
    this.db.prepare('INSERT OR IGNORE INTO revoked_payment_intents (payment_intent) VALUES (?)').run(paymentIntent);
    this.db.prepare("UPDATE purchases SET status = 'revoked' WHERE payment_intent = ?").run(paymentIntent);
  }

  expire(sessionId: string) {
    this.db.prepare("UPDATE purchases SET status = 'expired' WHERE session_id = ? AND status = 'pending'").run(sessionId);
  }

  hasEvent(id: string) {
    return Boolean(this.db.prepare('SELECT 1 FROM webhook_events WHERE id = ?').get(id));
  }

  recordEvent(id: string) {
    this.db.prepare('INSERT OR IGNORE INTO webhook_events (id) VALUES (?)').run(id);
  }

  private transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  processEvent(id: string, operation: () => void): boolean {
    return this.transaction(() => {
      if (this.hasEvent(id)) return false;
      operation();
      this.recordEvent(id);
      return true;
    });
  }

  close() {
    this.db.close();
  }
}
