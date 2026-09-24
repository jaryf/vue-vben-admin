<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import { getMFAStatusApi } from '#/api/core/auth';

const userStore = useUserStore();
const mfaEnabled = ref<boolean | null>(null);

onMounted(async () => {
  try {
    mfaEnabled.value = (await getMFAStatusApi()).enabled;
  } catch {
    mfaEnabled.value = null;
  }
});
</script>

<template>
  <div class="p-6">
    <h1 class="mb-2 text-2xl font-semibold">Driftly 运营工作台</h1>
    <p class="mb-6 text-gray-500">欢迎，{{ userStore.userInfo?.realName || userStore.userInfo?.username }}。</p>
    <ElCard>
      <template #header>管理员安全状态</template>
      <div class="flex items-center gap-4">
        <span>双因素认证</span>
        <ElTag v-if="mfaEnabled === true" type="success">已启用</ElTag>
        <ElTag v-else-if="mfaEnabled === false" type="danger">未启用</ElTag>
        <ElTag v-else type="info">暂时无法获取</ElTag>
      </div>
    </ElCard>
  </div>
</template>
