import { requestClient } from '#/api/request';

import type { CursorPage } from './app-users';

export interface RiskEvent {
  eventId: number; userId: null | number; eventType: string; severity: string;
  sourceType: string; sourceId: number; actorType: string; actorId: null | number;
  reasonCode: string; metadata: unknown; occurredAt: string; createdAt: string;
}
export const listRiskEvents = (params: Record<string, unknown>) => requestClient.get<CursorPage<RiskEvent>>('/risk-events', { params });
export const getRiskEvent = (id: number) => requestClient.get<RiskEvent>(`/risk-events/${id}`);
