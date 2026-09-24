import { defineOverridesPreferences } from '@vben/preferences';

/**
 * @description 项目配置文件
 * 只需要覆盖项目中的一部分配置，不需要的配置不用覆盖，会自动使用默认配置
 * !!! 更改配置后请清空缓存，否则可能不生效
 */
export const overridesPreferences = defineOverridesPreferences({
  // overrides
  app: {
    accessMode: 'backend',
    defaultAvatar: '/driftly-mark.svg',
    defaultHomePath: '/workspace',
    enableCheckUpdates: false,
    enablePreferences: false,
    enableRefreshToken: true,
    locale: 'zh-CN',
    name: import.meta.env.VITE_APP_TITLE,
    timezone: 'Asia/Kolkata',
  },
  copyright: { enable: false, settingShow: false },
  logo: {
    source: '/driftly-mark.svg',
    sourceDark: '/driftly-mark.svg',
  },
  widget: {
    languageToggle: false,
    notification: false,
  },
});
