import { useEffect, useState } from "react";
import { Terminal, CheckCircle, XCircle, Clock, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../api";
import type { SyncLog } from "../types";

const PROMPT_TEMPLATE = `I received a GEM portal email. Please generate SQL UPDATE statements for my tender database.

Email content:
[PASTE YOUR GEM EMAIL TEXT HERE]

My tenders table has these columns:
- tender_id (TEXT, primary key — format: GEM/YYYY/B/XXXXXXX or GEM/YYYY/R/XXXXXXX)
- tender_type (TEXT — 'BID' or 'RA')
- status (TEXT — use EXACTLY one of: 'Submitted', 'Technical Evaluation', 'Financial Evaluation', 'Won', 'Lost', 'Disqualified', 'Cancelled')
- buyer_name, buyer_dept, ministry, office_name (TEXT)
- consignee_name, consignee_address (TEXT)
- product_desc (TEXT), quantity (INTEGER)
- evaluation_method (TEXT)
- start_date, end_date (TEXT — format: YYYY-MM-DD)
- our_bid_price, l1_bid_price, l2_bid_price (REAL — store amount in ₹, numbers only)
- l1_bidder_name, l2_bidder_name (TEXT)
- is_scheduled (INTEGER — 0 or 1), schedule_count (INTEGER)
- contract_no (TEXT), contract_date (TEXT — format: YYYY-MM-DD)
- order_value (REAL), contract_status (TEXT)
- remarks (TEXT)

Map email outcome to status:
- Bid submitted / awaiting evaluation → 'Submitted'
- Technical evaluation in progress → 'Technical Evaluation'
- Financial evaluation in progress → 'Financial Evaluation'
- We won the bid / contract awarded to us → 'Won'
- We lost the bid / contract awarded to another → 'Lost'
- We were disqualified / non-responsive → 'Disqualified'
- Tender cancelled / withdrawn → 'Cancelled'

Please:
1. Extract the Tender ID from the email (format: GEM/YYYY/B/XXXXXXX)
2. Generate the appropriate UPDATE statement
3. Only include fields that are explicitly mentioned in the email
4. Use this format:
   UPDATE tenders SET status = '...', l1_bid_price = ..., l1_bidder_name = '...' WHERE tender_id = 'GEM/...';`;

export default function Sync() {
  const [sql,       setSql]       = useState("");
  const [result,    setResult]    = useState<{ success: boolean; message: string } | null>(null);
  const [executing, setExecuting] = useState(false);
  const [error,     setError]     = useState("");
  const [history,   setHistory]   = useState<SyncLog[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [expanded,  setExpanded]  = useState<number | null>(null);
  const [copied,    setCopied]    = useState(false);

  useEffect(() => { loadHistory(); }, []);

  async function loadHistory() {
    try { setHistory(await api.getSyncHistory()); } catch (_) {}
  }

  async function handleExecute() {
    if (!sql.trim()) { setError("Paste some SQL first."); return; }
    setShowConfirm(false);
    setExecuting(true);
    setError("");
    setResult(null);
    try {
      const res = await api.executeSync(sql);
      if (res.success) {
        setResult({ success: true, message: res.message });
        setSql("");
      } else {
        setError(res.error || "Unknown error");
        setResult({ success: false, message: res.error || "" });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setExecuting(false);
      loadHistory();
    }
  }

  function handleCopyTemplate() {
    navigator.clipboard.writeText(PROMPT_TEMPLATE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Sync from Gmail</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Use Claude to parse your GEM emails, then paste the generated SQL here.
        </p>
      </div>

      {/* How it works */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">How to sync in 3 steps</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              step: "1",
              color: "bg-indigo-100 text-indigo-700",
              title: "Get your GEM email",
              desc: "Open the GEM notification email in Gmail. Select all text and copy it.",
            },
            {
              step: "2",
              color: "bg-violet-100 text-violet-700",
              title: "Ask Claude to generate SQL",
              desc: "Open Claude (claude.ai), use the template prompt below. Paste your email content and send.",
            },
            {
              step: "3",
              color: "bg-emerald-100 text-emerald-700",
              title: "Paste SQL & Execute",
              desc: "Copy the SQL statements Claude generates, paste them in the box below, and click Execute.",
            },
          ].map(({ step, color, title, desc }) => (
            <div key={step} className="flex gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${color}`}>
                {step}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">{title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Prompt Template */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-800">Claude Prompt Template</h2>
          <button onClick={handleCopyTemplate} className="btn-secondary text-xs gap-1.5">
            <Copy className="w-3.5 h-3.5" />
            {copied ? "Copied!" : "Copy template"}
          </button>
        </div>
        <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 font-mono overflow-auto whitespace-pre-wrap leading-relaxed">
          {PROMPT_TEMPLATE}
        </pre>
        <p className="text-xs text-slate-400 mt-2">
          💡 Replace <code className="bg-slate-100 px-1 rounded">[PASTE YOUR GEM EMAIL TEXT HERE]</code> with the actual email content.
        </p>
      </div>

      {/* SQL Executor */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Terminal className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-800">SQL Executor</h2>
          <span className="ml-auto text-xs text-slate-400">Only UPDATE, INSERT, SELECT allowed</span>
        </div>

        <textarea
          className="input font-mono text-xs h-36 resize-none"
          placeholder={`Paste the SQL from Claude here, e.g.:\n\nUPDATE tenders SET status = 'Lost', l1_bid_price = 45000, l1_bidder_name = 'S F Tubes' WHERE tender_id = 'GEM/2025/B/6637254';`}
          value={sql}
          onChange={(e) => { setSql(e.target.value); setError(""); setResult(null); }}
        />

        {error && (
          <div className="mt-2 flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
            <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {result?.success && (
          <div className="mt-2 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs">
            <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {result.message}
          </div>
        )}

        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-slate-400">
            {sql.trim().split(";").filter(Boolean).length} statement(s) detected
          </p>
          <div className="flex gap-2">
            <button onClick={() => setSql("")} className="btn-secondary text-xs" disabled={!sql}>Clear</button>
            {!showConfirm ? (
              <button
                onClick={() => { if (!sql.trim()) { setError("Paste some SQL first."); return; } setShowConfirm(true); }}
                className="btn-primary text-xs"
                disabled={executing}
              >
                Review & Execute
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                <span className="text-xs text-amber-700 font-medium">Confirm execute?</span>
                <button onClick={handleExecute} className="btn-primary text-xs py-1" disabled={executing}>
                  {executing ? "Running…" : "Yes, Execute"}
                </button>
                <button onClick={() => setShowConfirm(false)} className="btn-secondary text-xs py-1">Cancel</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Example SQL */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">Example SQL Claude might generate</h2>
        <div className="space-y-2 text-xs">
          {[
            {
              label: "Bid in financial evaluation",
              sql: `UPDATE tenders SET status = 'Financial Evaluation' WHERE tender_id = 'GEM/2025/B/6637254';`,
            },
            {
              label: "Tender awarded — we won",
              sql: `UPDATE tenders SET status = 'Won', contract_no = 'GEMC-123456789', contract_date = '2025-06-15', order_value = 85000 WHERE tender_id = 'GEM/2025/B/6637254';`,
            },
            {
              label: "Tender lost with L1 info",
              sql: `UPDATE tenders SET status = 'Lost', l1_bid_price = 42000, l1_bidder_name = 'S F Tubes Pvt Ltd' WHERE tender_id = 'GEM/2025/B/6711414';`,
            },
          ].map(({ label, sql }) => (
            <div key={label} className="bg-slate-50 rounded-lg p-3">
              <p className="text-slate-500 mb-1 font-medium">{label}</p>
              <code className="text-indigo-700 font-mono leading-relaxed">{sql}</code>
            </div>
          ))}
        </div>
      </div>

      {/* Sync History */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" /> Sync History
        </h2>
        {history.length === 0 ? (
          <p className="text-slate-400 text-xs">No syncs yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((log) => (
              <div key={log.id}
                className={`rounded-lg border p-3 ${
                  log.status === "success"
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-rose-50 border-rose-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  {log.status === "success"
                    ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    : <XCircle    className="w-3.5 h-3.5 text-rose-600    flex-shrink-0" />
                  }
                  <span className="text-xs text-slate-600">{log.executed_at?.substring(0, 16)}</span>
                  {log.status === "success" && (
                    <span className="text-xs text-emerald-700 font-medium">{log.affected_rows} row(s) updated</span>
                  )}
                  {log.error_message && (
                    <span className="text-xs text-rose-700">{log.error_message}</span>
                  )}
                  <button
                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                    className="ml-auto text-slate-400 hover:text-slate-600"
                  >
                    {expanded === log.id
                      ? <ChevronUp className="w-3.5 h-3.5" />
                      : <ChevronDown className="w-3.5 h-3.5" />
                    }
                  </button>
                </div>
                {expanded === log.id && (
                  <pre className="mt-2 text-xs font-mono text-slate-600 bg-white/60 rounded p-2 overflow-auto whitespace-pre-wrap">
                    {log.sql_text}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
