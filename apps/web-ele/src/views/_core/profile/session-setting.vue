<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { ElMessageBox } from 'element-plus';

import { getCurrentSessionApi, type AdminSession } from '#/api/core/auth';
import { useAuthStore } from '#/store';

const authStore = useAuthStore();
const session = ref<AdminSession>();
const loading = ref(false);
const ending = ref(false);

async function load() {
  loading.value = true;
  try {
    session.value = await getCurrentSessionApi();
  } finally {
    loading.value = false;
  }
}

async function endSession() {
  try {
    await ElMessageBox.confirm('结束当前登录后，此会话的所有令牌立即失效。', '结束会话', {
      confirmButtonText: '结束会话',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  ending.value = true;
  try {
    await authStore.logout(false);
  } finally {
    ending.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div v-loading="loading" class="max-w-xl space-y-5">
    <ElAlert
      title="同一管理员账号仅保留最近一次登录；新登录会使旧会话立即失效。"
      type="info"
      show-icon
      :closable="false"
    />
    <template v-if="session?.active">
      <ElDescriptions :column="1" border>
        <ElDescriptionsItem label="状态">当前会话有效</ElDescriptionsItem>
        <ElDescriptionsItem label="会话编号">{{ session.sessionId }}</ElDescriptionsItem>
        <ElDescriptionsItem label="无操作锁定">{{ session.idleTimeoutSeconds / 60 }} 分钟</ElDescriptionsItem>
        <ElDescriptionsItem label="最长登录时长">{{ session.absoluteTimeoutSeconds / 3600 }} 小时</ElDescriptionsItem>
      </ElDescriptions>
      <ElButton type="danger" :loading="ending" @click="endSession">结束当前会话</ElButton>
    </template>
  </div>
</template>
