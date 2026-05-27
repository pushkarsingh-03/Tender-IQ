import type {
  OverviewStats, YearlyStats, BuyerStats, CompetitorStats,
  L1GapStats, FunnelStats, MonthlyStats, SyncLog, SyncResult,
  Tender, TendersResponse, BulkImportResult,
  MinistryStats, WinTrendStats, ProductStats, TenderTypeStats,
} from "./types";

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

export const api = {
  // Tenders CRUD
  getTenders: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchApi<TendersResponse>(`/tenders${qs ? "?" + qs : ""}`);
  },
  getTender: (id: number) => fetchApi<{ tender: Tender; history: any[] }>(`/tenders/${id}`),
  createTender: (data: Partial<Tender>) =>
    fetchApi<Tender>("/tenders", { method: "POST", body: JSON.stringify(data) }),
  updateTender: (id: number, data: Partial<Tender>) =>
    fetchApi<Tender>(`/tenders/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTender: (id: number) =>
    fetchApi<{ ok: boolean }>(`/tenders/${id}`, { method: "DELETE" }),
  bulkImportTenders: (data: Partial<Tender>[]) =>
    fetchApi<BulkImportResult>("/tenders/bulk", { method: "POST", body: JSON.stringify(data) }),

  // Analytics — core
  getOverview:     () => fetchApi<OverviewStats>("/analytics/overview"),
  getYearly:       () => fetchApi<YearlyStats[]>("/analytics/yearly"),
  getBuyers:       () => fetchApi<BuyerStats[]>("/analytics/buyers"),
  getCompetitors:  () => fetchApi<CompetitorStats[]>("/analytics/competitors"),
  getL1Gap:        () => fetchApi<L1GapStats[]>("/analytics/l1gap"),
  getPipeline:     () => fetchApi<Tender[]>("/analytics/pipeline"),
  getFunnel:       () => fetchApi<FunnelStats[]>("/analytics/funnel"),
  getMonthly:      () => fetchApi<MonthlyStats[]>("/analytics/monthly"),

  // Analytics — new
  getMinistry:     () => fetchApi<MinistryStats[]>("/analytics/ministry"),
  getWinTrend:     () => fetchApi<WinTrendStats[]>("/analytics/wintrend"),
  getProducts:     () => fetchApi<ProductStats[]>("/analytics/products"),
  getTenderType:   () => fetchApi<TenderTypeStats[]>("/analytics/tendertype"),

  // Sync
  executeSync:    (sql: string) =>
    fetchApi<SyncResult>("/sync", { method: "POST", body: JSON.stringify({ sql }) }),
  getSyncHistory: () => fetchApi<SyncLog[]>("/sync/history"),

  // Lookups
  getMinistries: () => fetchApi<string[]>("/ministries"),
};
