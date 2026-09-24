<script lang="ts" setup>
import { computed } from 'vue';

import { AuthPageLayout } from '@vben/layouts';
import { preferences } from '@vben/preferences';

const appName = computed(() => preferences.app.name);
const logo = computed(() => preferences.logo.source);
const logoDark = computed(() => preferences.logo.sourceDark);
</script>

<template>
  <AuthPageLayout
    :app-name="appName"
    :logo="logo"
    :logo-dark="logoDark"
    page-description="仅供授权管理员使用"
    page-title="Driftly 运营与安全管理"
  >
    <!-- 自定义工具栏 -->
    <!-- <template #toolbar></template> -->
  </AuthPageLayout>
</template>
