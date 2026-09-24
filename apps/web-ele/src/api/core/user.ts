import type { UserInfo } from '@vben/types';

import { requestClient } from '#/api/request';

/**
 * 获取用户信息
 */
export async function getUserInfoApi() {
  return requestClient.get<UserInfo>('/system/user/info');
}

export function updateAdminProfileApi(data: { realName: string; email: string; phone: string; remark: string }) {
  return requestClient.put('/system/user/profile', data);
}

export function changeAdminPasswordApi(oldPassword: string, newPassword: string) {
  return requestClient.post('/system/user/change-password', { oldPassword, newPassword });
}
