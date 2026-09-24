import { requestClient } from '#/api/request';

import type { CursorPage } from './app-users';

export interface DataExportTask {
  exportId: number;
  dataset: 'audit_logs' | 'coin_ledger' | 'entitlement_ledger' | 'finance_reviews' | 'orders' | 'payment_transactions' | 'subscriptions';
  fromAt: string;
  toAt: string;
  purpose: string;
  status: 'expired' | 'failed' | 'pending' | 'queued' | 'ready' | 'rejected';
  requestedBy: number;
  reviewedBy: null | number;
  reviewNote: null | string;
  reviewedAt: null | string;
  generatedAt: null | string;
  expiresAt: null | string;
  fileSha256: null | string;
  rowCount: null | number;
  failureCode: null | string;
  createdAt: string;
  updatedAt: string;
}

export const listDataExports = (params: Record<string, unknown>) =>
  requestClient.get<CursorPage<DataExportTask>>('/data-exports', { params });
export const getDataExport = (id: number) => requestClient.get<DataExportTask>(`/data-exports/${id}`);
export const createDataExport = (data: { dataset: string; fromAt: string; toAt: string; purpose: string }, key: string) =>
  requestClient.post<DataExportTask>('/data-exports', data, { headers: { 'Idempotency-Key': key } });
export const approveDataExport = (id: number, note: string) => requestClient.post<DataExportTask>(`/data-exports/${id}/approve`, { note });
export const rejectDataExport = (id: number, note: string) => requestClient.post<DataExportTask>(`/data-exports/${id}/reject`, { note });
export async function downloadDataExport(id: number, reasonCode: string) {
  const ticket = await requestClient.post<{ downloadUrl: string; expiresAt: string }>(
    `/data-exports/${id}/download-ticket`, undefined, { params: { reasonCode } },
  );
  return requestClient.download<Blob>(ticket.downloadUrl);
}
