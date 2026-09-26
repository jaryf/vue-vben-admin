<script setup lang="ts">
import type {
  ExternalCapabilities,
  ExternalCapabilityCode,
  ExternalCapabilityState,
} from '#/api/dashboard';

import { onMounted, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import {
  ElAlert,
  ElButton,
  ElCard,
  ElEmpty,
  ElTable,
  ElTableColumn,
} from 'element-plus';

import { getExternalCapabilities } from '#/api/dashboard';
import { requestClient } from '#/api/request';
import AdminEnumTag from '#/components/admin-enum-tag.vue';
import AdminPage from '#/components/admin-page.vue';
import AdminTime from '#/components/admin-time.vue';

interface Metric {
  value: number;
  definition: string;
}
interface Rate {
  percent: null | number;
  numerator: number;
  denominator: number;
  definition: string;
}
interface Overview {
  timezone: string;
  rangeStart: string;
  rangeEnd: string;
  generatedAt: string;
  registeredUsers: Metric;
  activeUsers: Metric;
  publishedBottles: Metric;
  bottlePicks: Metric;
  bottleReplies: Metric;
  bottleReplyRate: Rate;
  userBottles: Metric;
  virtualBottles: Metric;
  virtualBottleShare: Rate;
  reviewsApproved: Metric;
  reviewsRejected: Metric;
  reviewBacklog: Metric;
  submittedReports: Metric;
  penalties: Metric;
  localMessages: Metric;
  aiModelCalls: Metric;
  aiFailedCalls: Metric;
  aiFailureRate: Rate;
  aiRecordedCostMicros: Metric;
  aiUnpricedCalls: Metric;
  paidOrders: Metric;
  ordersCreated: Metric;
  ordersPaidFromCreated: Metric;
  paymentSuccessRate: Rate;
  refundEvents: Metric;
  paidAmounts: Array<{ currency: string; amountMinor: number }>;
}

const userStore = useUserStore();
const overview = ref<null | Overview>(null);
const loading = ref(false);
const unavailable = ref(false);
const capabilities = ref<ExternalCapabilities | null>(null);
const capabilitiesLoading = ref(false);
const capabilitiesUnavailable = ref(false);
const metricGroups = [
  {
    title: '用户与内容',
    description: '关注用户活跃与内容流转',
    tone: 'blue',
    metrics: [
      { key: 'registeredUsers', title: '新注册用户' },
      { key: 'activeUsers', title: '活跃用户' },
      { key: 'publishedBottles', title: '已发布漂流瓶' },
      { key: 'bottlePicks', title: '拾取记录' },
      { key: 'bottleReplies', title: '已回复拾取' },
      { key: 'userBottles', title: '用户发布内容' },
      { key: 'virtualBottles', title: '平台虚拟内容' },
    ],
  },
  {
    title: '审核与安全',
    description: '追踪审核效率与社区治理',
    tone: 'amber',
    metrics: [
      { key: 'reviewsApproved', title: '审核通过' },
      { key: 'reviewsRejected', title: '审核拒绝' },
      { key: 'reviewBacklog', title: '当前人工积压' },
      { key: 'submittedReports', title: '收到举报' },
      { key: 'penalties', title: '新增处罚' },
      { key: 'localMessages', title: '本地消息元数据' },
    ],
  },
  {
    title: 'AI 与商业化',
    description: '查看模型调用和交易表现',
    tone: 'violet',
    metrics: [
      { key: 'aiModelCalls', title: 'AI 模型调用' },
      { key: 'aiFailedCalls', title: 'AI 失败或拒绝' },
      { key: 'aiRecordedCostMicros', title: '已记录 AI 成本微单位' },
      { key: 'aiUnpricedCalls', title: '未记录成本调用' },
      { key: 'ordersCreated', title: '新增订单' },
      { key: 'ordersPaidFromCreated', title: '当日新单已支付' },
      { key: 'paidOrders', title: '当日支付订单' },
      { key: 'refundEvents', title: '退款或拒付事件' },
    ],
  },
] as const;
const rateLabels = [
  { key: 'bottleReplyRate', title: '漂流瓶回复率' },
  { key: 'virtualBottleShare', title: '平台虚拟内容占比' },
  { key: 'aiFailureRate', title: 'AI 失败率' },
  { key: 'paymentSuccessRate', title: '新单支付成功率' },
] as const;
const rateText = (rate: Rate) =>
  rate.percent === null ? '—' : `${rate.percent.toFixed(1)}%`;
const capabilityLabels: Record<ExternalCapabilityCode, string> = {
  ai_generation: 'AI 内容生成',
  ai_moderation: 'AI 内容审核',
  ai_reply: 'AI 回复',
  app_store: 'App Store 通知',
  google_play: 'Google Play 通知',
  im: '即时通讯',
  media_processing: '媒体处理',
  object_storage: '对象存储',
  smtp: '邮件投递',
};
const capabilityStateLabels: Record<ExternalCapabilityState, string> = {
  available: '可用',
  degraded: '异常',
  disabled: '已关闭',
  unconfigured: '未配置',
  unobserved: '尚未观测',
};
const capabilityStateTypes: Record<
  ExternalCapabilityState,
  'danger' | 'info' | 'success' | 'warning'
> = {
  available: 'success',
  degraded: 'danger',
  disabled: 'info',
  unconfigured: 'warning',
  unobserved: 'info',
};
const capabilityText = (code: ExternalCapabilityCode) =>
  capabilityLabels[code] || code;
const capabilityStateText = (state: ExternalCapabilityState) =>
  capabilityStateLabels[state] || state;
const capabilityStateType = (state: ExternalCapabilityState) =>
  capabilityStateTypes[state] || 'info';

async function load() {
  loading.value = true;
  unavailable.value = false;
  try {
    overview.value = await requestClient.get<Overview>('/dashboard/overview');
  } catch {
    overview.value = null;
    unavailable.value = true;
  } finally {
    loading.value = false;
  }
}

async function loadCapabilities() {
  capabilitiesLoading.value = true;
  capabilitiesUnavailable.value = false;
  try {
    capabilities.value = await getExternalCapabilities();
  } catch {
    capabilities.value = null;
    capabilitiesUnavailable.value = true;
  } finally {
    capabilitiesLoading.value = false;
  }
}

function refresh() {
  void Promise.all([load(), loadCapabilities()]);
}

onMounted(refresh);
</script>

<template>
  <AdminPage
    class="workspace-page"
    title="运营工作台"
    :description="`欢迎回来，${userStore.userInfo?.realName || userStore.userInfo?.username || '管理员'}。这里汇总了当前业务表现与服务状态。`"
  >
    <template #actions>
      <ElButton
        type="primary"
        plain
        :loading="loading || capabilitiesLoading"
        @click="refresh"
      >
        刷新数据
      </ElButton>
    </template>
    <ElAlert
      v-if="unavailable"
      title="统计服务暂时不可用，请稍后重试"
      type="warning"
      show-icon
      :closable="false"
    />
    <div
      v-if="loading && !overview && !unavailable"
      v-loading="loading"
      class="workspace-loading admin-panel"
      aria-label="正在加载统计数据"
    ></div>
    <template v-if="overview">
      <div class="workspace-period">
        <div>
          <span class="workspace-period__label">统计范围</span><AdminTime :value="overview.rangeStart" />
          <span class="workspace-muted">至</span>
          <AdminTime :value="overview.rangeEnd" /><span class="workspace-muted">（不含结束时刻）</span>
        </div>
        <div class="workspace-period__meta">
          <span>时区 {{ overview.timezone }}</span><span>更新于 <AdminTime :value="overview.generatedAt" /></span><span>读取时实时聚合</span>
        </div>
      </div>
      <section
        v-for="group in metricGroups"
        :key="group.title"
        class="workspace-section"
        :class="`workspace-section--${group.tone}`"
      >
        <div class="workspace-section__heading">
          <h2>{{ group.title }}</h2>
          <p>{{ group.description }}</p>
        </div>
        <div class="workspace-metrics">
          <ElCard
            v-for="item in group.metrics"
            :key="item.key"
            shadow="never"
            class="workspace-metric"
          >
            <div class="workspace-metric__label">{{ item.title }}</div>
            <div class="workspace-metric__value">
              {{ overview[item.key].value.toLocaleString('zh-CN') }}
            </div>
            <p class="workspace-metric__definition">
              {{ overview[item.key].definition }}
            </p>
          </ElCard>
        </div>
      </section>
      <section class="workspace-section">
        <div class="workspace-section__heading">
          <h2>比例与金额</h2>
          <p>按统一统计口径查看转化与支付</p>
        </div>
        <div class="workspace-metrics">
          <ElCard
            v-for="item in rateLabels"
            :key="item.key"
            shadow="never"
            class="workspace-metric workspace-rate"
          >
            <div class="workspace-metric__label">{{ item.title }}</div>
            <div class="workspace-metric__value">
              {{ rateText(overview[item.key]) }}
            </div>
            <div
              class="workspace-rate__track"
              role="img"
              :aria-label="`${item.title}：${rateText(overview[item.key])}`"
            >
              <span
                :style="{
                  width: `${Math.min(100, Math.max(0, overview[item.key].percent ?? 0))}%`,
                }"
              ></span>
            </div>
            <p class="workspace-metric__definition">
              分子 {{ overview[item.key].numerator.toLocaleString('zh-CN') }} /
              分母 {{ overview[item.key].denominator.toLocaleString('zh-CN') }}
            </p>
            <p class="workspace-metric__definition">
              {{ overview[item.key].definition }}
            </p>
          </ElCard>
        </div>
        <ElCard class="mt-4" shadow="never">
          <template #header>按币种统计的原始已支付额</template>
          <ElEmpty
            v-if="overview.paidAmounts.length === 0"
            :image-size="72"
            description="统计范围内没有支付订单"
          />
          <ElTable v-else :data="overview.paidAmounts">
            <ElTableColumn
              prop="currency"
              label="币种"
              width="120"
            /><ElTableColumn label="最小货币单位金额">
              <template #default="{ row }">
                <span class="admin-number">{{
                  row.amountMinor.toLocaleString('zh-CN')
                }}</span>
              </template>
            </ElTableColumn>
          </ElTable>
          <p class="workspace-note">
            按 paid_at 汇总订单
            amount_minor，不做币种换算，也不扣除后来发生的退款或拒付。
          </p>
        </ElCard>
      </section>
    </template>
    <section class="workspace-section">
      <div class="workspace-section__heading">
        <h2>外部能力状态</h2>
        <p v-if="capabilities">
          更新于 <AdminTime :value="capabilities.generatedAt" />
        </p>
      </div>
      <ElAlert
        v-if="capabilitiesUnavailable"
        title="外部能力状态暂时无法读取，不影响上方业务指标"
        type="warning"
        show-icon
        :closable="false"
      />
      <ElCard v-else v-loading="capabilitiesLoading" shadow="never">
        <ElAlert
          class="mb-4"
          :type="capabilities?.partial ? 'warning' : 'info'"
          show-icon
          :closable="false"
          :title="
            capabilities?.partial
              ? '部分状态数据源暂时不可用，请以各项稳定错误码为准；以下仍是最近业务记录的被动观测结果，不是实时探活。'
              : '以下是最近业务记录的被动观测结果，页面加载不会主动请求第三方服务，不是实时探活。'
          "
        />
        <ElTable :data="capabilities?.items || []" row-key="code">
          <ElTableColumn label="能力" min-width="155">
            <template #default="{ row }">
              {{ capabilityText(row.code) }}
            </template>
          </ElTableColumn>
          <ElTableColumn prop="provider" label="服务商" min-width="130">
            <template #default="{ row }">
              {{ row.provider || '—' }}
            </template>
          </ElTableColumn>
          <ElTableColumn label="状态" width="125">
            <template #default="{ row }">
              <AdminEnumTag
                :value="row.state"
                :label="capabilityStateText(row.state)"
                :tone="capabilityStateType(row.state)"
              />
            </template>
          </ElTableColumn>
          <ElTableColumn label="开关 / 配置" min-width="200">
            <template #default="{ row }">
              <div class="flex flex-wrap gap-2">
                <AdminEnumTag
                  :value="row.enabled"
                  :label="row.enabled ? '已开启' : '已关闭'"
                /><AdminEnumTag
                  :value="row.configured ? 'configured' : 'unconfigured'"
                />
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="最近成功" min-width="175">
            <template #default="{ row }">
              <AdminTime :value="row.lastSuccessAt" />
            </template>
          </ElTableColumn>
          <ElTableColumn label="最近失败" min-width="175">
            <template #default="{ row }">
              <AdminTime :value="row.lastFailureAt" />
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="lastErrorCode"
            label="稳定错误码"
            min-width="165"
          >
            <template #default="{ row }">
              {{ row.lastErrorCode || '—' }}
            </template>
          </ElTableColumn>
        </ElTable>
      </ElCard>
    </section>
  </AdminPage>
