import { requestClient } from '#/api/request';

import type { CursorPage } from './app-users';

export interface ReviewRow {
  reviewId: number; targetType: string; targetEntityId: null | number;
  targetMessageId: null | string; scene: string; status: string;
  finalDecision: string; riskLevel: string; categories: string[];
  ruleVersion: string; modelName: string; confidence: number;
  requestedAt: string; completedAt: string; evidenceCount: number;
}
export interface ReviewDetail {
  review: ReviewRow;
  evidence: { evidenceId: number; sourceType: string; maskedText: null | string; mediaAssetId: null | number; createdAt: string }[];
  allowedDecisions: string[];
}

export const listReviews = (params: Record<string, unknown>) =>
  requestClient.get<CursorPage<ReviewRow>>('/moderation/reviews', { params });
export const getReview = (id: number, reasonCode: string) =>
  requestClient.get<ReviewDetail>(`/moderation/reviews/${id}`, { params: { reasonCode } });
export const decideReview = (id: number, data: Record<string, unknown>, key: string) =>
  requestClient.post<ReviewDetail>(`/moderation/reviews/${id}/decision`, data, { headers: { 'Idempotency-Key': key } });
