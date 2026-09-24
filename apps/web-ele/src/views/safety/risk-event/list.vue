<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';

import { getRiskEvent, listRiskEvents } from '#/api/risk-events';
import type { RiskEvent } from '#/api/risk-events';

const rows = ref<RiskEvent[]>([]);
const nextCursor = ref<string | null>(null);
const cursorStack = ref<string[]>([]);
const loading = ref(false);
const detail = ref<RiskEvent | null>(null);
const detailOpen = ref(false);
const filter = reactive({ userId: '', eventType: '', severity: '', sourceType: '', sourceId: '' });
const severities = [['info', '信息'], ['low', '低'], ['medium', '中'], ['high', '高'], ['critical', '严重']];
function severityText(value: string) { return severities.find(([key]) => key === value)?.[1] || value; }
async function load(cursor = '') {
  loading.value = true;
  try {
    const result = await listRiskEvents({
      userId: filter.userId || undefined, eventType: filter.eventType || undefined,
      severity: filter.severity || undefined, sourceType: filter.sourceType || undefined,
      sourceId: filter.sourceId || undefined, cursor: cursor || undefined, limit: 20,
    });
    rows.value = result.items || []; nextCursor.value = result.nextCursor;
  } finally { loading.value = false; }
}
function search() { cursorStack.value = []; void load(); }
function next() { if (!nextCursor.value) return; cursorStack.value.push(nextCursor.value); void load(nextCursor.value); }
function previous() { cursorStack.value.pop(); void load(cursorStack.value.at(-1) || ''); }
async function openDetail(row: RiskEvent) { detail.value = await getRiskEvent(row.eventId); detailOpen.value = true; }
onMounted(() => { void load(); });
</script>

<template>
  <div class="p-5"><ElCard shadow="never"><template #header>风险事件</template>
    <div class="mb-4 flex flex-wrap gap-3"><ElInput v-model="filter.userId" placeholder="用户 ID" clearable class="!w-32" /><ElInput v-model="filter.eventType" placeholder="事件类型" clearable class="!w-44" /><ElSelect v-model="filter.severity" clearable placeholder="全部等级" class="!w-32"><ElOption v-for="[value, label] in severities" :key="value" :label="label" :value="value" /></ElSelect><ElInput v-model="filter.sourceType" placeholder="来源类型" clearable class="!w-32" /><ElInput v-model="filter.sourceId" placeholder="来源 ID" clearable class="!w-32" /><ElButton @click="search">查询</ElButton></div>
    <ElTable v-loading="loading" :data="rows" row-key="eventId"><ElTableColumn prop="eventId" label="事件 ID" width="100" /><ElTableColumn prop="userId" label="用户 ID" width="100" /><ElTableColumn prop="eventType" label="事件类型" min-width="190" /><ElTableColumn label="等级" width="95"><template #default="{ row }">{{ severityText(row.severity) }}</template></ElTableColumn><ElTableColumn label="来源" min-width="140"><template #default="{ row }">{{ row.sourceType }} #{{ row.sourceId }}</template></ElTableColumn><ElTableColumn prop="reasonCode" label="原因代码" min-width="165" /><ElTableColumn prop="occurredAt" label="发生时间" min-width="175" /><ElTableColumn label="操作" width="85"><template #default="{ row }"><ElButton link type="primary" @click="openDetail(row)">详情</ElButton></template></ElTableColumn></ElTable>
    <div class="mt-4 flex justify-end gap-2"><ElButton :disabled="cursorStack.length === 0" @click="previous">上一页</ElButton><ElButton :disabled="!nextCursor" @click="next">下一页</ElButton></div>
  </ElCard><ElDrawer v-model="detailOpen" title="风险事件详情" size="50%"><ElDescriptions v-if="detail" :column="1" border><ElDescriptionsItem label="事件 ID">{{ detail.eventId }}</ElDescriptionsItem><ElDescriptionsItem label="用户 ID">{{ detail.userId ?? '—' }}</ElDescriptionsItem><ElDescriptionsItem label="类型">{{ detail.eventType }}</ElDescriptionsItem><ElDescriptionsItem label="等级">{{ severityText(detail.severity) }}</ElDescriptionsItem><ElDescriptionsItem label="来源">{{ detail.sourceType }} #{{ detail.sourceId }}</ElDescriptionsItem><ElDescriptionsItem label="操作主体">{{ detail.actorType }} #{{ detail.actorId ?? '—' }}</ElDescriptionsItem><ElDescriptionsItem label="原因代码">{{ detail.reasonCode }}</ElDescriptionsItem><ElDescriptionsItem label="发生时间">{{ detail.occurredAt }}</ElDescriptionsItem></ElDescriptions><ElDivider>结构化元数据</ElDivider><pre v-if="detail" class="whitespace-pre-wrap break-all">{{ JSON.stringify(detail.metadata, null, 2) }}</pre></ElDrawer></div>
</template>
