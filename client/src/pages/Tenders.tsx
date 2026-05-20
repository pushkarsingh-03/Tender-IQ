import { useEffect, useState, useCallback } from "react";
import { Search, Plus, X, ChevronLeft, ChevronRight, Edit2, Trash2, Eye } from "lucide-react";
import { api } from "../api";
import type { Tender } from "../types";

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

function StatusBadge({ v }: { v: string | null }) {
  if (!v) return <span className="badge-cancelled">—</span>;
  if (v === "WON")       return <span className="badge-won">WON</span>;
  if (v === "Lost")      return <span className="badge-lost">Lost</span>;
  if (v === "Pending")   return <span className="badge-pending">Pending</span>;
  if (v === "Cancelled") return <span className="badge-cancelled">Cancelled</span>;
  return <span className="badge-cancelled">{v}</span>;
}

// ── Tender Form Modal ─────────────────────────────────────────────────
const EMPTY: Partial<Tender> = {
  tender_id: "", tender_type: "BID", buyer_name: "", buyer_dept: "", ministry: "",
  product_desc: "", quantity: undefined, won_lost: "Pending" as any, bid_status: "",
  start_date: "", end_date: "", remarks: "", our_bid_price: undefined,
  l1_bid_price: undefined, l1_bidder_name: "", consignee_address: "",
  contract_no: "", contract_date: "", order_value: undefined,
  contract_status: "", office_name: "", evaluation_method: "",
};

