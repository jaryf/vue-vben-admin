import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    password: string;
    username: string;
    totpCode?: string;
    recoveryCode?: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    accessToken: string;
    mfaRequired: boolean;
    mfaEnabled: boolean;
  }

  export interface RefreshTokenResult {
    code: string;
    data: string;
  }
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return requestClient.post<AuthApi.LoginResult>('/system/auth/login', data);
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi() {
  return baseRequestClient.post<AuthApi.RefreshTokenResult>(
    '/system/auth/refresh',
    undefined,
    {
      withCredentials: true,
    },
  );
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return requestClient.post('/system/auth/logout', undefined, {
    withCredentials: true,
  });
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  return requestClient.get<string[]>('/system/auth/codes');
}

export interface MFAStatus {
  enabled: boolean;
  enabledAt?: string;
  recoveryCodesRemaining: number;
}

export interface MFASetup {
  secret: string;
  otpAuthUri: string;
  expiresIn: number;
}

export const getMFAStatusApi = () => requestClient.get<MFAStatus>('/system/auth/mfa/status');
export const setupMFAApi = (currentPassword: string) =>
  requestClient.post<MFASetup>('/system/auth/mfa/setup', { currentPassword });
export const enableMFAApi = (currentPassword: string, totpCode: string) =>
  requestClient.post<{ recoveryCodes: string[] }>('/system/auth/mfa/enable', { currentPassword, totpCode });
export const regenerateRecoveryCodesApi = (currentPassword: string, totpCode: string) =>
  requestClient.post<{ recoveryCodes: string[] }>('/system/auth/mfa/recovery-codes', { currentPassword, totpCode });
