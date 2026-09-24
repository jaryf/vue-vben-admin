import { requestClient } from '#/api/request';

import type { CursorPage } from './app-users';

export interface FinanceReviewCase {
  caseId: number; provider: string; eventId: string; orderId: number;
  userId: number; reasonCode: 'coin_shortfall' | 'partial_refund';
  status: 'in_review' | 'open' | 'resolved'; coinBalance: null | number; coinGrantAmount: null | number;
  spendFrozenAt: null | string; assignedTo: null | number; resolvedBy: null | number;
  resolvedAt: null | string; occurredAt: string; createdAt: string; updatedAt: string;
}
export interface FinanceReviewAction {
  actionId: number; caseId: number; actorId: number; action: 'assign' | 'note' | 'resolve';
  assignedTo: null | number; note: string; externalReference: null | string;
  requestId: string; createdAt: string;
}
export interface FinanceReviewActionInput {
  action: 'assign' | 'note' | 'resolve';
  assignedTo?: number;
  note: string;
  externalReference?: string;
}
export const listFinanceReviews = (params: Record<string, unknown>) => requestClient.get<CursorPage<FinanceReviewCase>>('/finance-review-cases', { params });
export const getFinanceReview = (id: number, reasonCode: string) => requestClient.get<FinanceReviewCase>(`/finance-review-cases/${id}`, { params: { reasonCode } });
export const listFinanceReviewActions = (id: number, reasonCode: string) => requestClient.get<FinanceReviewAction[]>(`/finance-review-cases/${id}/actions`, { params: { reasonCode } });
export const createFinanceReviewAction = (id: number, input: FinanceReviewActionInput, key: string) => requestClient.post<FinanceReviewCase>(`/finance-review-cases/${id}/actions`, input, { headers: { 'Idempotency-Key': key } });
