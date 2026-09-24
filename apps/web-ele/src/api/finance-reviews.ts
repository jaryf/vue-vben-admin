import { requestClient } from '#/api/request';

import type { CursorPage } from './app-users';

export interface FinanceReviewCase {
  caseId: number; provider: string; eventId: string; orderId: number;
  userId: number; reasonCode: 'coin_shortfall' | 'partial_refund';
  status: 'open'; coinBalance: null | number; coinGrantAmount: null | number;
  spendFrozenAt: null | string; occurredAt: string; createdAt: string;
}
export const listFinanceReviews = (params: Record<string, unknown>) => requestClient.get<CursorPage<FinanceReviewCase>>('/finance-review-cases', { params });
export const getFinanceReview = (id: number, reasonCode: string) => requestClient.get<FinanceReviewCase>(`/finance-review-cases/${id}`, { params: { reasonCode } });
