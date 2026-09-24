import { requestClient } from '#/api/request';

export interface Page<T> { items: T[]; total: number }
export interface AdminUser {
  id: number; username: string; realName: string; email: string; phone: string;
  deptId: null | number; deptName?: string; status: number; remark: string;
  roles: string[]; roleIds: number[]; createdAt: string; mfaEnabled: boolean;
}
export interface AdminRole {
  id: number; name: string; code: string; status: number; remark: string;
  menuIds: number[]; createdAt: string;
}
export interface AdminMenu {
  id: number; parentId: number; name: string; path: string; component: string;
  type: string; icon: string; authCode: string; status: number;
  sortOrder: number; meta: Record<string, unknown>; children?: AdminMenu[];
}
export interface AdminDept {
  id: number; parentId: number; name: string; status: number;
  remark: string; sortOrder: number; children?: AdminDept[];
}

export const listAdminUsers = (params: Record<string, unknown>) =>
  requestClient.get<Page<AdminUser>>('/system/user/list', { params });
export const createAdminUser = (data: Record<string, unknown>) =>
  requestClient.post('/system/user', data);
export const updateAdminUser = (id: number, data: Record<string, unknown>) =>
  requestClient.put(`/system/user/${id}`, data);
export const deleteAdminUser = (id: number) => requestClient.delete(`/system/user/${id}`);
export const resetAdminMFA = (id: number, data: { currentPassword: string; totpCode: string; reason: string }) =>
  requestClient.post(`/system/user/${id}/mfa/reset`, data);

export const listAdminRoles = (params: Record<string, unknown>) =>
  requestClient.get<Page<AdminRole>>('/system/role/list', { params });
export const allAdminRoles = () => requestClient.get<AdminRole[]>('/system/role/all');
export const createAdminRole = (data: Record<string, unknown>) => requestClient.post('/system/role', data);
export const updateAdminRole = (id: number, data: Record<string, unknown>) => requestClient.put(`/system/role/${id}`, data);
export const deleteAdminRole = (id: number) => requestClient.delete(`/system/role/${id}`);

export const listAdminMenus = () => requestClient.get<AdminMenu[]>('/system/menu/list');
export const createAdminMenu = (data: Record<string, unknown>) => requestClient.post('/system/menu', data);
export const updateAdminMenu = (id: number, data: Record<string, unknown>) => requestClient.put(`/system/menu/${id}`, data);
export const deleteAdminMenu = (id: number) => requestClient.delete(`/system/menu/${id}`);

export const listAdminDepts = () => requestClient.get<AdminDept[]>('/system/dept/list');
export const createAdminDept = (data: Record<string, unknown>) => requestClient.post('/system/dept', data);
export const updateAdminDept = (id: number, data: Record<string, unknown>) => requestClient.put(`/system/dept/${id}`, data);
export const deleteAdminDept = (id: number) => requestClient.delete(`/system/dept/${id}`);
