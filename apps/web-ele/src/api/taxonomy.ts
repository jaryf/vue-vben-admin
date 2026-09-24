import { requestClient } from '#/api/request';

import type { CursorPage } from './app-users';

export interface TaxonomyRow {
  id: number; code: string; enabled: boolean; sortOrder: number;
  translations: Array<{ languageCode: string; name: string }>;
  updatedAt: string;
}
export const listInterests = (params: Record<string, unknown>) => requestClient.get<TaxonomyRow[]>('/interests', { params });
export const listBottleCategories = (params: Record<string, unknown>) => requestClient.get<TaxonomyRow[]>('/bottle-categories', { params });
export const createInterest = (data: { code: string; nameEn: string; sortOrder: number }, key: string) =>
  requestClient.post<TaxonomyRow>('/interests', data, { headers: { 'Idempotency-Key': key } });
export const createBottleCategory = (data: { code: string; nameEn: string; sortOrder: number }, key: string) =>
  requestClient.post<TaxonomyRow>('/bottle-categories', data, { headers: { 'Idempotency-Key': key } });
export const updateInterest = (id: number, data: { enabled: boolean; sortOrder: number }) => requestClient.request<TaxonomyRow>(`/interests/${id}`, { method: 'PATCH', data });
export const updateBottleCategory = (id: number, data: { enabled: boolean; sortOrder: number }) => requestClient.request<TaxonomyRow>(`/bottle-categories/${id}`, { method: 'PATCH', data });

export interface TaxonomyTranslationRequest {
  requestId: number; resourceType: 'bottle_category' | 'interest'; resourceId: number;
  languageCode: string; proposedName: string; status: 'approved' | 'pending' | 'rejected';
  requestedBy: number; operationRequestId: string; reviewedBy: null | number;
  reviewNote: null | string; reviewedAt: null | string; createdAt: string; updatedAt: string;
}
export const listTaxonomyTranslations = (params: Record<string, unknown>) =>
  requestClient.get<CursorPage<TaxonomyTranslationRequest>>('/taxonomy-translations', { params });
export const submitTaxonomyTranslation = (data: { resourceType: 'bottle_category' | 'interest'; resourceId: number; languageCode: string; name: string }, key: string) =>
  requestClient.post<TaxonomyTranslationRequest>('/taxonomy-translations', data, { headers: { 'Idempotency-Key': key } });
export const reviewTaxonomyTranslation = (id: number, approve: boolean, note: string) =>
  requestClient.post<TaxonomyTranslationRequest>(`/taxonomy-translations/${id}/${approve ? 'approve' : 'reject'}`, { note });
