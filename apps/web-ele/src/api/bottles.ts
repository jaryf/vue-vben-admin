import { requestClient } from '#/api/request';

import type { CursorPage } from './app-users';

export interface BottleRow {
  bottleId: number; ownerUserId: null | number; sourceType: string; categoryId: number;
  contentType: string; textPreview: null | string; status: string; reviewStatus: string;
  aiRoleId: null | number; voiceMediaAssetId: null | number; voiceDurationMs: null | number;
  rejectionReason: null | string; languageCode: string; adultLevel: string;
  pickedCount: number; maxPickCount: number; conversationCount: number; reportCount: number;
  createdAt: string; updatedAt: string; publishedAt: null | string; expiresAt: null | string;
}
export interface BottleDetail {
  bottle: BottleRow;
  declaredLanguageCode: null | string;
  languageConfidence: null | number;
  visibilityMode: string;
  visibilityPreferredGenders: string[];
  visibilityPreferredLanguages: string[];
  review: null | Record<string, any>;
  statusLogs: Record<string, any>[];
}
export interface BottleContent {
  archivedAt: null | string;
  bottleId: number;
  contentSource: 'active' | 'history';
  contentType: string;
  text: null | string;
  voice: null | { durationMs: null | number; mediaId: number };
}

export const listBottles = (params: Record<string, unknown>) =>
  requestClient.get<CursorPage<BottleRow>>('/bottles', { params });
export const getBottle = (id: number) => requestClient.get<BottleDetail>(`/bottles/${id}`);
export const getBottleContent = (id: number, reasonCode: string) =>
  requestClient.get<BottleContent>(`/bottles/${id}/content`, { params: { reasonCode } });
export const getBottleVoicePreview = (id: number, reasonCode: string) =>
  requestClient.download<Blob>(`/bottles/${id}/voice-preview?reasonCode=${encodeURIComponent(reasonCode)}`);
export const listBottleMatches = (id: number, reasonCode: string, cursor = '') =>
  requestClient.get<CursorPage<Record<string, any>>>(`/bottles/${id}/matches`, { params: { reasonCode, cursor: cursor || undefined, limit: 20 } });
export const removeBottle = (id: number, reasonCode: string) =>
  requestClient.post(`/bottles/${id}/remove`, { reasonCode });
export const restoreBottle = (id: number, reasonCode: string) =>
  requestClient.post(`/bottles/${id}/restore`, { reasonCode });
export const retryBottleReview = (id: number, reasonCode: string) =>
  requestClient.post(`/bottles/${id}/retry-review`, { reasonCode });
