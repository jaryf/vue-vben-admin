<script setup lang="ts">
import type { RiskEvent } from '#/api/risk-events';

import { onMounted, reactive, ref } from 'vue';

import { useTimezoneStore } from '@vben/stores';

import {
  ElButton,
  ElCard,
  ElDatePicker,
  ElDescriptions,
  ElDescriptionsItem,
  ElDivider,
  ElDrawer,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
  ElTable,
  ElTableColumn,
} from 'element-plus';

import { getRiskEvent, listRiskEvents } from '#/api/risk-events';
import AdminEnumTag from '#/components/admin-enum-tag.vue';
import AdminPage from '#/components/admin-page.vue';
import AdminTime from '#/components/admin-time.vue';
import { adminDateTimeRangeToUtc } from '#/utils/admin-datetime';

const timezoneStore = useTimezoneStore();

const rows = ref<RiskEvent[]>([]);
const nextCursor = ref<null | string>(null);
const cursorStack = ref<string[]>([]);
const loading = ref(false);
const detail = ref<null | RiskEvent>(null);
const detailOpen = ref(false);
const filter = reactive({
  userId: '',
  eventType: '',
  severity: '',
  sourceType: '',
  sourceId: '',
  actorType: '',
  actorId: '',
  occurredRange: [] as string[],
});
const appliedFilter = ref<Record<string, unknown>>({});
const severities = [
  ['info', '信息'],
  ['low', '低'],
  ['medium', '中'],
  ['high', '高'],
  ['critical', '严重'],
] as const;
const eventTypes = [
  ['report.submitted', '举报提交'],
  ['report.resolved_valid', '举报属实'],
  ['report.resolved_invalid', '举报不成立'],
  ['report.closed_duplicate', '重复举报'],
  ['penalty.created', '处罚创建'],
  ['penalty.revoked', '处罚撤销'],
] as const;
const sourceTypes = [
  ['report', '举报'],
  ['penalty', '处罚'],
] as const;
const actorTypes = [
  ['user', '用户'],
  ['admin', '管理员'],
  ['system', '系统'],
] as const;
function eventText(value: string) {
  return eventTypes.find(([key]) => key === value)?.[1] || value;
}
function severityText(value: string) {
  return severities.find(([key]) => key === value)?.[1] || value;
}
async function load(cursor = '') {
  loading.value = true;
  try {
    const result = await listRiskEvents({
      ...appliedFilter.value,
      cursor: cursor || undefined,
      limit: 20,
    });
    rows.value = result.items || [];
    nextCursor.value = result.nextCursor;
  } finally {
    loading.value = false;
  }
}
function search() {
  let occurredRange: [string, string] | undefined;
  try {
    occurredRange = adminDateTimeRangeToUtc(
      filter.occurredRange,
      timezoneStore.timezone,
    );
  } catch (error) {
    ElMessage.warning(
      error instanceof Error ? error.message : '发生时间范围无效',
    );
    return;
  }
  appliedFilter.value = {
    userId: filter.userId.trim() || undefined,
    eventType: filter.eventType || undefined,
    severity: filter.severity || undefined,
    sourceType: filter.sourceType || undefined,
    sourceId: filter.sourceId.trim() || undefined,
    actorType: filter.actorType || undefined,
    actorId: filter.actorId.trim() || undefined,
    occurredFrom: occurredRange?.[0],
    occurredUntil: occurredRange?.[1],
  };
  cursorStack.value = [];
  void load();
}
function next() {
  if (!nextCursor.value) return;
  cursorStack.value.push(nextCursor.value);
  void load(nextCursor.value);
}
function previous() {
  cursorStack.value.pop();
  void load(cursorStack.value.at(-1) || '');
}
async function openDetail(row: RiskEvent) {
  detail.value = await getRiskEvent(row.eventId);
  detailOpen.value = true;
}
onMounted(search);
</script>

<template>
  <AdminPage
    title="风险事件"
    description="按风险等级与事件来源追踪用户安全记录。"
  >
    <ElCard shadow="never">
      <div class="admin-filter">
        <ElInput
          v-model="filter.userId"
          placeholder="用户 ID"
          clearable
          class="!w-32"
        /><ElSelect
          v-model="filter.eventType"
          clearable
          placeholder="全部事件"
          class="!w-40"
        >
          <ElOption
            v-for="[value, label] in eventTypes"
            :key="value"
            :label="label"
            :value="value"
          />
