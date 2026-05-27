import { useState, useCallback, useRef } from "react";
import { X, Upload, FileText, CheckCircle, AlertCircle, ArrowRight, Info } from "lucide-react";
import { api } from "../api";
import type { Tender, BulkImportResult } from "../types";

// ── CSV Parser ────────────────────────────────────────────────────────
function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n");
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCSVRow(lines[0]);
  const rows = lines.slice(1).filter((l) => l.trim()).map(parseCSVRow);
  return { headers, rows };
}

// ── Field definitions ─────────────────────────────────────────────────
const IMPORTABLE_FIELDS = [
  { value: "",                  label: "— Skip —" },
  { value: "tender_id",         label: "Tender ID *" },
  { value: "tender_type",       label: "Type (BID/RA)" },
  { value: "status",            label: "Status" },
  { value: "buyer_name",        label: "Buyer Name" },
  { value: "buyer_dept",        label: "Department" },
  { value: "ministry",          label: "Ministry" },
  { value: "office_name",       label: "Office Name" },
  { value: "consignee_name",    label: "Consignee Name" },
  { value: "product_desc",      label: "Product Description" },
  { value: "quantity",          label: "Quantity" },
  { value: "start_date",        label: "Start Date (YYYY-MM-DD)" },
  { value: "end_date",          label: "End Date (YYYY-MM-DD)" },
  { value: "our_bid_price",     label: "Our Bid Price (₹)" },
  { value: "l1_bid_price",      label: "L1 Bid Price (₹)" },
  { value: "l1_bidder_name",    label: "L1 Bidder Name" },
  { value: "l2_bid_price",      label: "L2 Bid Price (₹)" },
  { value: "l2_bidder_name",    label: "L2 Bidder Name" },
  { value: "evaluation_method", label: "Evaluation Method" },
  { value: "contract_no",       label: "Contract No." },
  { value: "contract_date",     label: "Contract Date (YYYY-MM-DD)" },
  { value: "order_value",       label: "Order Value (₹)" },
  { value: "contract_status",   label: "Contract Status" },
  { value: "remarks",           label: "Remarks" },
];

const NUMERIC_FIELDS = new Set([
  "quantity", "our_bid_price", "l1_bid_price", "l2_bid_price", "order_value",
  "scheduled_our_bid", "scheduled_l1_bid",
]);

// ── Auto-detect: map common CSV header text → tender field ───────────
const FIELD_ALIASES: Record<string, string> = {
  // Tender ID
  "tender id": "tender_id", "tenderid": "tender_id", "gem id": "tender_id",
  "gem tender id": "tender_id", "bid no": "tender_id", "bid number": "tender_id",
  "tender no": "tender_id", "tender number": "tender_id",
  // Type
  "type": "tender_type", "tender type": "tender_type",
  // Status
  "status": "status", "bid status": "status",
  // Buyer
  "buyer": "buyer_name", "buyer name": "buyer_name", "purchaser": "buyer_name",
  // Dept / Ministry
  "department": "buyer_dept", "dept": "buyer_dept", "buyer dept": "buyer_dept",
  "ministry": "ministry",
  // Office / Consignee
  "office": "office_name", "office name": "office_name",
  "consignee": "consignee_name", "consignee name": "consignee_name",
  // Product
  "product": "product_desc", "product description": "product_desc",
  "description": "product_desc", "item": "product_desc", "item description": "product_desc",
  // Quantity
  "qty": "quantity", "quantity": "quantity",
  // Dates
  "start date": "start_date", "bid start": "start_date", "start": "start_date",
  "end date": "end_date", "bid end": "end_date", "closing date": "end_date",
  "end": "end_date", "deadline": "end_date",
  // Bid prices
  "our bid": "our_bid_price", "our bid price": "our_bid_price",
  "our price": "our_bid_price", "quoted price": "our_bid_price", "quoted": "our_bid_price",
  "l1 bid": "l1_bid_price", "l1 price": "l1_bid_price", "l1 bid price": "l1_bid_price",
  "l1 bidder": "l1_bidder_name", "l1 bidder name": "l1_bidder_name", "l1 winner": "l1_bidder_name",
  "l2 bid": "l2_bid_price", "l2 price": "l2_bid_price", "l2 bid price": "l2_bid_price",
  "l2 bidder": "l2_bidder_name", "l2 bidder name": "l2_bidder_name",
  // Evaluation
  "evaluation method": "evaluation_method", "eval method": "evaluation_method",
  "evaluation": "evaluation_method",
  // Contract
  "contract no": "contract_no", "contract number": "contract_no", "contract": "contract_no",
  "contract date": "contract_date",
  "order value": "order_value", "contract value": "order_value",
  "contract status": "contract_status",
  // Misc
  "remarks": "remarks", "notes": "remarks", "comment": "remarks", "comments": "remarks",
};

