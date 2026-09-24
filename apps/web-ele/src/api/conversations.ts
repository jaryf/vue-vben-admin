import { requestClient } from '#/api/request';

import type { CursorPage } from './app-users';

export interface ConversationRow {
  conversationId: number; type: string; sourceBottleId: null | number;
  status: string; memberCount: number; messageCount: number; reportCount: number;
  lastMessageAt: null | string; createdAt: string;
}
export interface MessageRow {
  messageId: string; conversationId: number; sequenceNo: number;
  senderMemberType: string; senderMemberId: number; messageType: string;
  status: string; moderationStatus: string; mediaAssetId: null | number;
  reportCount: number; createdAt: string;
}
export interface ConversationDetail {
  conversation: ConversationRow;
  members: Array<{ memberType: string; memberId: number; role: string; status: string; identity: null | { displayName: string; identityType: string } }>;
  recentMessages: MessageRow[];
  bodyAvailable: boolean;
}
export interface MessageContext {
  conversation: ConversationRow; targetMessage: MessageRow;
  before: MessageRow[]; after: MessageRow[];
  windowBefore: number; windowAfter: number;
  bodyAvailable: boolean; bodySource: string;
}
export interface MessagePage extends CursorPage<MessageRow> { bodyAvailable: boolean; bodySource: string }
export const listConversations = (params: Record<string, unknown>) => requestClient.get<CursorPage<ConversationRow>>('/conversations', { params });
export const getConversation = (id: number, reasonCode: string) => requestClient.get<ConversationDetail>(`/conversations/${id}`, { params: { reasonCode } });
export const listMessages = (params: Record<string, unknown>) => requestClient.get<MessagePage>('/messages', { params });
export const getMessageContext = (id: string, reasonCode: string) => requestClient.get<MessageContext>(`/messages/${id}`, { params: { reasonCode } });
export const getExtendedMessageContext = (id: string, reasonCode: string) => requestClient.get<MessageContext>(`/messages/${id}/context-extended`, { params: { reasonCode } });
export const getMessageMediaPreview = (id: string, reasonCode: string) =>
  requestClient.download<Blob>(`/messages/${id}/media-preview?reasonCode=${encodeURIComponent(reasonCode)}`);
export const removeMessage = (id: string, reasonCode: string) => requestClient.post<MessageRow>(`/messages/${id}/remove`, { reasonCode });
