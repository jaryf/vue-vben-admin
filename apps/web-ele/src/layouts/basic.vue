<script lang="ts" setup>
import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';

import { useWatermark } from '@vben/hooks';
import { BasicLayout, UserDropdown } from '@vben/layouts';
import { preferences, usePreferences } from '@vben/preferences';
import { useUserStore } from '@vben/stores';

import { useAuthStore } from '#/store';

const router = useRouter();
const userStore = useUserStore();
const authStore = useAuthStore();
const { destroyWatermark, updateWatermark } = useWatermark();
const { isDark } = usePreferences();
const avatar = computed(() => userStore.userInfo?.avatar ?? preferences.app.defaultAvatar);
const menus = computed(() => [
  {
    handler: () => router.push({ name: 'ProfileSettings' }),
    icon: 'lucide:user',
    text: '个人中心',
  },
]);

async function handleLogout() {
  await authStore.logout(false);
}

watch(
  () => ({
    enable: preferences.app.watermark,
    content: preferences.app.watermarkContent,
    isDark: isDark.value,
  }),
  async ({ enable, content, isDark: isDarkValue }) => {
    if (!enable) {
      destroyWatermark();
      return;
    }
    const watermarkColor = isDarkValue
      ? 'rgba(255, 255, 255, 0.12)'
      : 'rgba(0, 0, 0, 0.12)';
    await updateWatermark({
      advancedStyle: {
        colorStops: [
          { color: watermarkColor, offset: 0 },
          { color: watermarkColor, offset: 1 },
        ],
        type: 'linear',
      },
      content: content || `${userStore.userInfo?.username} - ${userStore.userInfo?.realName}`,
    });
  },
  { immediate: true },
);
</script>

<template>
  <BasicLayout
    :avatar
    :text="userStore.userInfo?.realName"
    @clear-preferences-and-logout="handleLogout"
    @logout="handleLogout"
  >
    <template #user-dropdown>
      <UserDropdown
        :avatar
        :menus
        :text="userStore.userInfo?.realName"
        :description="userStore.userInfo?.username"
        @clear-preferences-and-logout="handleLogout"
        @logout="handleLogout"
      />
    </template>
  </BasicLayout>
</template>
