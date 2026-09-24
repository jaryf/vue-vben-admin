<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import { requestClient } from '#/api/request';

interface Metric { value: number; definition: string }
interface Rate { percent: null | number; numerator: number; denominator: number; definition: string }
interface Overview {
  timezone: string; rangeStart: string; rangeEnd: string; generatedAt: string;
  registeredUsers: Metric; activeUsers: Metric;
  publishedBottles: Metric; bottlePicks: Metric; bottleReplies: Metric; bottleReplyRate: Rate;
  userBottles: Metric; virtualBottles: Metric; virtualBottleShare: Rate;
  reviewsApproved: Metric; reviewsRejected: Metric; reviewBacklog: Metric;
  submittedReports: Metric; penalties: Metric; localMessages: Metric;
  aiModelCalls: Metric; aiFailedCalls: Metric; aiFailureRate: Rate;
  aiRecordedCostMicros: Metric; aiUnpricedCalls: Metric;
  paidOrders: Metric; ordersCreated: Metric; ordersPaidFromCreated: Metric;
  paymentSuccessRate: Rate; refundEvents: Metric;
  paidAmounts: Array<{ currency: string; amountMinor: number }>;
}

const userStore = useUserStore();
const overview = ref<Overview | null>(null);
const loading = ref(false);
const unavailable = ref(false);
const metricGroups = [
  { title: '用户与内容', metrics: [
    { key: 'registeredUsers', title: '新注册用户' }, { key: 'activeUsers', title: '活跃用户' },
    { key: 'publishedBottles', title: '已发布漂流瓶' }, { key: 'bottlePicks', title: '拾取记录' },
    { key: 'bottleReplies', title: '已回复拾取' }, { key: 'userBottles', title: '用户发布内容' },
    { key: 'virtualBottles', title: '平台虚拟内容' },
  ] },
  { title: '审核与安全', metrics: [
    { key: 'reviewsApproved', title: '审核通过' }, { key: 'reviewsRejected', title: '审核拒绝' },
    { key: 'reviewBacklog', title: '当前人工积压' }, { key: 'submittedReports', title: '收到举报' },
    { key: 'penalties', title: '新增处罚' }, { key: 'localMessages', title: '本地消息元数据' },
  ] },
  { title: 'AI 与商业化', metrics: [
    { key: 'aiModelCalls', title: 'AI 模型调用' }, { key: 'aiFailedCalls', title: 'AI 失败或拒绝' },
    { key: 'aiRecordedCostMicros', title: '已记录 AI 成本微单位' }, { key: 'aiUnpricedCalls', title: '未记录成本调用' },
    { key: 'ordersCreated', title: '新增订单' }, { key: 'ordersPaidFromCreated', title: '当日新单已支付' },
    { key: 'paidOrders', title: '当日支付订单' }, { key: 'refundEvents', title: '退款或拒付事件' },
  ] },
] as const;
const rateLabels = [
  { key: 'bottleReplyRate', title: '漂流瓶回复率' },
  { key: 'virtualBottleShare', title: '平台虚拟内容占比' },
  { key: 'aiFailureRate', title: 'AI 失败率' },
  { key: 'paymentSuccessRate', title: '新单支付成功率' },
] as const;
const rateText = (rate: Rate) => rate.percent === null ? '—' : `${rate.percent.toFixed(1)}%`;

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
      <ElAlert :title="`统计范围：${overview.rangeStart} 至 ${overview.rangeEnd}（不含结束时刻）；时区：${overview.timezone}；生成时间：${overview.generatedAt}；读取时实时聚合`" type="info" show-icon :closable="false" class="mb-5" />
      <section v-for="group in metricGroups" :key="group.title" class="mb-6">
        <h2 class="mb-3 text-lg font-medium">{{ group.title }}</h2>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ElCard v-for="item in group.metrics" :key="item.key" shadow="never">
            <div class="text-sm text-gray-500">{{ item.title }}</div>
            <div class="mt-3 text-3xl font-semibold">{{ overview[item.key].value.toLocaleString('zh-CN') }}</div>
            <div class="mt-3 text-xs text-gray-500">{{ overview[item.key].definition }}</div>
          </ElCard>
        </div>
      </section>
      <section class="mb-6">
        <h2 class="mb-3 text-lg font-medium">比例与金额</h2>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ElCard v-for="item in rateLabels" :key="item.key" shadow="never">
            <div class="text-sm text-gray-500">{{ item.title }}</div>
            <div class="mt-3 text-3xl font-semibold">{{ rateText(overview[item.key]) }}</div>
            <div class="mt-2 text-xs text-gray-500">分子 {{ overview[item.key].numerator.toLocaleString('zh-CN') }} / 分母 {{ overview[item.key].denominator.toLocaleString('zh-CN') }}</div>
            <div class="mt-2 text-xs text-gray-500">{{ overview[item.key].definition }}</div>
          </ElCard>
        </div>
        <ElCard class="mt-4" shadow="never"><template #header>按币种统计的原始已支付额</template>
          <ElEmpty v-if="overview.paidAmounts.length === 0" description="统计范围内没有支付订单" />
          <ElTable v-else :data="overview.paidAmounts"><ElTableColumn prop="currency" label="币种" width="120" /><ElTableColumn label="最小货币单位金额"><template #default="{ row }">{{ row.amountMinor.toLocaleString('zh-CN') }}</template></ElTableColumn></ElTable>
          <p class="mt-2 text-xs text-gray-500">按 paid_at 汇总订单 amount_minor，不做币种换算，也不扣除后来发生的退款或拒付。</p>
        </ElCard>
      </section>
      <ElAlert title="即时通讯服务全量消息、回调异常和外部系统告警尚无统一聚合接口，当前统计不可用；本页仅展示本地消息元数据。" type="warning" show-icon :closable="false" />
    </template>
  </div>
</template>
