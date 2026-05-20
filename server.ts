import { db, initDb } from "./db";

initDb();

const PORT = 3001;

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function cors() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// ──────────────────────────────────────────────
// SQL safety guard for the Sync tab
// ──────────────────────────────────────────────
function isSafeSQL(sql: string): { safe: boolean; reason?: string } {
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    const upper = stmt.toUpperCase();
    const allowed = ["UPDATE ", "INSERT ", "SELECT "];
    if (!allowed.some((k) => upper.startsWith(k))) {
      return {
        safe: false,
        reason: `Only UPDATE, INSERT, SELECT allowed. Got: ${stmt.substring(0, 60)}`,
      };
    }
    if (upper.includes("DROP ") || upper.includes("TRUNCATE ")) {
      return { safe: false, reason: "DROP / TRUNCATE not allowed" };
    }
  }
  return { safe: true };
}

// ──────────────────────────────────────────────
// Route handlers
// ──────────────────────────────────────────────

// GET /api/tenders
function getTenders(url: URL) {
  const search = url.searchParams.get("search") || "";
  const won_lost = url.searchParams.get("won_lost") || "";
  const year = url.searchParams.get("year") || "";
  const type = url.searchParams.get("type") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  let where = "WHERE 1=1";
  const params: Record<string, string | number> = {};

  if (search) {
    where += ` AND (tender_id LIKE $search OR buyer_name LIKE $search OR product_desc LIKE $search)`;
    params.$search = `%${search}%`;
  }
  if (won_lost) {
    where += ` AND won_lost = $won_lost`;
    params.$won_lost = won_lost;
  }
  if (year) {
    where += ` AND tender_id LIKE $year`;
    params.$year = `GEM/${year}%`;
  }
  if (type) {
    where += ` AND tender_type = $type`;
    params.$type = type;
  }

  const total = (db.query(`SELECT COUNT(*) as c FROM tenders ${where}`).get(params) as any).c;
  const tenders = db
    .query(`SELECT * FROM tenders ${where} ORDER BY id DESC LIMIT $limit OFFSET $offset`)
    .all({ ...params, $limit: limit, $offset: offset });

  return json({ tenders, total, page, limit });
}

// GET /api/tenders/:id
function getTender(id: string) {
  const tender = db.query("SELECT * FROM tenders WHERE id = $id").get({ $id: Number(id) });
  if (!tender) return json({ error: "Not found" }, 404);
  const history = db
    .query("SELECT * FROM tender_history WHERE tender_id = $tid ORDER BY created_at DESC")
    .all({ $tid: (tender as any).tender_id });
  return json({ tender, history });
}

// POST /api/tenders
function createTender(body: Record<string, unknown>) {
  const cols = Object.keys(body);
  const placeholders = cols.map((c) => `$${c}`).join(", ");
  const colNames = cols.join(", ");
  const params: Record<string, unknown> = {};
  for (const c of cols) params[`$${c}`] = body[c];

  db.query(`INSERT INTO tenders (${colNames}) VALUES (${placeholders})`).run(params);
  const tender = db.query("SELECT * FROM tenders WHERE tender_id = $tid").get({ $tid: body.tender_id });
  return json(tender, 201);
}

// PUT /api/tenders/:id
function updateTender(id: string, body: Record<string, unknown>) {
  const existing = db.query("SELECT * FROM tenders WHERE id = $id").get({ $id: Number(id) }) as any;
  if (!existing) return json({ error: "Not found" }, 404);

  // Record history for each changed field
  const historyInsert = db.prepare(
    "INSERT INTO tender_history (tender_id, field_changed, old_value, new_value, source) VALUES ($tid, $field, $old, $new, 'manual')"
  );
  for (const [key, newVal] of Object.entries(body)) {
    if (key === "id" || key === "created_at" || key === "updated_at") continue;
    const oldVal = existing[key];
    if (String(oldVal) !== String(newVal)) {
      historyInsert.run({ $tid: existing.tender_id, $field: key, $old: oldVal, $new: newVal });
    }
  }

  const sets = Object.keys(body)
    .filter((k) => k !== "id" && k !== "created_at" && k !== "updated_at")
    .map((k) => `${k} = $${k}`)
    .join(", ");
  const params: Record<string, unknown> = { $id: Number(id) };
  for (const [k, v] of Object.entries(body)) params[`$${k}`] = v;

  db.query(`UPDATE tenders SET ${sets} WHERE id = $id`).run(params);
  return json(db.query("SELECT * FROM tenders WHERE id = $id").get({ $id: Number(id) }));
}