function autoDetect(header: string): string {
  const key = header.toLowerCase().replace(/[_\-\/]/g, " ").trim();
  return FIELD_ALIASES[key] ?? "";
}

// ── Component ─────────────────────────────────────────────────────────
type Step = "upload" | "map" | "result";

export function ImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [step,      setStep]      = useState<Step>("upload");
  const [dragging,  setDragging]  = useState(false);
  const [fileName,  setFileName]  = useState("");
  const [headers,   setHeaders]   = useState<string[]>([]);
  const [rows,      setRows]      = useState<string[][]>([]);
  const [mapping,   setMapping]   = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);
  const [result,    setResult]    = useState<BulkImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function processFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: h, rows: r } = parseCSV(text);
      if (h.length === 0) return;
      setHeaders(h);
      setRows(r);
      const autoMap: Record<number, string> = {};
      h.forEach((col, i) => { autoMap[i] = autoDetect(col); });
      setMapping(autoMap);
      setStep("map");
    };
    reader.readAsText(file);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  async function handleImport() {
    // Build payload — one object per row using the column mapping
    const payload: Partial<Tender>[] = rows
      .map((row) => {
        const obj: Record<string, any> = {};
        headers.forEach((_, i) => {
          const field = mapping[i];
          if (!field) return;
          let val: any = row[i] ?? "";
          if (val === "") return;
          if (NUMERIC_FIELDS.has(field)) {
            const n = parseFloat(String(val).replace(/[₹,\s]/g, ""));
            if (!isNaN(n)) val = n;
            else return;
          }
          obj[field] = val;
        });
        return obj;
      })
      .filter((obj) => Boolean(obj.tender_id));

    if (payload.length === 0) {
      setResult({ inserted: 0, skipped: rows.length, errors: ["No rows had a valid Tender ID — make sure 'Tender ID' column is mapped."] });
      setStep("result");
      return;
    }

    setImporting(true);
    try {
      const res = await api.bulkImportTenders(payload);
      setResult(res);
      setStep("result");
      if (res.inserted > 0) onImported();
    } catch (e: any) {
      setResult({ inserted: 0, skipped: 0, errors: [e.message] });
      setStep("result");
    } finally {
      setImporting(false);
    }
  }

  const mappedCount       = Object.values(mapping).filter(Boolean).length;
  const hasTenderIdMapped = Object.values(mapping).includes("tender_id");

  // Unique mapped fields in declaration order (for preview table headers)
  const mappedFields = IMPORTABLE_FIELDS.filter(
    (f) => f.value && Object.values(mapping).includes(f.value)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-slate-900">Bulk Import</h2>
            <div className="flex items-center gap-1.5 text-xs">
              {(["upload", "map", "result"] as Step[]).map((s, i, arr) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className={
                    step === s
                      ? "text-indigo-600 font-semibold"
                      : arr.indexOf(step) > i ? "text-slate-400 line-through" : "text-slate-400"
                  }>
                    {s === "upload" ? "Upload" : s === "map" ? "Map Columns" : "Result"}
                  </span>
                  {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-slate-300" />}
                </span>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-5">

          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Upload a CSV file to import tenders in bulk.
                <span className="text-slate-400"> (Excel users: save as CSV first.)</span>
              </p>

              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer select-none ${
                  dragging
                    ? "border-indigo-400 bg-indigo-50 scale-[1.01]"
                    : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">Drop CSV here or click to browse</p>
                <p className="text-xs text-slate-400 mt-1">Supports .csv, .tsv, .txt</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
                />
              </div>

              {/* Tips */}
              <div className="bg-slate-50 rounded-lg p-3 flex gap-2.5">
                <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1">Tips</p>
                  <ul className="text-xs text-slate-500 space-y-0.5 list-disc list-inside">
                    <li>First row must be column headers</li>
                    <li>Tender ID is required for each row — duplicates are skipped automatically</li>
                    <li>Dates should be in <span className="font-mono">YYYY-MM-DD</span> format</li>
                    <li>Prices: plain numbers (₹ symbol and commas are stripped)</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Map Columns */}
          {step === "map" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    {fileName}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {rows.length} rows · {headers.length} columns detected · {mappedCount} mapped
                  </p>
                </div>
                {!hasTenderIdMapped && (
                  <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-1">
                    ⚠ Map "Tender ID" to enable import
                  </span>
                )}
              </div>

              {/* Column mapping table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-2 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200">
                  <span>CSV Column → Sample Value</span>
                  <span>Maps To</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                  {headers.map((h, i) => (
                    <div key={i} className="grid grid-cols-2 items-center px-3 py-2 gap-3 hover:bg-slate-50">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">{h}</p>
                        <p className="text-[10px] text-slate-400 truncate font-mono">
                          {rows[0]?.[i] ? rows[0][i].substring(0, 30) : "—"}
                        </p>
                      </div>
                      <select
                        className="input text-xs py-1"
                        value={mapping[i] ?? ""}
                        onChange={(e) => setMapping((m) => ({ ...m, [i]: e.target.value }))}
                      >
                        {IMPORTABLE_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data preview */}
              {rows.length > 0 && hasTenderIdMapped && mappedFields.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5">Preview (first 3 rows)</p>
                  <div className="border border-slate-200 rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          {mappedFields.map((f) => (
                            <th key={f.value} className="px-2 py-1.5 text-left font-semibold text-slate-500 whitespace-nowrap">
                              {f.label.replace(" *", "").split(" (")[0]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.slice(0, 3).map((row, ri) => (
                          <tr key={ri} className="hover:bg-slate-50">
                            {mappedFields.map((f) => {
                              // Find first CSV column mapped to this field
                              const colIdx = Object.entries(mapping)
                                .find(([, v]) => v === f.value)?.[0];
                              const val = colIdx !== undefined ? row[Number(colIdx)] : "";
                              return (
                                <td key={f.value} className="px-2 py-1.5 text-slate-600 max-w-[120px] truncate whitespace-nowrap font-mono">
                                  {val || <span className="text-slate-300">—</span>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Result */}
          {step === "result" && result && (
            <div className="space-y-4 py-2">
              <div className="text-center py-2">
                {result.inserted > 0 ? (
                  <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                ) : (
                  <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                )}
                <h3 className="font-semibold text-slate-900 text-lg">Import Complete</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {result.inserted > 0
                    ? `${result.inserted} tender${result.inserted !== 1 ? "s" : ""} added successfully.`
                    : "No new tenders were imported."}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{result.inserted}</p>
                  <p className="text-xs text-emerald-600 mt-0.5 font-medium">Imported</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
                  <p className="text-xs text-amber-600 mt-0.5 font-medium">Skipped</p>
                </div>
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-rose-700">{result.errors.length}</p>
                  <p className="text-xs text-rose-600 mt-0.5 font-medium">Errors</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-rose-700 mb-1.5">Error details</p>
                  <ul className="space-y-0.5 max-h-32 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <li key={i} className="text-xs text-rose-600 font-mono">{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.skipped > 0 && result.errors.length === 0 && (
                <p className="text-xs text-slate-400 text-center">
                  Skipped rows had duplicate Tender IDs or were missing a Tender ID.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
          <div className="text-xs text-slate-400">
            {step === "map" && rows.length > 0 && (
              <span>{rows.length} rows ready to import</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {step === "upload" && (
              <button onClick={onClose} className="btn-secondary">Cancel</button>
            )}
            {step === "map" && (
              <>
                <button onClick={() => setStep("upload")} className="btn-secondary">
                  ← Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || !hasTenderIdMapped}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? "Importing…" : `Import ${rows.length} rows`}
                </button>
              </>
            )}
            {step === "result" && (
              <>
                {result && result.inserted < rows.length && (
                  <button onClick={() => setStep("upload")} className="btn-secondary">
                    Import Another File
                  </button>
                )}
                <button onClick={onClose} className="btn-primary">Done</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
