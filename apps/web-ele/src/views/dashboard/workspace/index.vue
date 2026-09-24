<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import { requestClient } from '#/api/request';

interface Metric { value: number; definition: string }
interface Overview {
  timezone: string; rangeStart: string; rangeEnd: string; generatedAt: string;
  registeredUsers: Metric; publishedBottles: Metric;
  submittedReports: Metric; paidOrders: Metric;
}

const userStore = useUserStore();
const overview = ref<Overview | null>(null);
const loading = ref(false);
const unavailable = ref(false);
const metricLabels = [
  { key: 'registeredUsers', title: '新注册用户' },
  { key: 'publishedBottles', title: '已发布漂流瓶' },
  { key: 'submittedReports', title: '收到的举报' },
  { key: 'paidOrders', title: '已支付订单' },
] as const;

async function load() {
  loading.value = true;
  unavailable.value = false;
  try { overview.value = await requestClient.get<Overview>('/dashboard/overview'); }
  catch { overview.value = null; unavailable.value = true; }
  finally { loading.value = false; }
}

onMounted(() => { void load(); });
</script>

<template>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <div><h1 class="text-2xl font-semibold">Driftly 运营工作台</h1><p class="mt-1 text-gray-500">欢迎，{{ userStore.userInfo?.realName || userStore.userInfo?.username }}。</p></div>
      <ElButton :loading="loading" @click="load">刷新</ElButton>
    </div>
    <ElAlert v-if="unavailable" title="统计服务暂时不可用，请稍后重试" type="warning" show-icon :closable="false" />
    <template v-if="overview">
      <ElAlert :title="`统计范围：${overview.rangeStart} 至 ${overview.rangeEnd}（不含结束时刻）；时区：${overview.timezone}；生成时间：${overview.generatedAt}`" type="info" show-icon :closable="false" class="mb-5" />
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ElCard v-for="item in metricLabels" :key="item.key" shadow="never">
          <div class="text-sm text-gray-500">{{ item.title }}</div>
          <div class="mt-3 text-3xl font-semibold">{{ overview[item.key].value.toLocaleString('zh-CN') }}</div>
          <div class="mt-3 text-xs text-gray-500">{{ overview[item.key].definition }}</div>
        </ElCard>
      </div>
    </template>
  </div>
</template>