// DELETE /api/tenders/:id
function deleteTender(id: string) {
  db.query("DELETE FROM tenders WHERE id = $id").run({ $id: Number(id) });
  return json({ ok: true });
}

// ──────────────────────────────────────────────
// Analytics
// ──────────────────────────────────────────────
function analyticsOverview() {
  const row = db.query(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN won_lost = 'WON' THEN 1 ELSE 0 END) as won,
      SUM(CASE WHEN won_lost = 'Lost' THEN 1 ELSE 0 END) as lost,
      SUM(CASE WHEN won_lost = 'Pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN won_lost = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
      ROUND(
        CAST(SUM(CASE WHEN won_lost = 'WON' THEN 1 ELSE 0 END) AS REAL) /
        NULLIF(SUM(CASE WHEN won_lost IN ('WON','Lost') THEN 1 ELSE 0 END), 0) * 100,
        1
      ) as win_rate,
      COALESCE(SUM(CASE WHEN won_lost = 'WON' THEN order_value ELSE 0 END), 0) as total_order_value,
      COALESCE(SUM(CASE WHEN won_lost IN ('WON','Lost','Pending') THEN our_bid_price ELSE 0 END), 0) as total_bid_value
    FROM tenders
  `).get();
  return json(row);
}

function analyticsYearly() {
  const rows = db.query(`
    SELECT
      substr(tender_id, 5, 4) as year,
      SUM(CASE WHEN won_lost = 'WON'     THEN 1 ELSE 0 END) as won,
      SUM(CASE WHEN won_lost = 'Lost'    THEN 1 ELSE 0 END) as lost,
      SUM(CASE WHEN won_lost = 'Pending' THEN 1 ELSE 0 END) as pending,
      COUNT(*) as total,
      ROUND(
        CAST(SUM(CASE WHEN won_lost = 'WON' THEN 1 ELSE 0 END) AS REAL) /
        NULLIF(SUM(CASE WHEN won_lost IN ('WON','Lost') THEN 1 ELSE 0 END), 0) * 100, 1
      ) as win_rate
    FROM tenders
    WHERE tender_id LIKE 'GEM/%'
    GROUP BY year
    ORDER BY year ASC
  `).all();
  return json(rows);
}

function analyticsBuyers() {
  const rows = db.query(`
    SELECT
      buyer_name,
      COUNT(*) as total_tenders,
      SUM(CASE WHEN won_lost = 'WON' THEN 1 ELSE 0 END) as won,
      COALESCE(SUM(CASE WHEN won_lost = 'WON' THEN order_value ELSE 0 END), 0) as total_value
    FROM tenders
    WHERE buyer_name IS NOT NULL
    GROUP BY buyer_name
    ORDER BY total_tenders DESC
    LIMIT 12
  `).all();
  return json(rows);
}

function analyticsCompetitors() {
  const rows = db.query(`
    SELECT
      l1_bidder_name,
      COUNT(*) as times_beat_us,
      ROUND(AVG(l1_bid_price), 0) as avg_l1_price,
      ROUND(AVG(our_bid_price), 0) as avg_our_price
    FROM tenders
    WHERE l1_bidder_name IS NOT NULL AND l1_bidder_name != '' AND won_lost = 'Lost'
    GROUP BY l1_bidder_name
    ORDER BY times_beat_us DESC
    LIMIT 10
  `).all();
  return json(rows);
}

function analyticsL1Gap() {
  const rows = db.query(`
    SELECT
      tender_id,
      buyer_name,
      our_bid_price,
      l1_bid_price,
      ROUND((our_bid_price - l1_bid_price) / l1_bid_price * 100, 1) as gap_pct,
      l1_bidder_name,
      substr(product_desc, 1, 40) as product_desc
    FROM tenders
    WHERE our_bid_price IS NOT NULL AND l1_bid_price IS NOT NULL
      AND our_bid_price > 0 AND l1_bid_price > 0
      AND won_lost = 'Lost'
    ORDER BY gap_pct ASC
    LIMIT 30
  `).all();
  return json(rows);
}

function analyticsPipeline() {
  const rows = db.query(`
    SELECT
      tender_id, buyer_name, product_desc, end_date, bid_status,
      our_bid_price, quantity, tender_type
    FROM tenders
    WHERE won_lost = 'Pending'
    ORDER BY end_date ASC
    LIMIT 25
  `).all();
  return json(rows);
}

function analyticsFunnel() {
  const rows = db.query(`
    SELECT
      REPLACE(REPLACE(REPLACE(bid_status, '💰 ',''), '✅ ',''), '🔚 ','') as bid_status,
      COUNT(*) as count
    FROM tenders
    WHERE bid_status IS NOT NULL
    GROUP BY REPLACE(REPLACE(REPLACE(bid_status, '💰 ',''), '✅ ',''), '🔚 ','')
    ORDER BY count DESC
  `).all();
  return json(rows);
}

function analyticsMonthly() {
  const rows = db.query(`
    SELECT
      substr(contract_date, 1, 7) as month,
      SUM(order_value) as total_value,
      COUNT(*) as contracts
    FROM tenders
    WHERE contract_date IS NOT NULL AND won_lost = 'WON' AND order_value IS NOT NULL
    GROUP BY substr(contract_date, 1, 7)
    ORDER BY month ASC
  `).all();
  return json(rows);
}

// ──────────────────────────────────────────────
// Sync (SQL executor)
// ──────────────────────────────────────────────
function executeSync(body: { sql: string }) {
  const { sql } = body;
  if (!sql?.trim()) return json({ error: "No SQL provided" }, 400);

  const check = isSafeSQL(sql);
  if (!check.safe) {
    db.query(
      "INSERT INTO sync_log (sql_text, status, error_message) VALUES ($sql, 'error', $err)"
    ).run({ $sql: sql, $err: check.reason });
    return json({ error: check.reason }, 400);
  }

  try {
    const statements = sql.split(";").map((s) => s.trim()).filter(Boolean);
    let totalAffected = 0;

    for (const stmt of statements) {
      const result = db.query(stmt).run();
      totalAffected += result.changes ?? 0;
    }

    db.query(
      "INSERT INTO sync_log (sql_text, status, affected_rows) VALUES ($sql, 'success', $rows)"
    ).run({ $sql: sql, $rows: totalAffected });

    return json({ success: true, affected_rows: totalAffected, message: `${totalAffected} row(s) updated` });
  } catch (e: any) {
    db.query(
      "INSERT INTO sync_log (sql_text, status, error_message) VALUES ($sql, 'error', $err)"
    ).run({ $sql: sql, $err: e.message });
    return json({ error: e.message }, 500);
  }
}

function getSyncHistory() {
  const rows = db.query(
    "SELECT * FROM sync_log ORDER BY executed_at DESC LIMIT 50"
  ).all();
  return json(rows);
}

// ──────────────────────────────────────────────
// Server
// ──────────────────────────────────────────────
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "OPTIONS") return cors();

    try {
      // Tenders
      if (path === "/api/tenders" && req.method === "GET") return getTenders(url);
      if (path === "/api/tenders" && req.method === "POST") return createTender(await req.json());
      if (/^\/api\/tenders\/\d+$/.test(path)) {
        const id = path.split("/")[3];
        if (req.method === "GET") return getTender(id);
        if (req.method === "PUT") return updateTender(id, await req.json());
        if (req.method === "DELETE") return deleteTender(id);
      }

      // Analytics
      if (path === "/api/analytics/overview") return analyticsOverview();
      if (path === "/api/analytics/yearly") return analyticsYearly();
      if (path === "/api/analytics/buyers") return analyticsBuyers();
      if (path === "/api/analytics/competitors") return analyticsCompetitors();
      if (path === "/api/analytics/l1gap") return analyticsL1Gap();
      if (path === "/api/analytics/pipeline") return analyticsPipeline();
      if (path === "/api/analytics/funnel") return analyticsFunnel();
      if (path === "/api/analytics/monthly") return analyticsMonthly();

      // Sync
      if (path === "/api/sync" && req.method === "POST") return executeSync(await req.json());
      if (path === "/api/sync/history" && req.method === "GET") return getSyncHistory();

      return json({ error: "Not found" }, 404);
    } catch (e: any) {
      console.error(e);
      return json({ error: e.message }, 500);
    }
  },
});

console.log(`🚀 TenderIQ API → http://localhost:${PORT}`);
