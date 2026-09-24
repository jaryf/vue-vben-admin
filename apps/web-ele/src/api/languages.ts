import { requestClient } from '#/api/request';

export interface LanguageRow {
  code: string; nativeName: string; displayName: string; textDirection: string;
  enabled: boolean; clientAvailable: boolean; contentAvailable: boolean;
  moderationAvailable: boolean; aiGenerationAvailable: boolean;
  fallbackLanguageCode: null | string; sort: number; updatedAt: string;
}
export const listLanguages = (params: Record<string, unknown>) => requestClient.get<LanguageRow[]>('/languages', { params });
export const updateLanguage = (code: string, data: Record<string, boolean>) => requestClient.request<LanguageRow>(`/languages/${encodeURIComponent(code)}`, { method: 'PATCH', data });
