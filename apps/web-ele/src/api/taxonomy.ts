import { requestClient } from '#/api/request';

export interface TaxonomyRow {
  id: number; code: string; enabled: boolean; sortOrder: number;
  translations: Array<{ languageCode: string; name: string }>;
  updatedAt: string;
}
export const listInterests = (params: Record<string, unknown>) => requestClient.get<TaxonomyRow[]>('/interests', { params });
export const listBottleCategories = (params: Record<string, unknown>) => requestClient.get<TaxonomyRow[]>('/bottle-categories', { params });
export const updateInterest = (id: number, data: { enabled: boolean; sortOrder: number }) => requestClient.request<TaxonomyRow>(`/interests/${id}`, { method: 'PATCH', data });
export const updateBottleCategory = (id: number, data: { enabled: boolean; sortOrder: number }) => requestClient.request<TaxonomyRow>(`/bottle-categories/${id}`, { method: 'PATCH', data });