</template>

<style scoped>
.workspace-loading {
  min-height: 220px;
}

.workspace-muted,
.workspace-note {
  color: var(--el-text-color-secondary);
}

.workspace-period {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 24px;
  align-items: center;
  justify-content: space-between;
  padding: 15px 18px;
  margin-bottom: 28px;
  font-size: 12px;
  line-height: 1.9;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
}

.workspace-period__label {
  margin-right: 14px;
  font-weight: 600;
}

.workspace-period__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 16px;
  color: var(--el-text-color-secondary);
}

.workspace-section {
  --metric-accent: var(--el-color-primary);

  margin-top: 28px;
}

.workspace-section--amber {
  --metric-accent: var(--el-color-warning);
}

.workspace-section--violet {
  --metric-accent: #8b5cf6;
}

.workspace-section__heading {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  align-items: baseline;
  margin-bottom: 14px;
}

.workspace-section__heading h2 {
  padding-left: 11px;
  font-size: 16px;
  font-weight: 650;
  line-height: 1.2;
  border-left: 3px solid var(--metric-accent);
}

.workspace-section__heading p {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.workspace-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.workspace-metric {
  position: relative;
}

.workspace-metric::before {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  content: '';
  background: var(--metric-accent);
  opacity: 0.55;
}

.workspace-metric__label {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.workspace-metric__value {
  margin: 13px 0 11px;
  font-size: 30px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  letter-spacing: -0.7px;
}

.workspace-metric__definition,
.workspace-note {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.7;
}

.workspace-metric__definition {
  color: var(--el-text-color-secondary);
}

.workspace-rate__track {
  height: 4px;
  overflow: hidden;
  background: var(--el-fill-color);
  border-radius: 4px;
}

.workspace-rate__track span {
  display: block;
  height: 100%;
  background: var(--el-color-primary);
  border-radius: inherit;
}

@media (max-width: 1280px) {
  .workspace-metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1000px) {
  .workspace-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .workspace-metrics {
    grid-template-columns: 1fr;
  }

  .workspace-period {
    padding: 13px;
  }
}
</style>
