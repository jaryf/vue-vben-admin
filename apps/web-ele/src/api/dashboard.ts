import { requestClient } from '#/api/request';

export type ExternalCapabilityCode =
  | 'ai_generation'
  | 'ai_moderation'
  | 'ai_reply'
  | 'app_store'
  | 'google_play'
  | 'im'
  | 'media_processing'
  | 'object_storage'
  | 'smtp';

export type ExternalCapabilityState =
  | 'available'
  | 'degraded'
  | 'disabled'
  | 'unconfigured'
  | 'unobserved';

export interface ExternalCapabilityStatus {
  code: ExternalCapabilityCode;
  provider: string;
  enabled: boolean;
  configured: boolean;
  state: ExternalCapabilityState;
  lastSuccessAt: null | string;
  lastFailureAt: null | string;
  lastErrorCode: null | string;
}

export interface ExternalCapabilities {
  generatedAt: string;
  partial: boolean;
  items: ExternalCapabilityStatus[];
}

export const getExternalCapabilities = () =>
  requestClient.get<ExternalCapabilities>('/dashboard/external-capabilities');
