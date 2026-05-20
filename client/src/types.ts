export interface Tender {
  id: number;
  tender_id: string;
  tender_type: "BID" | "RA";
  buyer_name: string | null;
  buyer_dept: string | null;
  ministry: string | null;
  product_desc: string | null;
  quantity: number | null;
  won_lost: "WON" | "Lost" | "Pending" | "Cancelled" | null;
  bid_status: string | null;
  start_date: string | null;
  end_date: string | null;
  remarks: string | null;
  our_bid_price: number | null;
  l1_bid_price: number | null;
  l1_bidder_name: string | null;
  consignee_address: string | null;
  contract_no: string | null;
  contract_date: string | null;
  order_value: number | null;
  contract_status: string | null;
  office_name: string | null;
  evaluation_method: string | null;
  created_at: string;
  updated_at: string;
}

export interface OverviewStats {
  total: number;
  won: number;
  lost: number;
  pending: number;
  cancelled: number;
  win_rate: number;
  total_order_value: number;
  total_bid_value: number;
}

export interface YearlyStats {
  year: string;
  won: number;
  lost: number;
  pending: number;
  total: number;
  win_rate: number;
}

export interface BuyerStats {
  buyer_name: string;
  total_tenders: number;
  won: number;
  total_value: number;
}

export interface CompetitorStats {
  l1_bidder_name: string;
  times_beat_us: number;
  avg_l1_price: number;
  avg_our_price: number;
}

export interface L1GapStats {
  tender_id: string;
  buyer_name: string;
  our_bid_price: number;
  l1_bid_price: number;
  gap_pct: number;
  l1_bidder_name: string;
  product_desc: string;
}

export interface FunnelStats {
  bid_status: string;
  count: number;
}

export interface MonthlyStats {
  month: string;
  total_value: number;
  contracts: number;
}

export interface SyncLog {
  id: number;
  sql_text: string;
  executed_at: string;
  status: "success" | "error";
  affected_rows: number | null;
  error_message: string | null;
}

export interface SyncResult {
  success: boolean;
  affected_rows: number;
  message: string;
  error?: string;
}

export interface TendersResponse {
  tenders: Tender[];
  total: number;
  page: number;
  limit: number;
}
