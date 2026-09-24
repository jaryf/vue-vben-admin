import { requestClient } from '#/api/request';

import type { CursorPage } from './app-users';

export interface PenaltyRow {
  penaltyId: number; userId: number; penaltyType: string; scope: string;
  reasonCode: string; referenceType: string; referenceId: number;
  startsAt: string; endsAt: null | string; status: string; createdBy: number;
  revocationReasonCode: null | string;
}
export const listPenalties = (params: Record<string, unknown>) => requestClient.get<CursorPage<PenaltyRow>>('/penalties', { params });
export const createPenalty = (data: Record<string, unknown>, key: string) => requestClient.post<PenaltyRow>('/penalties', data, { headers: { 'Idempotency-Key': key } });
export const revokePenalty = (id: number, reasonCode: string, key: string) => requestClient.post<PenaltyRow>(`/penalties/${id}/revoke`, { reasonCode }, { headers: { 'Idempotency-Key': key } });