</ElSelect><ElSelect
          v-model="filter.severity"
          clearable
          placeholder="全部等级"
          class="!w-32"
        >
          <ElOption
            v-for="[value, label] in severities"
            :key="value"
            :label="label"
            :value="value"
          />
</ElSelect><ElSelect
          v-model="filter.sourceType"
          clearable
          placeholder="全部来源"
          class="!w-32"
        >
          <ElOption
            v-for="[value, label] in sourceTypes"
            :key="value"
            :label="label"
            :value="value"
          />
</ElSelect><ElInput
          v-model="filter.sourceId"
          placeholder="来源 ID"
          clearable
          class="!w-32"
        /><ElSelect
          v-model="filter.actorType"
          clearable
          placeholder="全部操作主体"
          class="!w-36"
        >
          <ElOption
            v-for="[value, label] in actorTypes"
            :key="value"
            :label="label"
            :value="value"
          />
</ElSelect><ElInput
          v-model="filter.actorId"
          placeholder="操作主体 ID"
          clearable
          class="!w-36"
        /><ElDatePicker
          v-model="filter.occurredRange"
          type="datetimerange"
          value-format="YYYY-MM-DD HH:mm:ss"
          range-separator="至"
          start-placeholder="发生开始"
          end-placeholder="发生结束"
          class="!w-[390px]"
        /><ElButton @click="search" type="primary">查询</ElButton>
      </div>
      <ElTable v-loading="loading" :data="rows" row-key="eventId">
        <ElTableColumn
          prop="eventId"
          label="事件 ID"
          width="100"
        /><ElTableColumn
          prop="userId"
          label="用户 ID"
          width="100"
        /><ElTableColumn label="事件类型" min-width="190">
          <template #default="{ row }">
            <AdminEnumTag
              :value="row.eventType"
              :label="eventText(row.eventType)"
            />
          </template>
</ElTableColumn><ElTableColumn label="等级" width="105">
          <template #default="{ row }">
            <AdminEnumTag
              :value="row.severity"
              :label="severityText(row.severity)"
            />
          </template>
</ElTableColumn><ElTableColumn label="来源" min-width="140">
          <template #default="{ row }">
            <AdminEnumTag :value="row.sourceType" /> #{{ row.sourceId }}
          </template>
</ElTableColumn><ElTableColumn
          prop="reasonCode"
          label="原因代码"
          min-width="165"
        /><ElTableColumn prop="occurredAt" label="发生时间" min-width="175">
          <template #default="{ row }">
            <AdminTime :value="row.occurredAt" />
          </template>
</ElTableColumn><!-- @vue-generic {RiskEvent} --><ElTableColumn
          label="操作"
          width="85"
        >
          <template #default="{ row }">
            <ElButton link type="primary" @click="openDetail(row)">
              详情
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
      <div class="admin-pagination">
        <ElButton :disabled="cursorStack.length === 0" @click="previous">
          上一页
</ElButton><ElButton :disabled="!nextCursor" @click="next">下一页</ElButton>
      </div>
</ElCard><ElDrawer v-model="detailOpen" title="风险事件详情" size="50%">
      <ElDescriptions v-if="detail" :column="1" border>
        <ElDescriptionsItem label="事件 ID">
          {{ detail.eventId }}
</ElDescriptionsItem><ElDescriptionsItem label="用户 ID">
          {{ detail.userId ?? '—' }}
</ElDescriptionsItem><ElDescriptionsItem label="类型">
          <AdminEnumTag
            :value="detail.eventType"
            :label="eventText(detail.eventType)"
          />
</ElDescriptionsItem><ElDescriptionsItem label="等级">
          <AdminEnumTag
            :value="detail.severity"
            :label="severityText(detail.severity)"
          />
</ElDescriptionsItem><ElDescriptionsItem label="来源">
          <AdminEnumTag :value="detail.sourceType" /> #{{
            detail.sourceId
          }}
</ElDescriptionsItem><ElDescriptionsItem label="操作主体">
          <AdminEnumTag :value="detail.actorType" /> #{{
            detail.actorId ?? '—'
          }}
</ElDescriptionsItem><ElDescriptionsItem label="原因代码">
          {{ detail.reasonCode }}
</ElDescriptionsItem><ElDescriptionsItem label="发生时间">
          <AdminTime :value="detail.occurredAt" />
        </ElDescriptionsItem>
</ElDescriptions><ElDivider>结构化元数据</ElDivider>
      <pre v-if="detail" class="whitespace-pre-wrap break-all">{{
        JSON.stringify(detail.metadata, null, 2)
      }}</pre>
    </ElDrawer>
  </AdminPage>
</template>
