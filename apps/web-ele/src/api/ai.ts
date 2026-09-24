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

export interface AIGenerationBatch {
  batchId: number; requestedBy: number; categoryId: number; languageCode: string;
  targetCount: number; status: string; modelConfigVersion: string;
  startedAt: null | string; completedAt: null | string; createdAt: string;
}
export interface AIGenerationItem {
  itemId: number; batchId: number; bottleId: number; aiRoleId: number;
  categoryId: number; languageCode: string; text: string; status: string;
  contentRevision: number; rejectionReasonCode: null | string;
  reviewedAt: null | string; publishedAt: null | string;
}
export interface AIReplyTask {
  taskId: number; conversationId: number; triggerMessageId: string;
  aiRoleId: number; status: string; attempts: number; retryVersion: number;
  scheduledAt: string; lastErrorCode: null | string; completedAt: null | string;
}

export const listGenerationBatches = (params: Record<string, unknown>) => requestClient.get<CursorPage<AIGenerationBatch>>('/ai/generation-batches', { params });
export const getGenerationBatch = (id: number) => requestClient.get<AIGenerationBatch>(`/ai/generation-batches/${id}`);
export const createGenerationBatch = (data: Record<string, unknown>, key: string) => requestClient.post<AIGenerationBatch>('/ai/generation-batches', data, { headers: { 'Idempotency-Key': key } });
export const startGenerationBatch = (id: number) => requestClient.post<AIGenerationBatch>(`/ai/generation-batches/${id}/start`);
export const cancelGenerationBatch = (id: number) => requestClient.post<AIGenerationBatch>(`/ai/generation-batches/${id}/cancel`);
export const listGenerationItems = (params: Record<string, unknown>) => requestClient.get<CursorPage<AIGenerationItem>>('/ai/generation-items', { params });
export const updateGenerationItem = (id: number, text: string) => requestClient.request<AIGenerationItem>(`/ai/generation-items/${id}`, { method: 'PATCH', data: { text } });
export const approveGenerationItem = (id: number) => requestClient.post<AIGenerationItem>(`/ai/generation-items/${id}/approve`);
export const rejectGenerationItem = (id: number, reasonCode: string) => requestClient.post<AIGenerationItem>(`/ai/generation-items/${id}/reject`, { reasonCode });
export const publishGenerationItems = (itemIds: number[]) => requestClient.post<{ items: AIGenerationItem[] }>('/ai/generation-items/publish', { itemIds });
export const listAIReplyTasks = (params: Record<string, unknown>) => requestClient.get<CursorPage<AIReplyTask>>('/ai/reply-tasks', { params });
export const getAIReplyTask = (id: number) => requestClient.get<AIReplyTask>(`/ai/reply-tasks/${id}`);
export const retryAIReplyTask = (id: number) => requestClient.post<AIReplyTask>(`/ai/reply-tasks/${id}/retry`);
export const cancelAIReplyTask = (id: number) => requestClient.post<AIReplyTask>(`/ai/reply-tasks/${id}/cancel`);
