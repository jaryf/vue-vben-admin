import type { Router } from 'vue-router';

import { createMemoryHistory, createRouter } from 'vue-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRouterGuard } from '../guard';

const state = vi.hoisted(() => ({
  access: {
    accessCodes: [] as string[],
    accessMenus: [] as unknown[],
    accessRoutes: [] as unknown[],
    accessToken: 'test-session' as null | string,
    isAccessChecked: false,
    setAccessCodes: vi.fn(),
    setAccessMenus: vi.fn(),
    setAccessRoutes: vi.fn(),
    setIsAccessChecked: vi.fn(),
  },
  fetchUserInfo: vi.fn(),
  generateAccess: vi.fn(),
  getAccessCodesApi: vi.fn(),
  getMFAStatusApi: vi.fn(),
  user: {
    userInfo: null as null | {
      homePath: string;
      realName: string;
      roles: string[];
      username: string;
    },
  },
}));

vi.mock('@vben/constants', () => ({ LOGIN_PATH: '/auth/login' }));
vi.mock('@vben/preferences', () => ({
  preferences: {
    app: { defaultHomePath: '/workspace' },
    transition: { progress: false },
  },
}));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => state.access,
  useUserStore: () => state.user,
}));
vi.mock('@vben/utils', () => ({
  startProgress: vi.fn(),
  stopProgress: vi.fn(),
}));
vi.mock('#/api/core/auth', () => ({
  getAccessCodesApi: state.getAccessCodesApi,
  getMFAStatusApi: state.getMFAStatusApi,
}));
vi.mock('#/router/routes', () => ({
  accessRoutes: [],
  coreRouteNames: ['Root', 'Login', 'MFASetup', 'Profile', 'ProfileSettings'],
}));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ fetchUserInfo: state.fetchUserInfo }),
}));
vi.mock('../access', () => ({ generateAccess: state.generateAccess }));

const page = { template: '<div />' };
const workspaceRoute = {
  component: page,
  name: 'Workspace',
  path: '/workspace',
};
const menus = [{ name: 'Workspace', path: '/workspace', title: '工作台' }];
let router: Router;

beforeEach(() => {
  vi.resetAllMocks();
  state.access.accessToken = 'test-session';
  state.access.accessCodes = [];
  state.access.accessMenus = [];
  state.access.accessRoutes = [];
  state.access.isAccessChecked = false;
  state.user.userInfo = null;
  state.access.setAccessCodes.mockImplementation((codes: string[]) => {
    state.access.accessCodes = codes;
  });
  state.access.setAccessMenus.mockImplementation((value: unknown[]) => {
    state.access.accessMenus = value;
  });
  state.access.setAccessRoutes.mockImplementation((value: unknown[]) => {
    state.access.accessRoutes = value;
  });
  state.access.setIsAccessChecked.mockImplementation((value: boolean) => {
    state.access.isAccessChecked = value;
  });
  state.getMFAStatusApi.mockResolvedValue({ enabled: true });
  state.getAccessCodesApi.mockResolvedValue(['dashboard:read']);
  state.fetchUserInfo.mockImplementation(async () => {
    state.user.userInfo = {
      homePath: '/workspace',
      realName: '测试管理员',
      roles: ['super'],
      username: 'admin',
    };
    return state.user.userInfo;
  });
  state.generateAccess.mockImplementation(
    async ({ router }: { router: Router }) => {
      router.addRoute(workspaceRoute);
      return { accessibleMenus: menus, accessibleRoutes: [workspaceRoute] };
    },
  );
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { component: page, name: 'Login', path: '/auth/login' },
      { component: page, name: 'MFASetup', path: '/auth/mfa-setup' },
      { component: page, name: 'ProfileSettings', path: '/profile' },
      {
        component: page,
        name: 'Public',
        meta: { ignoreAccess: true, title: 'Public' },
        path: '/public',
      },
      { component: page, name: 'NotFound', path: '/:path(.*)*' },
    ],
  });
  createRouterGuard(router);
});

describe('admin navigation initialization', () => {
  it('restores identity and navigation when opening profile directly', async () => {
    await router.push('/profile?tab=session#current');

    expect(router.currentRoute.value.fullPath).toBe(
      '/profile?tab=session#current',
    );
    expect(router.currentRoute.value.name).toBe('ProfileSettings');
    expect(state.user.userInfo?.username).toBe('admin');
    expect(state.access.accessCodes).toEqual(['dashboard:read']);
    expect(state.access.accessMenus).toEqual(menus);
    expect(state.access.accessRoutes).toEqual([workspaceRoute]);
    expect(state.access.isAccessChecked).toBe(true);
    expect(state.fetchUserInfo).toHaveBeenCalledTimes(1);
    expect(state.generateAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        roles: ['super'],
      }),
    );
  });

  it('reuses initialized identity and menus when moving between pages', async () => {
    await router.push('/profile');
    await router.push('/workspace');
    await router.push('/profile');

    expect(state.fetchUserInfo).toHaveBeenCalledTimes(1);
    expect(state.generateAccess).toHaveBeenCalledTimes(1);
    expect(state.getAccessCodesApi).toHaveBeenCalledTimes(1);
    expect(state.getMFAStatusApi).toHaveBeenCalledTimes(3);
  });

  it('continues matching dynamic routes on a direct workspace visit', async () => {
    await router.push('/workspace');

    expect(router.currentRoute.value.name).toBe('Workspace');
    expect(state.access.accessMenus).toEqual(menus);
    expect(state.generateAccess).toHaveBeenCalledTimes(1);
  });

  it('redirects unauthenticated profile visits to login without loading admin data', async () => {
    state.access.accessToken = null;
    await router.push('/profile');

    expect(router.currentRoute.value.path).toBe('/auth/login');
    expect(router.currentRoute.value.query.redirect).toBe(
      encodeURIComponent('/profile'),
    );
    expect(state.getMFAStatusApi).not.toHaveBeenCalled();
    expect(state.fetchUserInfo).not.toHaveBeenCalled();
    expect(state.generateAccess).not.toHaveBeenCalled();
  });

  it.each(['/auth/login', '/public'])(
    'keeps %s accessible without login',
    async (path) => {
      state.access.accessToken = null;
      await router.push(path);

      expect(router.currentRoute.value.path).toBe(path);
      expect(state.getMFAStatusApi).not.toHaveBeenCalled();
      expect(state.generateAccess).not.toHaveBeenCalled();
    },
  );

  it('blocks profile access until MFA is enabled without restoring business data', async () => {
    state.getMFAStatusApi.mockResolvedValue({ enabled: false });
    await router.push('/profile');

    expect(router.currentRoute.value.path).toBe('/auth/mfa-setup');
    expect(state.getAccessCodesApi).not.toHaveBeenCalled();
    expect(state.fetchUserInfo).not.toHaveBeenCalled();
    expect(state.generateAccess).not.toHaveBeenCalled();
    expect(state.access.isAccessChecked).toBe(false);
  });

  it('initializes profile after an authenticated login-page redirect', async () => {
    await router.push({
      path: '/auth/login',
      query: { redirect: encodeURIComponent('/profile') },
    });

    expect(router.currentRoute.value.name).toBe('ProfileSettings');
    expect(state.user.userInfo?.username).toBe('admin');
    expect(state.access.accessMenus).toEqual(menus);
  });
});
