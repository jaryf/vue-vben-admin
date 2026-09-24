import { requestClient } from '#/api/request';

import type { CursorPage } from './app-users';

export interface AIRole {
  roleId: number; name: string; avatarMediaId: null | number; persona: string;
  styleRules: string[]; safetyRules: string[]; languages: string[];
  interestTagIds: number[]; allowedCategories: string[]; adultEnabled: boolean;
  dailyMessageLimit: number; replyDelayMinSeconds: number;
  replyDelayMaxSeconds: number; status: string; createdAt: string;
}

export const listAIRoles = (params: Record<string, unknown>) => requestClient.get<CursorPage<AIRole>>('/ai/roles', { params });
export const getAIRole = (id: number) => requestClient.get<AIRole>(`/ai/roles/${id}`);
export const createAIRole = (data: Record<string, unknown>, key: string) =>
  requestClient.post<AIRole>('/ai/roles', data, { headers: { 'Idempotency-Key': key } });
export const updateAIRole = (id: number, data: Record<string, unknown>) =>
  requestClient.request<AIRole>(`/ai/roles/${id}`, { method: 'PATCH', data });
export const changeAIRoleStatus = (id: number, enable: boolean) =>
  requestClient.post<AIRole>(`/ai/roles/${id}/${enable ? 'enable' : 'disable'}`);
