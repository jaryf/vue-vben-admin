import { requestClient } from '#/api/request';

import type { CursorPage } from './app-users';

export interface ContactRow {
  contactRequestId: number; senderName: string; senderEmail: string;
  subject: string; messagePreview: string; status: string;
  notificationErrorCode: null | string; assignedAdminId: null | number;
  publicRequestId: string; createdAt: string;
}
export interface ContactDetail extends Omit<ContactRow, 'messagePreview'> {
  message: string; resolutionNote: null | string;
  replies: Array<{ replyId: number; subject: string; message: string; deliveryStatus: string; deliveryErrorCode: null | string; sentAt: null | string }>;
}
export const listContactRequests = (params: Record<string, unknown>) => requestClient.get<CursorPage<ContactRow>>('/contact-requests', { params });
export const getContactRequest = (id: number, reasonCode: string) => requestClient.get<ContactDetail>(`/contact-requests/${id}`, { params: { reasonCode } });
export const assignContactRequest = (id: number, assignedAdminId: number) => requestClient.post<ContactDetail>(`/contact-requests/${id}/assign`, { assignedAdminId });
export const resolveContactRequest = (id: number, resolutionNote: string) => requestClient.post<ContactDetail>(`/contact-requests/${id}/resolve`, { resolutionNote });
export const replyContactRequest = (id: number, subject: string, message: string, key: string) => requestClient.post<ContactDetail>(`/contact-requests/${id}/reply`, { subject, message }, { headers: { 'Idempotency-Key': key } });
