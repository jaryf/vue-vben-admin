import type { CursorPage } from './app-users';

import { requestClient } from '#/api/request';

export interface LegalVersion {
  versionId: number;
  documentType: string;
  requiredForRegistration: boolean;
  version: string;
  status: string;
  effectiveAt: string;
  reviewedBy: null | number;
  reviewedAt: null | string;
  publishedBy: null | number;
  publishedAt: null | string;
  translationLanguages: null | string[];
  translationCount: number;
  createdAt: string;
  updatedAt: string;
}
export interface LegalTranslation {
  languageCode: string;
  title: string;
  bodyMarkdown: string;
}
export interface LegalDetail {
  version: LegalVersion;
  translations: LegalTranslation[];
}
export const listLegalVersions = (params: Record<string, unknown>) =>
  requestClient.get<CursorPage<LegalVersion>>('/legal/document-versions', {
    params,
  });
export const getLegalVersion = (id: number) =>
  requestClient.get<LegalDetail>(`/legal/document-versions/${id}`);
export const createLegalVersion = (data: Record<string, unknown>) =>
  requestClient.post<LegalDetail>('/legal/document-versions', data);
export const updateLegalVersion = (id: number, data: Record<string, unknown>) =>
  requestClient.request<LegalDetail>(`/legal/document-versions/${id}`, {
    method: 'PATCH',
    data,
  });
export const reviewLegalVersion = (id: number) =>
  requestClient.post<LegalDetail>(`/legal/document-versions/${id}/review`);
export const publishLegalVersion = (id: number) =>
  requestClient.post<LegalDetail>(`/legal/document-versions/${id}/publish`);
export const retireLegalVersion = (id: number) =>
  requestClient.post<LegalDetail>(`/legal/document-versions/${id}/retire`);
