import { requestClient } from '#/api/request';

import type { CursorPage } from './app-users';

export interface ReportCase {
  reportId: number; reporterUserId: number; targetType: string; targetId: number | string;
  reasonCode: string; description: null | string; status: string; priority: string;
  assignedAdminId: null | number; resolutionCode: null | string; createdAt: string;
}
export interface AppealCase {
  appealId: number; appellantUserId: number; targetType: string; targetId: number;
  status: string; assignedAdminId: null | number; resolutionCode: null | string;
  createdAt: string;
}
export interface ReportEvidence {
  evidenceId: number; evidenceType: string; snapshot: unknown; mediaAssetId: null | number;
  retentionUntil: null | string; legalHoldUntil: null | string;
}
export interface ReportDetail { report: ReportCase; evidence: ReportEvidence[] }
export interface AppealDetail { appeal: AppealCase; description: string; evidenceMediaIds: number[] }

export const listReports = (params: Record<string, unknown>) => requestClient.get<CursorPage<ReportCase>>('/reports', { params });
export const getReport = (id: number, reasonCode: string) => requestClient.get<ReportDetail>(`/reports/${id}`, { params: { reasonCode } });
export const assignReport = (id: number, assignedAdminId: number, priority: string) => requestClient.post<ReportCase>(`/reports/${id}/assign`, { assignedAdminId, priority });
export const resolveReport = (id: number, decision: string, resolutionCode: string) => requestClient.post<ReportCase>(`/reports/${id}/resolve`, { decision, resolutionCode });
export const listAppeals = (params: Record<string, unknown>) => requestClient.get<CursorPage<AppealCase>>('/appeals', { params });
export const getAppeal = (id: number, reasonCode: string) => requestClient.get<AppealDetail>(`/appeals/${id}`, { params: { reasonCode } });
export const resolveAppeal = (id: number, decision: string, resolutionCode: string) => requestClient.post<AppealCase>(`/appeals/${id}/resolve`, { decision, resolutionCode });
