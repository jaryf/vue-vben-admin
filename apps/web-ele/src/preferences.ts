import {defineOverridesPreferences} from '@vben/preferences';

/**
 * @description 项目配置文件
 * 只需要覆盖项目中的一部分配置，不需要的配置不用覆盖，会自动使用默认配置
 * !!! 更改配置后请清空缓存，否则可能不生效
 */
export const overridesPreferences = defineOverridesPreferences({
  // overrides
  /** 全局配置 */
  app: {
    /** 权限模式。允许值：'backend' | 'frontend' | 'mixed' */
    accessMode: 'backend',
    /** 登录注册页面布局。允许值：'panel-center' | 'panel-left' | 'panel-right' */
    authPageLayout: 'panel-right',
    /** 检查更新轮询时间。允许值：number */
    checkUpdatesInterval: 1,
    /** 是否开启灰色模式。允许值：true | false */
    colorGrayMode: false,
    /** 是否开启色弱模式。允许值：true | false */
    colorWeakMode: false,
    /** 是否开启紧凑模式。允许值：true | false */
    compact: false,
    /** 是否开启内容紧凑模式。允许值：'compact' | 'wide' */
    contentCompact: 'wide',
    /** 内容紧凑宽度。允许值：number */
    contentCompactWidth: 1200,
    /** 内容内边距。允许值：number */
    contentPadding: 0,
    /** 内容底部内边距。允许值：number */
    contentPaddingBottom: 0,
    /** 内容左侧内边距。允许值：number */
    contentPaddingLeft: 0,
    /** 内容右侧内边距。允许值：number */
    contentPaddingRight: 0,
    /** 内容顶部内边距。允许值：number */
    contentPaddingTop: 0,
    /** 应用默认头像。允许值：string */
    defaultAvatar: '/images/avatar.svg',
    /** 默认首页地址。允许值：string */
    defaultHomePath: '/analytics',
    /** 开启动态标题。允许值：true | false */
    dynamicTitle: true,
    /** 是否开启检查更新。允许值：true | false */
    enableCheckUpdates: true,
    /** 是否显示复制偏好设置按钮。允许值：true | false */
    enableCopyPreferences: true,
    /** 是否显示偏好设置。允许值：true | false */
    enablePreferences: true,
    /** 是否开启 refreshToken。允许值：true | false */
    enableRefreshToken: false,
    /** 是否开启首选项导航栏吸顶效果。允许值：true | false */
    enableStickyPreferencesNavigationBar: true,
    /** 是否移动端。允许值：true | false */
    isMobile: false,
    /** 布局方式。允许值：'full-content' | 'header-mixed-nav' | 'header-nav' | 'header-sidebar-nav' | 'mixed-nav' | 'sidebar-mixed-nav' | 'sidebar-nav' */
    layout: 'sidebar-nav',
    /** 支持的语言。允许值：'en-US' | 'zh-CN' */
    locale: 'zh-CN',
    /** 登录过期模式。允许值：'modal' | 'page' */
    loginExpiredMode: 'page',
    /** 应用名。允许值：string */
    name: import.meta.env.VITE_APP_TITLE,
    /** 偏好设置按钮位置。允许值：'auto' | 'fixed' | 'header' | 'user-dropdown' */
    preferencesButtonPosition: 'auto',
    /** 应用时区。允许值：string */
    timezone: 'Asia/Shanghai',
    /** 是否开启水印。允许值：true | false */
    watermark: false,
    /** 水印文案。允许值：string */
    watermarkContent: '',
    /** z-index。允许值：number */
    zIndex: 200,
  },
  /** 面包屑配置 */
  breadcrumb: {
    /** 面包屑是否启用。允许值：true | false */
    enable: true,
    /** 面包屑是否只有一个时隐藏。允许值：true | false */
    hideOnlyOne: false,
    /** 面包屑首页图标是否可见。允许值：true | false */
    showHome: false,
    /** 面包屑图标是否可见。允许值：true | false */
    showIcon: true,
    /** 面包屑风格。允许值：'background' | 'normal' */
    styleType: 'normal',
  },
  /** 版权配置 */
  copyright: {
    /** 版权公司名。允许值：string */
    companyName: 'Jary',
    /** 版权公司名链接。允许值：string */
    companySiteLink: '#',
    /** 版权日期。允许值：string */
    date: '2026',
    /** 版权是否可见。允许值：true | false */
    enable: true,
    /** 备案号。允许值：string */
    icp: '',
    /** 备案号链接。允许值：string */
    icpLink: '',
    /** 设置面板是否显示。允许值：true | false */
    settingShow: true,
  },
  /** 底栏配置 */
  footer: {
    /** 底栏是否可见。允许值：true | false */
    enable: false,
    /** 底栏是否固定。允许值：true | false */
    fixed: false,
    /** 底栏高度。允许值：number */
    height: 32,
  },
  /** 顶栏配置 */
  header: {
    /** 顶栏是否启用。允许值：true | false */
    enable: true,
    /** 顶栏高度。允许值：number */
    height: 50,
    /** 顶栏是否隐藏，css 隐藏。允许值：true | false */
    hidden: false,
    /** 顶栏菜单位置。允许值：'center' | 'end' | 'start' */
    menuAlign: 'start',
    /** header 显示模式。允许值：'auto' | 'auto-scroll' | 'fixed' | 'static' */
    mode: 'fixed',
  },
  /** logo 配置 */
  logo: {
    /** logo 是否可见。允许值：true | false */
    enable: true,
    /** logo 图片适应方式。允许值：'contain' | 'cover' | 'fill' | 'none' | 'scale-down' */
    fit: 'contain',
    /** logo 地址。允许值：string */
    source: 'https://unpkg.com/@vbenjs/static-source@0.1.7/source/logo-v1.webp',
  },
  /** 导航配置 */
  navigation: {
    /** 导航菜单手风琴模式。允许值：true | false */
    accordion: true,
    /** 导航菜单是否切割，只在 layout='mixed-nav' 生效。允许值：true | false */
    split: true,
    /** 导航菜单风格。允许值：'plain' | 'rounded' */
    styleType: 'rounded',
  },
  /** 快捷键配置 */
  shortcutKeys: {
    /** 是否启用快捷键-全局。允许值：true | false */
    enable: true,
    /** 是否启用全局关闭窗口快捷键。允许值：true | false */
    globalEscape: false,
    /** 是否启用全局锁屏快捷键。允许值：true | false */
    globalLockScreen: true,
    /** 是否启用全局注销快捷键。允许值：true | false */
    globalLogout: true,
    /** 是否启用全局偏好设置快捷键。允许值：true | false */
    globalPreferences: true,
    /** 是否启用全局搜索快捷键。允许值：true | false */
    globalSearch: true,
  },
  /** 侧边栏配置 */
  sidebar: {
    /** 点击目录时自动激活子菜单。允许值：true | false */
    autoActivateChild: false,
    /** 侧边栏是否折叠。允许值：true | false */
    collapsed: false,
    /** 侧边栏折叠按钮是否可见。允许值：true | false */
    collapsedButton: true,
    /** 侧边栏折叠时，是否显示 title。允许值：true | false */
    collapsedShowTitle: false,
    /** 侧边栏折叠宽度。允许值：number */
    collapseWidth: 60,
    /** 侧边栏菜单拖拽。允许值：true | false */
    draggable: true,
    /** 侧边栏是否可见。允许值：true | false */
    enable: true,
    /** 菜单自动展开状态。允许值：true | false */
    expandOnHover: true,
    /** 侧边栏扩展区域是否折叠。允许值：true | false */
    extraCollapse: false,
    /** 侧边栏扩展区域折叠宽度。允许值：number */
    extraCollapsedWidth: 60,
    /** 侧边栏固定按钮是否可见。允许值：true | false */
    fixedButton: true,
    /** 侧边栏是否隐藏，css 隐藏。允许值：true | false */
    hidden: false,
    /** 混合侧边栏宽度。允许值：number */
    mixedWidth: 80,
    /** 侧边栏宽度。允许值：number */
    width: 224,
  },
  /** 标签页配置 */
  tabbar: {
    /** 是否开启多标签页拖拽。允许值：true | false */
    draggable: true,
    /** 是否开启多标签页。允许值：true | false */
    enable: true,
    /** 标签页高度。允许值：number */
    height: 38,
    /** 开启标签页缓存功能。允许值：true | false */
    keepAlive: true,
    /** 限制最大数量。允许值：number */
    maxCount: 0,
    /** 是否点击中键时关闭标签。允许值：true | false */
    middleClickToClose: false,
    /** 是否持久化标签。允许值：true | false */
    persist: true,
    /** 是否开启多标签页图标。允许值：true | false */
    showIcon: true,
    /** 显示最大化按钮。允许值：true | false */
    showMaximize: true,
    /** 显示更多按钮。允许值：true | false */
    showMore: true,
    /** 显示刷新按钮。允许值：true | false */
    showRefresh: true,
    /** 标签页风格。允许值：'brisk' | 'card' | 'chrome' | 'plain' */
    styleType: 'chrome',
    /** 是否开启访问历史记录。允许值：true | false */
    visitHistory: true,
    /** 是否开启鼠标滚轮响应。允许值：true | false */
    wheelable: true,
  },
  /** 主题配置 */
  theme: {
    /** 内置主题名。允许值：'custom' | 'deep-blue' | 'deep-green' | 'default' | 'gray' | 'green' | 'neutral' | 'orange' | 'pink' | 'red' | 'rose' | 'sky-blue' | 'slate' | 'stone' | 'violet' | 'yellow' | 'zinc' | string */
    builtinType: 'default',
    /** 错误色。允许值：string */
    colorDestructive: 'hsl(348 100% 61%)',
    /** 主题色。允许值：string */
    colorPrimary: 'hsl(212 100% 45%)',
    /** 成功色。允许值：string */
    colorSuccess: 'hsl(144 57% 58%)',
    /** 警告色。允许值：string */
    colorWarning: 'hsl(42 84% 61%)',
    /** 字体大小，单位 px。允许值：number */
    fontSize: 16,
    /** 当前主题。允许值：'auto' | 'dark' | 'light' */
    mode: 'light',
    /** 圆角。允许值：string */
    radius: '0.5',
    /** 是否开启半深色 header，只在 theme.mode='light' 时生效。允许值：true | false */
    semiDarkHeader: false,
    /** 是否开启半深色菜单，只在 theme.mode='light' 时生效。允许值：true | false */
    semiDarkSidebar: false,
    /** 是否开启半深色子菜单，只在 theme.mode='light' 时生效。允许值：true | false */
    semiDarkSidebarSub: false,
  },
  /** 动画配置 */
  transition: {
    /** 页面切换动画是否启用。允许值：true | false */
    enable: true,
    /** 是否开启页面加载 loading。允许值：true | false */
    loading: true,
    /** 页面切换动画。允许值：'fade' | 'fade-down' | 'fade-slide' | 'fade-up' | string */
    name: 'fade-slide',
    /** 是否开启页面加载进度动画。允许值：true | false */
    progress: true,
  },
  /** 功能配置 */
  widget: {
    /** 是否启用全屏部件。允许值：true | false */
    fullscreen: true,
    /** 是否启用全局搜索部件。允许值：true | false */
    globalSearch: true,
    /** 是否启用语言切换部件。允许值：true | false */
    languageToggle: true,
    /** 是否开启锁屏功能。允许值：true | false */
    lockScreen: true,
    /** 是否显示通知部件。允许值：true | false */
    notification: false,
    /** 显示刷新按钮。允许值：true | false */
    refresh: true,
    /** 是否显示侧边栏显示/隐藏部件。允许值：true | false */
    sidebarToggle: true,
    /** 是否显示主题切换部件。允许值：true | false */
    themeToggle: true,
    /** 是否显示时区部件。允许值：true | false */
    timezone: false,
  },
});
