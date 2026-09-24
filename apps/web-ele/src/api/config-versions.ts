import { requestClient } from '#/api/request';

import type { CursorPage } from './app-users';

export interface ConfigVersion {
  versionId: number;
  scope: 'ai_distribution' | 'feature_flags' | 'moderation_rules';
  version: string;
  schemaVersion: number;
  payload: { flags: Record<string, boolean> } | { blockedTerms?: string[]; regexRules?: string[]; riskThresholds?: { medium: number; high: number; critical: number; manualReviewBelow: number } } |
    { maxPercent: number; rolloutPercent: number; languageOverrides?: Record<string, number> };
  status: 'draft' | 'reviewing' | 'approved' | 'published' | 'retired';
  requestedBy: number;
  reviewedBy: null | number;
  reviewNote: null | string;
  publishedBy: null | number;
  publishedAt: null | string;
  rollbackOf: null | number;
  createdAt: string;
  updatedAt: string;
}

export const listConfigVersions = (params: Record<string, unknown>) =>
  requestClient.get<CursorPage<ConfigVersion>>('/config-versions', { params });
export const getConfigVersion = (id: number) => requestClient.get<ConfigVersion>(`/config-versions/${id}`);
export const createConfigVersion = (data: { scope: ConfigVersion['scope']; version: string; payload: ConfigVersion['payload'] }, key: string) =>
  requestClient.post<ConfigVersion>('/config-versions', data, { headers: { 'Idempotency-Key': key } });
export const editConfigVersion = (id: number, data: { scope: ConfigVersion['scope']; version: string; payload: ConfigVersion['payload'] }) =>
  requestClient.request<ConfigVersion>(`/config-versions/${id}`, { method: 'PATCH', data });
export const submitConfigVersion = (id: number) => requestClient.post<ConfigVersion>(`/config-versions/${id}/submit`);
export const approveConfigVersion = (id: number, note: string) => requestClient.post<ConfigVersion>(`/config-versions/${id}/approve`, { note });
export const rejectConfigVersion = (id: number, note: string) => requestClient.post<ConfigVersion>(`/config-versions/${id}/reject`, { note });
export const publishConfigVersion = (id: number) => requestClient.post<ConfigVersion>(`/config-versions/${id}/publish`);
export const rollbackConfigVersion = (id: number, version: string, key: string) =>
  requestClient.post<ConfigVersion>(`/config-versions/${id}/rollback`, { version }, { headers: { 'Idempotency-Key': key } });
