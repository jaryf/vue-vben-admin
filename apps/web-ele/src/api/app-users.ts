import { requestClient } from '#/api/request';

export interface CursorPage<T> { items: T[]; nextCursor: null | string; hasMore: boolean }
export interface AppUserRow {
  userId: number; status: string; nickname: null | string; countryCode: null | string;
  interfaceLanguage: null | string; registeredAt: null | string; createdAt: string;
  lastActiveAt: string; activeSessionCount: number; activePenaltyType: null | string;
}
export interface AppUserDetail {
  user: Record<string, any>; profile: null | Record<string, any>;
  preferences: null | Record<string, any>; sessions: Record<string, any>[];
  oauthAccounts: Record<string, any>[]; imAccount: null | Record<string, any>;
  quota: Record<string, any>; entitlements: Record<string, any>[];
  risk: Record<string, any>; recentStatusLogs: Record<string, any>[];
  pendingDeletion: null | Record<string, any>;
}

export const listAppUsers = (params: Record<string, unknown>) =>
  requestClient.get<CursorPage<AppUserRow>>('/users', { params });
export const getAppUser = (id: number) => requestClient.get<AppUserDetail>(`/users/${id}`);
export const listAppUserSessions = (id: number) => requestClient.get<Record<string, any>[]>(`/users/${id}/sessions`);
export const listAppUserDevices = (id: number) => requestClient.get<Record<string, any>[]>(`/users/${id}/devices`);
export const listAppUserBindings = (id: number) => requestClient.get<Record<string, any>[]>(`/users/${id}/bindings`);
export const listAppUserIdentityConflicts = (id: number) => requestClient.get<Record<string, any>[]>(`/users/${id}/identity-conflicts`);
export const revokeAppUserSessions = (id: number, reasonCode: string) =>
  requestClient.post(`/users/${id}/sessions/revoke`, { reasonCode });
export const revokeAppUserSession = (id: number, sessionId: number, reasonCode: string) =>
  requestClient.post(`/users/${id}/sessions/revoke/${sessionId}`, { reasonCode });
export const updateAppUserStatus = (id: number, status: string, reasonCode: string) =>
  requestClient.put(`/users/${id}/status`, { status, reasonCode });
export const adjustAppUserQuota = (id: number, data: Record<string, unknown>, key: string) =>
  requestClient.post(`/users/${id}/quota-adjustments`, data, { headers: { 'Idempotency-Key': key } });
export const adjustAppUserEntitlement = (id: number, data: Record<string, unknown>, key: string) =>
  requestClient.post(`/users/${id}/entitlement-adjustments`, data, { headers: { 'Idempotency-Key': key } });

export const listDeletionRequests = (params: Record<string, unknown>) =>
  requestClient.get<CursorPage<Record<string, any>>>('/account-deletion-requests', { params });
export const getDeletionRequest = (id: number) => requestClient.get<Record<string, any>>(`/account-deletion-requests/${id}`);
export const reviewDeletionRequest = (id: number, data: Record<string, unknown>) =>
  requestClient.post(`/account-deletion-requests/${id}/review`, data);
