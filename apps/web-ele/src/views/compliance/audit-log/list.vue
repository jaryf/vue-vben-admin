<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';

import { ElMessage } from 'element-plus';

import { requestClient } from '#/api/request';
import AdminTime from '#/components/admin-time.vue';

interface AuditLog {
  id: number; userId: null | number; username: string; method: string; path: string;
  ip: string; userAgent: string; requestBody: string; responseBody: string;
  statusCode: number; errorMessage: string; latency: number; createdAt: string;
}
const filter = reactive({ username: '', method: '', path: '', statusCode: '', occurredRange: [] as Date[], sortBy: 'createdAt', sortOrder: 'desc' });
const appliedFilter = ref<Record<string, unknown>>({});
const rows = ref<AuditLog[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);
const detail = ref<AuditLog | null>(null);
const detailOpen = ref(false);

async function load() {
  loading.value = true;
  try {
    const result = await requestClient.get<{ items: AuditLog[]; total: number }>('/audit-logs', {
      params: { ...appliedFilter.value, page: page.value, pageSize: pageSize.value },
    });
    rows.value = result.items || [];
    total.value = result.total;
  } finally { loading.value = false; }
}

function search() {
  if (filter.occurredRange?.length === 2 && filter.occurredRange[0]!.getTime() >= filter.occurredRange[1]!.getTime()) {
    ElMessage.warning('结束时间必须晚于开始时间'); return;
  }
  const statusCode = filter.statusCode.trim();
  if (statusCode && !/^[1-5]\d\d$/.test(statusCode)) { ElMessage.warning('请输入 100～599 的状态码'); return; }
  appliedFilter.value = {
    username: filter.username.trim() || undefined,
    method: filter.method || undefined,
    path: filter.path.trim() || undefined,
    statusCode: statusCode || undefined,
    startTime: filter.occurredRange?.[0]?.toISOString(),
    endTime: filter.occurredRange?.[1]?.toISOString(),
    sortBy: filter.sortBy,
    sortOrder: filter.sortOrder,
  };
  page.value = 1;
  void load();
}
async function openDetail(id: number) {
  detail.value = await requestClient.get<AuditLog>(`/audit-logs/${id}`);
  detailOpen.value = true;
}
onMounted(search);
</script>

<template>
  <div class="p-5">
    <ElCard shadow="never">
      <template #header>审计日志</template>
      <div class="mb-4 flex flex-wrap gap-3">
        <ElInput v-model="filter.username" placeholder="管理员用户名" clearable class="!w-40" />
        <ElSelect v-model="filter.method" clearable placeholder="请求方法" class="!w-32"><ElOption v-for="method in ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']" :key="method" :label="method" :value="method" /></ElSelect>
        <ElInput v-model="filter.path" placeholder="接口路径" clearable class="!w-48" />
        <ElInput v-model="filter.statusCode" placeholder="状态码" clearable class="!w-28" />
        <ElDatePicker v-model="filter.occurredRange" type="datetimerange" range-separator="至" start-placeholder="发生开始" end-placeholder="发生结束" class="!w-[390px]" />
        <ElSelect v-model="filter.sortBy" placeholder="排序字段" class="!w-36"><ElOption label="发生时间" value="createdAt" /><ElOption label="管理员" value="username" /><ElOption label="请求方法" value="method" /><ElOption label="接口路径" value="path" /><ElOption label="状态码" value="statusCode" /><ElOption label="耗时" value="latency" /></ElSelect>
        <ElSelect v-model="filter.sortOrder" placeholder="排序方向" class="!w-28"><ElOption label="降序" value="desc" /><ElOption label="升序" value="asc" /></ElSelect>
        <ElButton @click="search">查询</ElButton>
      </div>
      <ElTable v-loading="loading" :data="rows" row-key="id">
        <ElTableColumn prop="id" label="日志 ID" width="100" />
        <ElTableColumn prop="username" label="管理员" min-width="120" />
        <ElTableColumn prop="method" label="方法" width="85" />
        <ElTableColumn prop="path" label="接口路径" min-width="280" show-overflow-tooltip />
        <ElTableColumn prop="statusCode" label="状态码" width="90" />
        <ElTableColumn prop="latency" label="耗时（毫秒）" width="115" />
        <ElTableColumn prop="createdAt" label="发生时间" min-width="175"><template #default="{ row }"><AdminTime :value="row.createdAt" /></template></ElTableColumn>
        <ElTableColumn label="操作" width="85"><template #default="{ row }"><ElButton link type="primary" @click="openDetail(row.id)">详情</ElButton></template></ElTableColumn>
      </ElTable>
      <div class="mt-4 flex justify-end"><ElPagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[20, 50, 100]" layout="total, sizes, prev, pager, next" @change="load" /></div>
    </ElCard>
    <ElDrawer v-model="detailOpen" :title="`审计日志 #${detail?.id || ''}`" size="55%">
      <ElDescriptions v-if="detail" :column="1" border>
        <ElDescriptionsItem label="管理员">{{ detail.username }}（{{ detail.userId }}）</ElDescriptionsItem>
        <ElDescriptionsItem label="接口">{{ detail.method }} {{ detail.path }}</ElDescriptionsItem>
        <ElDescriptionsItem label="结果">HTTP {{ detail.statusCode }}；{{ detail.latency }} 毫秒</ElDescriptionsItem>
        <ElDescriptionsItem label="时间"><AdminTime :value="detail.createdAt" /></ElDescriptionsItem>
        <ElDescriptionsItem label="来源 IP">{{ detail.ip }}</ElDescriptionsItem>
        <ElDescriptionsItem label="失败信息">{{ detail.errorMessage || '—' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="请求审计摘要"><pre class="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">{{ detail.requestBody || '未采集' }}</pre></ElDescriptionsItem>
        <ElDescriptionsItem label="响应审计摘要"><pre class="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">{{ detail.responseBody || '未采集' }}</pre></ElDescriptionsItem>
      </ElDescriptions>
    </ElDrawer>
  </div>
</template>