function TenderModal({
  mode, tender, onClose, onSaved,
}: {
  mode: "add" | "edit" | "view";
  tender: Partial<Tender> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Tender>>(tender || EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (mode === "view" && tender?.id) {
      api.getTender(tender.id).then(({ history }) => setHistory(history));
    }
  }, [mode, tender]);

  const set = (k: keyof Tender, v: any) => setForm((p) => ({ ...p, [k]: v }));

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

  const isView = mode === "view";
  const title = mode === "add" ? "Add Tender" : mode === "edit" ? "Edit Tender" : "Tender Detail";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Tender ID *" value={form.tender_id} onChange={(v) => set("tender_id", v)}
                   disabled={isView || mode === "edit"} mono />
            <Field label="Tender Type" value={form.tender_type} onChange={(v) => set("tender_type", v as any)}
                   disabled={isView} type="select" options={["BID", "RA"]} />
            <Field label="Buyer Name" value={form.buyer_name}   onChange={(v) => set("buyer_name", v)} disabled={isView} />
            <Field label="Department"  value={form.buyer_dept}  onChange={(v) => set("buyer_dept", v)} disabled={isView} />
            <Field label="Ministry"    value={form.ministry}    onChange={(v) => set("ministry", v)}   disabled={isView} />
            <Field label="Status" value={form.won_lost} onChange={(v) => set("won_lost", v as any)}
                   disabled={isView} type="select" options={["Pending", "WON", "Lost", "Cancelled"]} />
            <div className="col-span-2">
              <Field label="Product Description" value={form.product_desc} onChange={(v) => set("product_desc", v)}
                     disabled={isView} type="textarea" />
            </div>
            <Field label="Quantity"     value={form.quantity}      onChange={(v) => set("quantity", Number(v))} disabled={isView} type="number" />
            <Field label="Bid Status"   value={form.bid_status}    onChange={(v) => set("bid_status", v)}   disabled={isView} />
            <Field label="Start Date"   value={form.start_date}    onChange={(v) => set("start_date", v)}   disabled={isView} type="date" />
            <Field label="End Date"     value={form.end_date}      onChange={(v) => set("end_date", v)}     disabled={isView} type="date" />
            <Field label="Our Bid (₹)"  value={form.our_bid_price} onChange={(v) => set("our_bid_price", Number(v))} disabled={isView} type="number" />
            <Field label="L1 Bid (₹)"   value={form.l1_bid_price}  onChange={(v) => set("l1_bid_price", Number(v))}  disabled={isView} type="number" />
            <Field label="L1 Bidder"    value={form.l1_bidder_name} onChange={(v) => set("l1_bidder_name", v)} disabled={isView} />
            <Field label="Eval Method"  value={form.evaluation_method} onChange={(v) => set("evaluation_method", v)} disabled={isView} />
            <div className="col-span-2">
              <Field label="Consignee Address" value={form.consignee_address} onChange={(v) => set("consignee_address", v)}
                     disabled={isView} type="textarea" />
            </div>
            <Field label="Contract No."   value={form.contract_no}     onChange={(v) => set("contract_no", v)}    disabled={isView} />
            <Field label="Contract Date"  value={form.contract_date}   onChange={(v) => set("contract_date", v)}  disabled={isView} type="date" />
            <Field label="Order Value (₹)" value={form.order_value}    onChange={(v) => set("order_value", Number(v))} disabled={isView} type="number" />
            <Field label="Contract Status" value={form.contract_status} onChange={(v) => set("contract_status", v)} disabled={isView} />
            <div className="col-span-2">
              <Field label="Remarks" value={form.remarks} onChange={(v) => set("remarks", v)}
                     disabled={isView} type="textarea" />
            </div>
          </div>

          {/* History */}
          {isView && history.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Change History</h3>
              <div className="space-y-1.5">
                {history.map((h) => (
                  <div key={h.id} className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-2">
                    <span className="flex-shrink-0 text-slate-400">{h.created_at?.substring(0, 16)}</span>
                    <span className="font-medium text-slate-700">{h.field_changed}</span>
                    <span>{h.old_value} → <span className="text-indigo-600">{h.new_value}</span></span>
                    <span className="ml-auto badge-cancelled text-xs">{h.source}</span>
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

function Field({
  label, value, onChange, disabled, type = "text", options, mono,
}: {
  label: string; value: any; onChange: (v: string) => void;
  disabled?: boolean; type?: string; options?: string[]; mono?: boolean;
}) {
  const base = `input text-sm ${mono ? "font-mono" : ""} ${disabled ? "bg-slate-50 text-slate-600 cursor-default" : ""}`;
  return (
    <div>
      <label className="label">{label}</label>
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

// ── Main Page ─────────────────────────────────────────────────────────
export default function Tenders() {
  const [tenders,  setTenders]  = useState<Tender[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [wonLost,  setWonLost]  = useState("");
  const [year,     setYear]     = useState("");
  const [modal,    setModal]    = useState<{ mode: "add"|"edit"|"view"; tender: Partial<Tender>|null } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const LIMIT = 20;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: String(LIMIT) };
    if (debouncedSearch) params.search = debouncedSearch;
    if (wonLost) params.won_lost = wonLost;
    if (year)    params.year    = year;
    try {
      const { tenders, total } = await api.getTenders(params);
      setTenders(tenders);
      setTotal(total);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, wonLost, year]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, wonLost, year]);

  async function handleDelete(id: number) {
    await api.deleteTender(id);
    setDeleteId(null);
    load();
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tenders</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} records total</p>
        </div>
        <button onClick={() => setModal({ mode: "add", tender: null })} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Tender
        </button>
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
        <select className="input w-36 text-sm" value={wonLost} onChange={(e) => setWonLost(e.target.value)}>
          <option value="">All Status</option>
          <option>WON</option>
          <option>Lost</option>
          <option>Pending</option>
          <option>Cancelled</option>
        </select>
        <select className="input w-28 text-sm" value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">All Years</option>
          {["2022","2023","2024","2025","2026"].map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
        {(search || wonLost || year) && (
          <button
            onClick={() => { setSearch(""); setWonLost(""); setYear(""); }}
            className="btn-secondary text-xs gap-1"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Tender ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Buyer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-48">Product</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Bid Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Our Bid</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">L1 Bid</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">End Date</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400 text-sm">Loading…</td>
                </tr>
              ) : tenders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400 text-sm">No tenders found</td>
                </tr>
              ) : tenders.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-indigo-700 font-medium whitespace-nowrap">
                    {t.tender_id?.substring(0, 22)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700 max-w-[160px] truncate">
                    {t.buyer_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 w-48 truncate max-w-[180px]">
                    {t.product_desc?.substring(0, 45) || "—"}
                  </td>
                  <td className="px-4 py-3"><StatusBadge v={t.won_lost} /></td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[140px] truncate">
                    {t.bid_status?.replace(/[💰✅🔚]/g, "").trim() || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-right text-slate-700 font-medium">{fmtRs(t.our_bid_price)}</td>
                  <td className="px-4 py-3 text-xs text-right text-emerald-700 font-medium">{fmtRs(t.l1_bid_price)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(t.end_date)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setModal({ mode: "view", tender: t })}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
                        title="View"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setModal({ mode: "edit", tender: t })}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-600 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteId(t.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Delete"
                      >
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-600">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
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
