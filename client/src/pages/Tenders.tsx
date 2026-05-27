import { useEffect, useState, useCallback, type ReactNode } from "react";
import { Search, Plus, X, ChevronLeft, ChevronRight, Edit2, Trash2, Eye, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { api } from "../api";
import type { Tender, TenderStatus } from "../types";

// ── Helpers ──────────────────────────────────────────────────────────
function fmtRs(n: number | null) {
  if (!n) return "—";
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function bidGap(ours: number | null, l1: number | null): string {
  if (!ours || !l1 || l1 === 0) return "—";
  const pct = ((ours - l1) / l1) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}
function bidGapColor(ours: number | null, l1: number | null): string {
  if (!ours || !l1 || l1 === 0) return "text-slate-400";
  const pct = ((ours - l1) / l1) * 100;
  if (pct > 20) return "text-rose-600 font-semibold";
  if (pct > 5)  return "text-amber-600 font-medium";
  if (pct <= 0) return "text-emerald-600 font-medium";
  return "text-slate-600";
}

// ── Status Badge ──────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  "Submitted":            "bg-slate-100 text-slate-700",
  "Technical Evaluation": "bg-blue-100 text-blue-700",
  "Financial Evaluation": "bg-indigo-100 text-indigo-700",
  "Won":                  "bg-emerald-100 text-emerald-700",
  "Lost":                 "bg-rose-100 text-rose-700",
  "Disqualified":         "bg-orange-100 text-orange-700",
  "Cancelled":            "bg-gray-100 text-gray-600",
};

function StatusBadge({ v }: { v: TenderStatus | string | null }) {
  if (!v) return <span className="bg-gray-100 text-gray-400 text-[10px] font-medium px-2 py-0.5 rounded-full">—</span>;
  const cls = STATUS_COLORS[v] ?? "bg-slate-100 text-slate-600";
  return <span className={`${cls} text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap`}>{v}</span>;
}

// ── Sort helpers ──────────────────────────────────────────────────────
type SortKey = "tender_id" | "buyer_name" | "status" | "our_bid_price" | "l1_bid_price" | "end_date" | "gap_pct";
type SortDir = "asc" | "desc";

function sortIcon(col: SortKey, active: SortKey, dir: SortDir) {
  if (col !== active) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
  return dir === "asc" ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />;
}

function sortTenders(tenders: Tender[], key: SortKey, dir: SortDir): Tender[] {
  return [...tenders].sort((a, b) => {
    let av: any, bv: any;
    if (key === "gap_pct") {
      av = (a.our_bid_price && a.l1_bid_price) ? (a.our_bid_price - a.l1_bid_price) / a.l1_bid_price : -Infinity;
      bv = (b.our_bid_price && b.l1_bid_price) ? (b.our_bid_price - b.l1_bid_price) / b.l1_bid_price : -Infinity;
    } else {
      av = (a as any)[key] ?? "";
      bv = (b as any)[key] ?? "";
    }
    if (av < bv) return dir === "asc" ? -1 :  1;
    if (av > bv) return dir === "asc" ?  1 : -1;
    return 0;
  });
}

// ── CSV Export ────────────────────────────────────────────────────────
function exportCSV(tenders: Tender[]) {
  const headers = [
    "Tender ID","Type","Buyer","Consignee","Department","Ministry","Office",
    "Status","Product","Qty","Start Date","End Date",
    "Our Bid","L1 Bid","Bid Gap %","L1 Bidder","L2 Bid","L2 Bidder","Eval Method",
    "Contract No","Contract Date","Order Value","Contract Status",
    "Scheduled","Sched Product","Sched Our Bid","Sched L1 Bid","Sched L1 Bidder",
    "Remarks",
  ];
  const rows = tenders.map((t) => {
    const gap = t.our_bid_price && t.l1_bid_price
      ? ((t.our_bid_price - t.l1_bid_price) / t.l1_bid_price * 100).toFixed(1)
      : "";
    return [
      t.tender_id, t.tender_type, t.buyer_name, t.consignee_name, t.buyer_dept, t.ministry, t.office_name,
      t.status, t.product_desc, t.quantity, t.start_date, t.end_date,
      t.our_bid_price, t.l1_bid_price, gap, t.l1_bidder_name,
      t.l2_bid_price, t.l2_bidder_name, t.evaluation_method,
      t.contract_no, t.contract_date, t.order_value, t.contract_status,
      t.is_scheduled ? "Yes" : "No",
      t.scheduled_product_desc, t.scheduled_our_bid, t.scheduled_l1_bid, t.scheduled_l1_bidder,
      t.remarks,
    ].map((v) => {
      if (v == null) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tenders_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Status options ────────────────────────────────────────────────────
const STATUS_OPTIONS: TenderStatus[] = [
  "Submitted", "Technical Evaluation", "Financial Evaluation",
  "Won", "Lost", "Disqualified", "Cancelled",
];

// ── EMPTY defaults ────────────────────────────────────────────────────
const EMPTY: Partial<Tender> = {
  tender_id: "", tender_type: "BID",
  buyer_name: "", buyer_dept: "", ministry: "", office_name: "",
  consignee_name: "", consignee_address: "", buyer_same_as_consignee: 0,
  product_desc: "", quantity: undefined,
  status: "Submitted",
  start_date: "", end_date: "",
  our_bid_price: undefined, l1_bid_price: undefined, l1_bidder_name: "",
  l2_bid_price: undefined, l2_bidder_name: "",
  evaluation_method: "",
  is_scheduled: 0,
  schedule_count: 1,
  scheduled_product_desc: "", scheduled_our_bid: undefined,
  scheduled_l1_bid: undefined, scheduled_l1_bidder: "",
  contract_no: "", contract_date: "", order_value: undefined, contract_status: "",
  remarks: "",
};

// ── Section wrapper ───────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 pb-1 border-b border-slate-100">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Field component ───────────────────────────────────────────────────
function Field({
  label, value, onChange, disabled, type = "text", options, mono,
}: {
  label: string; value: any; onChange: (v: string) => void;
  disabled?: boolean; type?: string; options?: string[]; mono?: boolean;
}) {
  const base = `input text-sm ${mono ? "font-mono" : ""} ${disabled ? "bg-slate-50 text-slate-600 cursor-default" : ""}`;
  return (
    <div>
      {label && <label className="label">{label}</label>}
      {type === "select" ? (
        <select className={base} value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
          {options?.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea className={`${base} h-20 resize-none`} value={value || ""} disabled={disabled}
                  onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={base} type={type} value={value ?? ""} disabled={disabled}
               onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

// ── Tender Form Modal ─────────────────────────────────────────────────
function TenderModal({
  mode, tender, onClose, onSaved,
}: {
  mode: "add" | "edit" | "view";
  tender: Partial<Tender> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Tender>>(tender ? { ...EMPTY, ...tender } : { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (mode === "view" && tender?.id) {
      api.getTender(tender.id).then(({ history }) => setHistory(history));
    }
  }, [mode, tender]);

  const set = (k: keyof Tender, v: any) => {
    setForm((p) => {
      const next = { ...p, [k]: v };
      // When buyer_same_as_consignee is checked, copy consignee_name → buyer_name
      if (k === "buyer_same_as_consignee" && v === 1) {
        next.buyer_name = p.consignee_name ?? "";
      }
      // Keep buyer_name in sync while typing consignee_name (if checkbox on)
      if (k === "consignee_name" && p.buyer_same_as_consignee === 1) {
        next.buyer_name = v;
      }
      return next;
    });
  };

  async function handleSave() {
    if (!form.tender_id?.trim()) { setError("Tender ID is required"); return; }
    setSaving(true);
    setError("");
    try {
      if (mode === "add") {
        await api.createTender(form);
      } else if (mode === "edit" && tender?.id) {
        await api.updateTender(tender.id, form);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const isView      = mode === "view";
  const isWon       = form.status === "Won";
  const isScheduled = Boolean(form.is_scheduled);
  const title       = mode === "add" ? "Add Tender" : mode === "edit" ? "Edit Tender" : "Tender Detail";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {isView && form.our_bid_price && form.l1_bid_price && (
            <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              form.our_bid_price <= form.l1_bid_price
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700"
            }`}>
              Gap: {bidGap(form.our_bid_price, form.l1_bid_price)}
            </div>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">{error}</div>
          )}

          {/* ── Tender Info ── */}
          <Section title="Tender Info">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tender ID *" value={form.tender_id} onChange={(v) => set("tender_id", v)}
                     disabled={isView || mode === "edit"} mono />
              <Field label="Tender Type" value={form.tender_type} onChange={(v) => set("tender_type", v as any)}
                     disabled={isView} type="select" options={["BID", "RA"]} />
              <Field label="Status" value={form.status ?? "Submitted"}
                     onChange={(v) => set("status", v as TenderStatus)}
                     disabled={isView} type="select" options={STATUS_OPTIONS} />
              <Field label="Office Name" value={form.office_name} onChange={(v) => set("office_name", v)} disabled={isView} />
              <Field label="Start Date"  value={form.start_date} onChange={(v) => set("start_date", v)} disabled={isView} type="date" />
              <Field label="End Date"    value={form.end_date}   onChange={(v) => set("end_date", v)}   disabled={isView} type="date" />
            </div>
          </Section>

          {/* ── Buyer & Consignee ── */}
          <Section title="Buyer & Consignee">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="buyer_same"
                  checked={Boolean(form.buyer_same_as_consignee)}
                  disabled={isView}
                  onChange={(e) => set("buyer_same_as_consignee", e.target.checked ? 1 : 0)}
                  className="w-3.5 h-3.5 accent-indigo-600"
                />
                <label htmlFor="buyer_same" className="text-xs text-slate-600 cursor-pointer select-none">
                  Buyer is same as Consignee
                </label>
              </div>
              <Field label="Consignee Name" value={form.consignee_name}
                     onChange={(v) => set("consignee_name", v)} disabled={isView} />
              <Field label="Buyer Name" value={form.buyer_name}
                     onChange={(v) => set("buyer_name", v)}
                     disabled={isView || Boolean(form.buyer_same_as_consignee)} />
              <div className="col-span-2">
                <Field label="Consignee Address" value={form.consignee_address}
                       onChange={(v) => set("consignee_address", v)} disabled={isView} type="textarea" />
              </div>
              <Field label="Department" value={form.buyer_dept}  onChange={(v) => set("buyer_dept", v)}  disabled={isView} />
              <Field label="Ministry"   value={form.ministry}    onChange={(v) => set("ministry", v)}    disabled={isView} />
            </div>
          </Section>

          {/* ── Product ── */}
          <Section title="Product">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="Product Description" value={form.product_desc}
                       onChange={(v) => set("product_desc", v)} disabled={isView} type="textarea" />
              </div>
              <Field label="Quantity"          value={form.quantity}           onChange={(v) => set("quantity", Number(v))} disabled={isView} type="number" />
              <Field label="Evaluation Method" value={form.evaluation_method} onChange={(v) => set("evaluation_method", v)} disabled={isView} />
            </div>
          </Section>

          {/* ── Bid Details ── */}
          <Section title="Bid Details">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Our Bid (₹)" value={form.our_bid_price}  onChange={(v) => set("our_bid_price",  Number(v))} disabled={isView} type="number" />
              <Field label="L1 Bid (₹)"  value={form.l1_bid_price}   onChange={(v) => set("l1_bid_price",   Number(v))} disabled={isView} type="number" />
              <Field label="L1 Bidder"   value={form.l1_bidder_name} onChange={(v) => set("l1_bidder_name", v)}         disabled={isView} />
              <Field label="L2 Bid (₹)"  value={form.l2_bid_price}   onChange={(v) => set("l2_bid_price",   Number(v))} disabled={isView} type="number" />
              <Field label="L2 Bidder"   value={form.l2_bidder_name} onChange={(v) => set("l2_bidder_name", v)}         disabled={isView} />
            </div>
          </Section>

          {/* ── Scheduled Tender ── */}
          <Section title="Scheduled Tender">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_scheduled"
                  checked={isScheduled}
                  disabled={isView}
                  onChange={(e) => set("is_scheduled", e.target.checked ? 1 : 0)}
                  className="w-3.5 h-3.5 accent-indigo-600"
                />
                <label htmlFor="is_scheduled" className="text-xs text-slate-600 cursor-pointer select-none">
                  This is a scheduled / GeM comparison tender
                </label>
              </div>
              {isScheduled && (
                <div className="pl-5 border-l-2 border-indigo-100">
                  <Field
                    label="Number of Schedules"
                    value={form.schedule_count ?? 1}
                    onChange={(v) => set("schedule_count", Number(v))}
                    disabled={isView}
                    type="select"
                    options={["1","2","3","4","5","6","7","8","9","10"]}
                  />
                </div>
              )}
            </div>
          </Section>

          {/* ── Contract (Won only) ── */}
          {form.status === "Won" && (
            <Section title="Contract">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Contract No."    value={form.contract_no}     onChange={(v) => set("contract_no", v)}         disabled={isView} />
                <Field label="Contract Date"   value={form.contract_date}   onChange={(v) => set("contract_date", v)}       disabled={isView} type="date" />
                <Field label="Order Value (₹)" value={form.order_value}     onChange={(v) => set("order_value", Number(v))} disabled={isView} type="number" />
                <Field label="Contract Status" value={form.contract_status} onChange={(v) => set("contract_status", v)}     disabled={isView} />
              </div>
            </Section>
          )}

          {/* ── Remarks ── */}
          <Section title="Remarks">
            <Field label="" value={form.remarks} onChange={(v) => set("remarks", v)} disabled={isView} type="textarea" />
          </Section>

          {/* ── History ── */}
          {isView && history.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Change History</h3>
              <div className="space-y-1.5">
                {history.map((h) => (
                  <div key={h.id} className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-2">
                    <span className="flex-shrink-0 text-slate-400">{h.created_at?.substring(0, 16)}</span>
                    <span className="font-medium text-slate-700">{h.field_changed}</span>
                    <span>{h.old_value} → <span className="text-indigo-600">{h.new_value}</span></span>
                    <span className="ml-auto bg-slate-200 text-slate-600 text-[10px] font-medium px-1.5 py-0.5 rounded">{h.source}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isView && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? "Saving…" : mode === "add" ? "Add Tender" : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sortable TH ───────────────────────────────────────────────────────
function SortTh({
  label, col, active, dir, onClick, className = "",
}: {
  label: string; col: SortKey; active: SortKey; dir: SortDir;
  onClick: (c: SortKey) => void; className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 ${className}`}
      onClick={() => onClick(col)}
    >
      <span className="flex items-center gap-1">{label} {sortIcon(col, active, dir)}</span>
    </th>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function Tenders() {
  const [tenders,         setTenders]         = useState<Tender[]>([]);
  const [total,           setTotal]           = useState(0);
  const [page,            setPage]            = useState(1);
  const [loading,         setLoading]         = useState(true);
  const [search,          setSearch]          = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter,    setStatusFilter]    = useState("");
  const [year,            setYear]            = useState("");
  const [ministry,        setMinistry]        = useState("");
  const [modal,           setModal]           = useState<{ mode: "add"|"edit"|"view"; tender: Partial<Tender>|null } | null>(null);
  const [deleteId,        setDeleteId]        = useState<number | null>(null);
  const [sortKey,         setSortKey]         = useState<SortKey>("tender_id");
  const [sortDir,         setSortDir]         = useState<SortDir>("desc");

  const LIMIT = 20;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: String(LIMIT) };
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter)    params.status = statusFilter;
    if (year)            params.year   = year;
    try {
      const { tenders, total } = await api.getTenders(params);
      setTenders(tenders);
      setTotal(total);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, year]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, year]);

  async function handleDelete(id: number) {
    await api.deleteTender(id);
    setDeleteId(null);
    load();
  }

  function handleSort(col: SortKey) {
    if (col === sortKey) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(col); setSortDir("asc"); }
  }

  const totalPages = Math.ceil(total / LIMIT);

  // Client-side ministry filter (over the current page results)
  const ministries = [...new Set(tenders.map((t) => t.ministry).filter(Boolean) as string[])].sort();
  const filteredAndSorted = sortTenders(
    ministry ? tenders.filter((t) => t.ministry === ministry) : tenders,
    sortKey,
    sortDir,
  );

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tenders</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} records total</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCSV(filteredAndSorted)}
            className="btn-secondary flex items-center gap-1.5 text-xs"
            title="Export current view as CSV"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button onClick={() => setModal({ mode: "add", tender: null })} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Tender
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9 text-sm"
            placeholder="Search tender ID, buyer, product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-48 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input w-28 text-sm" value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">All Years</option>
          {["2022","2023","2024","2025","2026"].map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
        <select className="input w-44 text-sm" value={ministry} onChange={(e) => setMinistry(e.target.value)}>
          <option value="">All Ministries</option>
          {ministries.map((m) => <option key={m} value={m}>{m.length > 28 ? m.substring(0,28)+"…" : m}</option>)}
        </select>
        {(search || statusFilter || year || ministry) && (
          <button
            onClick={() => { setSearch(""); setStatusFilter(""); setYear(""); setMinistry(""); }}
            className="btn-secondary text-xs gap-1"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
        {ministry && (
          <span className="text-xs text-slate-500 ml-auto">
            {filteredAndSorted.length} of {tenders.length} shown
          </span>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-200">
                <SortTh label="Tender ID" col="tender_id"    active={sortKey} dir={sortDir} onClick={handleSort} />
                <SortTh label="Buyer"     col="buyer_name"   active={sortKey} dir={sortDir} onClick={handleSort} />
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-48">Product</th>
                <SortTh label="Status"    col="status"       active={sortKey} dir={sortDir} onClick={handleSort} />
                <SortTh label="Our Bid"   col="our_bid_price" active={sortKey} dir={sortDir} onClick={handleSort} className="text-right" />
                <SortTh label="L1 Bid"    col="l1_bid_price"  active={sortKey} dir={sortDir} onClick={handleSort} className="text-right" />
                <SortTh label="Gap %"     col="gap_pct"       active={sortKey} dir={sortDir} onClick={handleSort} className="text-right" />
                <SortTh label="End Date"  col="end_date"      active={sortKey} dir={sortDir} onClick={handleSort} />
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400 text-sm">Loading…</td></tr>
              ) : filteredAndSorted.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400 text-sm">No tenders found</td></tr>
              ) : filteredAndSorted.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-indigo-700 font-medium whitespace-nowrap">
                    {t.tender_id?.substring(0, 22)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700 max-w-[160px]">
                    <p className="truncate">{t.buyer_name || "—"}</p>
                    {t.ministry && <p className="text-slate-400 truncate text-[10px]">{t.ministry}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 w-48 truncate max-w-[180px]">
                    {t.product_desc?.substring(0, 45) || "—"}
                  </td>
                  <td className="px-4 py-3"><StatusBadge v={t.status} /></td>
                  <td className="px-4 py-3 text-xs text-right text-slate-700 font-medium">{fmtRs(t.our_bid_price)}</td>
                  <td className="px-4 py-3 text-xs text-right text-emerald-700 font-medium">{fmtRs(t.l1_bid_price)}</td>
                  <td className={`px-4 py-3 text-xs text-right ${bidGapColor(t.our_bid_price, t.l1_bid_price)}`}>
                    {bidGap(t.our_bid_price, t.l1_bid_price)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(t.end_date)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setModal({ mode: "view", tender: t })}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors" title="View">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setModal({ mode: "edit", tender: t })}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-600 transition-colors" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(t.id)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-rose-600 transition-colors" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = page <= 4 ? i + 1
                  : page >= totalPages - 3 ? totalPages - 6 + i
                  : page - 3 + i;
                if (p < 1 || p > totalPages) return null;
                return (
                  <button key={p} onClick={() => setPage(p)}
                          className={`w-7 h-7 text-xs rounded-lg ${p === page
                            ? "bg-indigo-600 text-white font-semibold"
                            : "border border-slate-200 hover:bg-slate-50 text-slate-600"}`}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tender Modal */}
      {modal && (
        <TenderModal
          mode={modal.mode}
          tender={modal.tender}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card p-6 w-80 shadow-2xl">
            <h3 className="font-semibold text-slate-900 text-sm">Delete Tender?</h3>
            <p className="text-slate-500 text-xs mt-1 mb-4">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteId(null)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="btn-danger text-xs">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
