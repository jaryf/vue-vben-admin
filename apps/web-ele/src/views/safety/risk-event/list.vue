<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';

import { ElMessage } from 'element-plus';

import { getRiskEvent, listRiskEvents } from '#/api/risk-events';
import type { RiskEvent } from '#/api/risk-events';
import AdminTime from '#/components/admin-time.vue';

const rows = ref<RiskEvent[]>([]);
const nextCursor = ref<string | null>(null);
const cursorStack = ref<string[]>([]);
const loading = ref(false);
const detail = ref<RiskEvent | null>(null);
const detailOpen = ref(false);
const filter = reactive({ userId: '', eventType: '', severity: '', sourceType: '', sourceId: '', actorType: '', actorId: '', occurredRange: [] as Date[] });
const appliedFilter = ref<Record<string, unknown>>({});
const severities = [['info', '信息'], ['low', '低'], ['medium', '中'], ['high', '高'], ['critical', '严重']];
const eventTypes = [['report.submitted', '举报提交'], ['report.resolved_valid', '举报属实'], ['report.resolved_invalid', '举报不成立'], ['report.closed_duplicate', '重复举报'], ['penalty.created', '处罚创建'], ['penalty.revoked', '处罚撤销']];
const sourceTypes = [['report', '举报'], ['penalty', '处罚']];
const actorTypes = [['user', '用户'], ['admin', '管理员'], ['system', '系统']];
function eventText(value: string) { return eventTypes.find(([key]) => key === value)?.[1] || value; }
function severityText(value: string) { return severities.find(([key]) => key === value)?.[1] || value; }
async function load(cursor = '') {
  loading.value = true;
  try {
    const result = await listRiskEvents({ ...appliedFilter.value, cursor: cursor || undefined, limit: 20 });
    rows.value = result.items || []; nextCursor.value = result.nextCursor;
  } finally { loading.value = false; }
}
function search() {
  if (filter.occurredRange?.length === 2 && filter.occurredRange[0]!.getTime() >= filter.occurredRange[1]!.getTime()) {
    ElMessage.warning('结束时间必须晚于开始时间'); return;
  }
  appliedFilter.value = {
    userId: filter.userId.trim() || undefined,
    eventType: filter.eventType || undefined,
    severity: filter.severity || undefined,
    sourceType: filter.sourceType || undefined,
    sourceId: filter.sourceId.trim() || undefined,
    actorType: filter.actorType || undefined,
    actorId: filter.actorId.trim() || undefined,
    occurredFrom: filter.occurredRange?.[0]?.toISOString(),
    occurredUntil: filter.occurredRange?.[1]?.toISOString(),
  };
  cursorStack.value = [];
  void load();
}
function next() { if (!nextCursor.value) return; cursorStack.value.push(nextCursor.value); void load(nextCursor.value); }
function previous() { cursorStack.value.pop(); void load(cursorStack.value.at(-1) || ''); }
async function openDetail(row: RiskEvent) { detail.value = await getRiskEvent(row.eventId); detailOpen.value = true; }
onMounted(search);
</script>

<template>
  <div class="p-5"><ElCard shadow="never"><template #header>风险事件</template>
    <div class="mb-4 flex flex-wrap gap-3"><ElInput v-model="filter.userId" placeholder="用户 ID" clearable class="!w-32" /><ElSelect v-model="filter.eventType" clearable placeholder="全部事件" class="!w-40"><ElOption v-for="[value, label] in eventTypes" :key="value" :label="label" :value="value" /></ElSelect><ElSelect v-model="filter.severity" clearable placeholder="全部等级" class="!w-32"><ElOption v-for="[value, label] in severities" :key="value" :label="label" :value="value" /></ElSelect><ElSelect v-model="filter.sourceType" clearable placeholder="全部来源" class="!w-32"><ElOption v-for="[value, label] in sourceTypes" :key="value" :label="label" :value="value" /></ElSelect><ElInput v-model="filter.sourceId" placeholder="来源 ID" clearable class="!w-32" /><ElSelect v-model="filter.actorType" clearable placeholder="全部操作主体" class="!w-36"><ElOption v-for="[value, label] in actorTypes" :key="value" :label="label" :value="value" /></ElSelect><ElInput v-model="filter.actorId" placeholder="操作主体 ID" clearable class="!w-36" /><ElDatePicker v-model="filter.occurredRange" type="datetimerange" range-separator="至" start-placeholder="发生开始" end-placeholder="发生结束" class="!w-[390px]" /><ElButton @click="search">查询</ElButton></div>
    <ElTable v-loading="loading" :data="rows" row-key="eventId"><ElTableColumn prop="eventId" label="事件 ID" width="100" /><ElTableColumn prop="userId" label="用户 ID" width="100" /><ElTableColumn label="事件类型" min-width="190"><template #default="{ row }">{{ eventText(row.eventType) }}</template></ElTableColumn><ElTableColumn label="等级" width="95"><template #default="{ row }">{{ severityText(row.severity) }}</template></ElTableColumn><ElTableColumn label="来源" min-width="140"><template #default="{ row }">{{ row.sourceType }} #{{ row.sourceId }}</template></ElTableColumn><ElTableColumn prop="reasonCode" label="原因代码" min-width="165" /><ElTableColumn prop="occurredAt" label="发生时间" min-width="175"><template #default="{ row }"><AdminTime :value="row.occurredAt" /></template></ElTableColumn><ElTableColumn label="操作" width="85"><template #default="{ row }"><ElButton link type="primary" @click="openDetail(row)">详情</ElButton></template></ElTableColumn></ElTable>
    <div class="mt-4 flex justify-end gap-2"><ElButton :disabled="cursorStack.length === 0" @click="previous">上一页</ElButton><ElButton :disabled="!nextCursor" @click="next">下一页</ElButton></div>
  </ElCard><ElDrawer v-model="detailOpen" title="风险事件详情" size="50%"><ElDescriptions v-if="detail" :column="1" border><ElDescriptionsItem label="事件 ID">{{ detail.eventId }}</ElDescriptionsItem><ElDescriptionsItem label="用户 ID">{{ detail.userId ?? '—' }}</ElDescriptionsItem><ElDescriptionsItem label="类型">{{ eventText(detail.eventType) }}</ElDescriptionsItem><ElDescriptionsItem label="等级">{{ severityText(detail.severity) }}</ElDescriptionsItem><ElDescriptionsItem label="来源">{{ detail.sourceType }} #{{ detail.sourceId }}</ElDescriptionsItem><ElDescriptionsItem label="操作主体">{{ detail.actorType }} #{{ detail.actorId ?? '—' }}</ElDescriptionsItem><ElDescriptionsItem label="原因代码">{{ detail.reasonCode }}</ElDescriptionsItem><ElDescriptionsItem label="发生时间"><AdminTime :value="detail.occurredAt" /></ElDescriptionsItem></ElDescriptions><ElDivider>结构化元数据</ElDivider><pre v-if="detail" class="whitespace-pre-wrap break-all">{{ JSON.stringify(detail.metadata, null, 2) }}</pre></ElDrawer></div>
</template>
