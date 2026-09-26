import type { Router } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';
import { startProgress, stopProgress } from '@vben/utils';

import { getAccessCodesApi, getMFAStatusApi } from '#/api/core/auth';
import { accessRoutes, coreRouteNames } from '#/router/routes';
import { useAuthStore } from '#/store';

import { generateAccess } from './access';

/**
 * 通用守卫配置
 * @param router
 */
function setupCommonGuard(router: Router) {
  // 记录已经加载的页面
  const loadedPaths = new Set<string>();

  router.beforeEach((to) => {
    to.meta.loaded = loadedPaths.has(to.path);

    // 页面加载进度条
    if (!to.meta.loaded && preferences.transition.progress) {
      startProgress();
    }
    return true;
  });

  router.afterEach((to) => {
    // 记录页面是否加载,如果已经加载，后续的页面切换动画等效果不在重复执行

    loadedPaths.add(to.path);

    // 关闭页面加载进度条
    if (preferences.transition.progress) {
      stopProgress();
    }
  });
}

/**
 * 权限访问守卫配置
 * @param router
 */
function setupAccessGuard(router: Router) {
  router.beforeEach(async (to, from) => {
    const accessStore = useAccessStore();
    const userStore = useUserStore();
    const authStore = useAuthStore();

    // accessToken 检查
    if (!accessStore.accessToken) {
      // 登录页必须按 path 判断，避免带 redirect 查询参数时再次嵌套重定向。
      if (to.path === LOGIN_PATH || to.meta.ignoreAccess) {
        return true;
      }

      // 没有访问权限，跳转登录页面
      return {
        path: LOGIN_PATH,
        // 如不需要，直接删除 query
        query:
          to.fullPath === preferences.app.defaultHomePath
            ? {}
            : { redirect: encodeURIComponent(to.fullPath) },
        // 携带当前跳转的页面，登录后重新跳转该页面
        replace: true,
      };
    }

    // MFA 是所有已登录页面（包括 Profile 等核心路由）的前置条件。
    // 这段判断必须位于 coreRouteNames 短路返回之前。
    const mfaStatus = await getMFAStatusApi();
    if (!mfaStatus.enabled) {
      return to.path === '/auth/mfa-setup'
        ? true
        : { path: '/auth/mfa-setup', replace: true };
    }

    // MFA 已确认启用后才允许恢复业务权限。覆盖绑定完成后刷新恢复码页、
    // 会话恢复时权限码尚未加载等场景。
    if (!accessStore.isAccessChecked && accessStore.accessCodes.length === 0) {
      accessStore.setAccessCodes(await getAccessCodesApi());
    }

    if (to.path === LOGIN_PATH || to.path === '/auth/mfa-setup') {
      return decodeURIComponent(
        (to.query?.redirect as string) ||
          userStore.userInfo?.homePath ||
          preferences.app.defaultHomePath,
      );
    }

    // 是否已经生成过动态路由
    if (accessStore.isAccessChecked) {
      return true;
    }

    // 生成路由表
    // 当前登录用户拥有的角色标识列表
    const userInfo = userStore.userInfo || (await authStore.fetchUserInfo());
    const userRoles = userInfo.roles ?? [];

    // 生成菜单和路由
    const { accessibleMenus, accessibleRoutes } = await generateAccess({
      roles: userRoles,
      router,
      // 则会在菜单中显示，但是访问会被重定向到403
      routes: accessRoutes,
    });

    // 保存菜单信息和路由信息
    accessStore.setAccessMenus(accessibleMenus);
    accessStore.setAccessRoutes(accessibleRoutes);
    accessStore.setIsAccessChecked(true);

    // 个人中心等核心页面同样依赖当前用户和导航菜单，首次直达时必须先恢复这些状态。
    // 核心路由已静态注册，初始化后直接放行，无需重新匹配动态路由。
    if (coreRouteNames.includes(to.name as string)) {
      return true;
    }

    const redirectPath = (from.query.redirect ??
      (to.path === preferences.app.defaultHomePath
        ? userInfo.homePath || preferences.app.defaultHomePath
        : to.fullPath)) as string;

    return {
      ...router.resolve(decodeURIComponent(redirectPath)),
      replace: true,
    };
  });
}

/**
 * 项目守卫配置
 * @param router
 */
function createRouterGuard(router: Router) {
  /** 通用 */
  setupCommonGuard(router);
  /** 权限访问 */
  setupAccessGuard(router);
}

export { createRouterGuard };
