import { requestClient } from '#/api/request';

import type { CursorPage } from './app-users';

export interface WebsiteContentVersion {
  versionId: number; contentType: 'help_article' | 'page'; slug: string;
  languageCode: string; version: string; title: string; bodyMarkdown: string;
  status: 'draft' | 'published' | 'retired'; createdBy: number;
  reviewedBy: null | number; publishedBy: null | number;
  publishedAt: null | string; createdAt: string; updatedAt: string;
}
export const listWebsiteContent = (params: Record<string, unknown>) => requestClient.get<CursorPage<WebsiteContentVersion>>('/website/content-versions', { params });
export const getWebsiteContent = (id: number) => requestClient.get<WebsiteContentVersion>(`/website/content-versions/${id}`);
export const createWebsiteContent = (data: Record<string, unknown>, key: string) => requestClient.post<WebsiteContentVersion>('/website/content-versions', data, { headers: { 'Idempotency-Key': key } });
export const updateWebsiteContent = (id: number, data: Record<string, unknown>) => requestClient.request<WebsiteContentVersion>(`/website/content-versions/${id}`, { method: 'PATCH', data });
export const reviewWebsiteContent = (id: number) => requestClient.post<WebsiteContentVersion>(`/website/content-versions/${id}/review`);
export const publishWebsiteContent = (id: number) => requestClient.post<WebsiteContentVersion>(`/website/content-versions/${id}/publish`);
export const retireWebsiteContent = (id: number) => requestClient.post<WebsiteContentVersion>(`/website/content-versions/${id}/retire`);
