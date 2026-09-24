<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';

import { requestClient } from '#/api/request';

interface AuditLog {
  id: number; userId: null | number; username: string; method: string; path: string;
  ip: string; userAgent: string; requestBody: string; responseBody: string;
  statusCode: number; errorMessage: string; latency: number; createdAt: string;
}
const filter = reactive({ username: '', method: '', path: '', statusCode: '', startTime: '', endTime: '' });
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
      params: {
        page: page.value, pageSize: pageSize.value,
        username: filter.username.trim() || undefined,
        method: filter.method || undefined,
        path: filter.path.trim() || undefined,
        statusCode: filter.statusCode || undefined,
        startTime: filter.startTime || undefined,
        endTime: filter.endTime || undefined,
      },
    });
    rows.value = result.items || [];
    total.value = result.total;
  } finally { loading.value = false; }
}

function search() { page.value = 1; void load(); }
async function openDetail(id: number) {
  detail.value = await requestClient.get<AuditLog>(`/audit-logs/${id}`);
  detailOpen.value = true;
}
onMounted(() => { void load(); });
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
        <ElButton @click="search">查询</ElButton>
      </div>
      <ElTable v-loading="loading" :data="rows" row-key="id">
        <ElTableColumn prop="id" label="日志 ID" width="100" />
        <ElTableColumn prop="username" label="管理员" min-width="120" />
        <ElTableColumn prop="method" label="方法" width="85" />
        <ElTableColumn prop="path" label="接口路径" min-width="280" show-overflow-tooltip />
        <ElTableColumn prop="statusCode" label="状态码" width="90" />
        <ElTableColumn prop="latency" label="耗时（毫秒）" width="115" />
        <ElTableColumn prop="createdAt" label="发生时间" min-width="175" />
        <ElTableColumn label="操作" width="85"><template #default="{ row }"><ElButton link type="primary" @click="openDetail(row.id)">详情</ElButton></template></ElTableColumn>
      </ElTable>
      <div class="mt-4 flex justify-end"><ElPagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[20, 50, 100]" layout="total, sizes, prev, pager, next" @change="load" /></div>
    </ElCard>
    <ElDrawer v-model="detailOpen" :title="`审计日志 #${detail?.id || ''}`" size="55%">
      <ElDescriptions v-if="detail" :column="1" border>
        <ElDescriptionsItem label="管理员">{{ detail.username }}（{{ detail.userId }}）</ElDescriptionsItem>
        <ElDescriptionsItem label="接口">{{ detail.method }} {{ detail.path }}</ElDescriptionsItem>
        <ElDescriptionsItem label="结果">HTTP {{ detail.statusCode }}；{{ detail.latency }} 毫秒</ElDescriptionsItem>
        <ElDescriptionsItem label="时间">{{ detail.createdAt }}</ElDescriptionsItem>
        <ElDescriptionsItem label="来源 IP">{{ detail.ip }}</ElDescriptionsItem>
        <ElDescriptionsItem label="失败信息">{{ detail.errorMessage || '—' }}</ElDescriptionsItem>
        <ElDescriptionsItem label="请求审计摘要"><pre class="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">{{ detail.requestBody || '未采集' }}</pre></ElDescriptionsItem>
        <ElDescriptionsItem label="响应审计摘要"><pre class="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">{{ detail.responseBody || '未采集' }}</pre></ElDescriptionsItem>
      </ElDescriptions>
    </ElDrawer>
  </div>
</template>
