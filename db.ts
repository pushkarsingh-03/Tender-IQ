import { Database } from "bun:sqlite";
import { join } from "path";

const DB_PATH = join(import.meta.dir, "tenderiq.db");
export const db = new Database(DB_PATH, { create: true });

// Idempotent column addition — no-op if column already exists
function addCol(table: string, col: string, def: string) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  } catch {
    // column already exists — ignore
  }
}

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenders (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      tender_id         TEXT UNIQUE NOT NULL,
      tender_type       TEXT DEFAULT 'BID',
      buyer_name        TEXT,
      buyer_dept        TEXT,
      ministry          TEXT,
      product_desc      TEXT,
      quantity          INTEGER,
      won_lost          TEXT,
      bid_status        TEXT,
      start_date        TEXT,
      end_date          TEXT,
      remarks           TEXT,
      our_bid_price     REAL,
      l1_bid_price      REAL,
      l1_bidder_name    TEXT,
      consignee_address TEXT,
      contract_no       TEXT,
      contract_date     TEXT,
      order_value       REAL,
      contract_status   TEXT,
      office_name       TEXT,
      evaluation_method TEXT,
      created_at        TEXT DEFAULT (datetime('now')),
      updated_at        TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tender_history (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      tender_id     TEXT NOT NULL,
      field_changed TEXT,
      old_value     TEXT,
      new_value     TEXT,
      source        TEXT DEFAULT 'manual',
      notes         TEXT,
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      sql_text       TEXT NOT NULL,
      executed_at    TEXT DEFAULT (datetime('now')),
      status         TEXT,
      affected_rows  INTEGER,
      error_message  TEXT
    );

    CREATE TRIGGER IF NOT EXISTS tenders_updated
      AFTER UPDATE ON tenders
      FOR EACH ROW
    BEGIN
      UPDATE tenders SET updated_at = datetime('now') WHERE id = NEW.id;
    END;
  `);

  // ── New columns (idempotent — safe to re-run on every boot) ──────────
  addCol("tenders", "consignee_name",          "TEXT");
  addCol("tenders", "buyer_same_as_consignee", "INTEGER DEFAULT 0");
  addCol("tenders", "status",                  "TEXT DEFAULT 'Submitted'");
  addCol("tenders", "l2_bid_price",            "REAL");
  addCol("tenders", "l2_bidder_name",          "TEXT");
  addCol("tenders", "is_scheduled",            "INTEGER DEFAULT 0");
  addCol("tenders", "scheduled_product_desc",  "TEXT");
  addCol("tenders", "scheduled_our_bid",       "REAL");
  addCol("tenders", "scheduled_l1_bid",        "REAL");
  addCol("tenders", "scheduled_l1_bidder",     "TEXT");
  addCol("tenders", "schedule_count",          "INTEGER DEFAULT 1");

  // ── Migrate won_lost → status (idempotent: only touches rows still at default 'Submitted') ──
  db.exec(`
    UPDATE tenders SET status = 'Won'       WHERE won_lost = 'WON'       AND (status IS NULL OR status = 'Submitted');
    UPDATE tenders SET status = 'Lost'      WHERE won_lost = 'Lost'      AND (status IS NULL OR status = 'Submitted');
    UPDATE tenders SET status = 'Cancelled' WHERE won_lost = 'Cancelled' AND (status IS NULL OR status = 'Submitted');
  `);
}
