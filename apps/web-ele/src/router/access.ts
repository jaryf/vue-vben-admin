import type {
  ComponentRecordType,
  GenerateMenuAndRoutesOptions,
  RouteRecordStringComponent,
} from '@vben/types';

import { generateAccessible } from '@vben/access';
import { preferences } from '@vben/preferences';

import { ElMessage } from 'element-plus';

import { getAllMenusApi } from '#/api';
import { BasicLayout, IFrameView } from '#/layouts';
import { $t } from '#/locales';

const forbiddenComponent = () => import('#/views/_core/fallback/forbidden.vue');

async function generateAccess(options: GenerateMenuAndRoutesOptions) {
  const pageMap: ComponentRecordType = import.meta.glob('../views/**/*.vue');
  const availablePages = new Set(
    Object.keys(pageMap).map((path) => path.replace('../views/', 'views/')),
  );

  function keepAvailablePages(routes: RouteRecordStringComponent[]): RouteRecordStringComponent[] {
    return routes.flatMap((route) => {
      const children = route.children ? keepAvailablePages(route.children) : [];
      const component = route.component;
      if (component && !availablePages.has(component)) return [];
      if (!component && children.length === 0) return [];
      return [{ ...route, children }];
    });
  }

  const layoutMap: ComponentRecordType = {
    BasicLayout,
    IFrameView,
  };

  return await generateAccessible(preferences.app.accessMode, {
    ...options,
    fetchMenuListAsync: async () => {
      ElMessage({
        duration: 1500,
        message: `${$t('common.loadingMenu')}...`,
      });
      return keepAvailablePages(await getAllMenusApi());
    },
    // 可以指定没有权限跳转403页面
    forbiddenComponent,
    // 如果 route.meta.menuVisibleWithForbidden = true
    layoutMap,
    pageMap,
  });
}

export { generateAccess };
