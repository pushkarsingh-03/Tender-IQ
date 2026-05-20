import { db, initDb } from "./db";
import * as XLSX from "xlsx";
import { join } from "path";

initDb();

const FILE = join(import.meta.dir, "TENDER FILE.xlsx");
const wb = XLSX.readFile(FILE, { cellDates: true });
const ws = wb.Sheets["Tender Database"];

const rows = XLSX.utils.sheet_to_json(ws, {
  header: 1,
  raw: true,
  defval: null,
}) as any[][];

// Skip header row
const data = rows.slice(1).filter((r) => r[0] != null && r[1] != null);

function fmtDate(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof val === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  if (typeof val === "string") {
    // DD-MM-YYYY or DD/MM/YYYY
    const parts = val.trim().split(/[-\/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) return val; // already YYYY-*
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
    return val;
  }
  return null;
}

function fmtNum(val: any): number | null {
  if (val == null || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function fmtStr(val: any): string | null {
  if (val == null || val === "") return null;
  return String(val).trim();
}

const insert = db.prepare(`
  INSERT OR REPLACE INTO tenders (
    tender_id, tender_type, buyer_name, buyer_dept, ministry,
    product_desc, quantity, won_lost, bid_status, start_date, end_date,
    remarks, our_bid_price, l1_bid_price, l1_bidder_name, consignee_address,
    contract_no, contract_date, order_value, contract_status,
    office_name, evaluation_method
  ) VALUES (
    $tender_id, $tender_type, $buyer_name, $buyer_dept, $ministry,
    $product_desc, $quantity, $won_lost, $bid_status, $start_date, $end_date,
    $remarks, $our_bid_price, $l1_bid_price, $l1_bidder_name, $consignee_address,
    $contract_no, $contract_date, $order_value, $contract_status,
    $office_name, $evaluation_method
  )
`);

let count = 0;
let skipped = 0;

for (const row of data) {
  const [
    _sno, tender_id, tender_type, buyer_name, buyer_dept, ministry,
    product_desc, quantity, won_lost, bid_status, start_date, end_date,
    remarks, our_bid_price, l1_bid_price, l1_bidder_name, consignee_address,
    contract_no, contract_date, order_value, contract_status,
    office_name, evaluation_method,
  ] = row;

  if (!tender_id) { skipped++; continue; }

  try {
    insert.run({
      $tender_id:         fmtStr(tender_id),
      $tender_type:       fmtStr(tender_type) || "BID",
      $buyer_name:        fmtStr(buyer_name),
      $buyer_dept:        fmtStr(buyer_dept),
      $ministry:          fmtStr(ministry),
      $product_desc:      fmtStr(product_desc),
      $quantity:          fmtNum(quantity),
      $won_lost:          fmtStr(won_lost),
      $bid_status:        fmtStr(bid_status),
      $start_date:        fmtDate(start_date),
      $end_date:          fmtDate(end_date),
      $remarks:           fmtStr(remarks),
      $our_bid_price:     fmtNum(our_bid_price),
      $l1_bid_price:      fmtNum(l1_bid_price),
      $l1_bidder_name:    fmtStr(l1_bidder_name),
      $consignee_address: fmtStr(consignee_address),
      $contract_no:       fmtStr(contract_no),
      $contract_date:     fmtDate(contract_date),
      $order_value:       fmtNum(order_value),
      $contract_status:   fmtStr(contract_status),
      $office_name:       fmtStr(office_name),
      $evaluation_method: fmtStr(evaluation_method),
    });
    count++;
  } catch (e: any) {
    console.warn(`  ⚠ Skipped row (${tender_id}): ${e.message}`);
    skipped++;
  }
}

// Also import Won Orders Detail sheet
const ws2 = wb.Sheets["Won Orders Detail"];
if (ws2) {
  const wonRows = XLSX.utils.sheet_to_json(ws2, { header: 1, raw: true, defval: null }) as any[][];
  for (const row of wonRows.slice(1)) {
    if (!row[1]) continue;
    // Update contract fields for won orders
    try {
      db.query(`
        UPDATE tenders SET
          contract_no     = COALESCE(contract_no, $contract_no),
          contract_date   = COALESCE(contract_date, $contract_date),
          order_value     = COALESCE(order_value, $order_value),
          contract_status = COALESCE(contract_status, $contract_status)
        WHERE tender_id = $tid
      `).run({
        $tid:             fmtStr(row[1]),
        $contract_no:     fmtStr(row[7]),
        $contract_date:   fmtDate(row[8]),
        $order_value:     fmtNum(row[9]),
        $contract_status: fmtStr(row[10]),
      });
    } catch (_) {}
  }
}

console.log(`\n✅ Migration complete`);
console.log(`   Imported : ${count} tenders`);
console.log(`   Skipped  : ${skipped} rows`);

const stats = db.query(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN won_lost='WON'     THEN 1 ELSE 0 END) as won,
    SUM(CASE WHEN won_lost='Lost'    THEN 1 ELSE 0 END) as lost,
    SUM(CASE WHEN won_lost='Pending' THEN 1 ELSE 0 END) as pending
  FROM tenders
`).get() as any;
console.log(`   DB stats  : ${stats.total} total | ${stats.won} WON | ${stats.lost} Lost | ${stats.pending} Pending`);
