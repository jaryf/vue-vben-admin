<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';

import { ElMessageBox } from 'element-plus';

import { getFinanceReview, listFinanceReviews } from '#/api/finance-reviews';
import type { FinanceReviewCase } from '#/api/finance-reviews';

const rows = ref<FinanceReviewCase[]>([]);
const nextCursor = ref<string | null>(null);
const cursorStack = ref<string[]>([]);
const loading = ref(false);
const detailOpen = ref(false);
const detail = ref<FinanceReviewCase | null>(null);
const filter = reactive({ userId: '', orderId: '', reasonCode: '' });
function reasonText(value: string) { return value === 'coin_shortfall' ? '金币余额不足' : value === 'partial_refund' ? '部分退款待核验' : value; }
async function load(cursor = '') {
  loading.value = true;
  try {
    const result = await listFinanceReviews({ userId: filter.userId || undefined, orderId: filter.orderId || undefined, reasonCode: filter.reasonCode || undefined, cursor: cursor || undefined, limit: 20 });
    rows.value = result.items || []; nextCursor.value = result.nextCursor;
  } finally { loading.value = false; }
}
function search() { cursorStack.value = []; void load(); }
function next() { if (!nextCursor.value) return; cursorStack.value.push(nextCursor.value); void load(nextCursor.value); }
function previous() { cursorStack.value.pop(); void load(cursorStack.value.at(-1) || ''); }
async function openDetail(row: FinanceReviewCase) {
  const { value } = await ElMessageBox.prompt(`查看财务异常 #${row.caseId}，请填写审计原因`, '审计原因', { inputValidator: (text) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(text.trim()) || '请输入有效稳定原因代码' });
  detail.value = await getFinanceReview(row.caseId, value.trim()); detailOpen.value = true;
}
onMounted(() => { void load(); });
</script>

<template>
  <div class="p-5"><ElCard shadow="never"><template #header>财务异常待处理</template>
    <ElAlert title="商店退款、撤销或部分退款以官方通知为准。金币余额不足时消费已在服务端冻结并进入人工处理；本后台不提供主动退款或直接解冻操作。" type="warning" show-icon :closable="false" class="mb-4" />
    <div class="mb-4 flex flex-wrap gap-3"><ElInput v-model="filter.userId" placeholder="用户 ID" clearable class="!w-32" /><ElInput v-model="filter.orderId" placeholder="订单 ID" clearable class="!w-32" /><ElSelect v-model="filter.reasonCode" clearable placeholder="全部异常" class="!w-44"><ElOption label="金币余额不足" value="coin_shortfall" /><ElOption label="部分退款待核验" value="partial_refund" /></ElSelect><ElButton @click="search">查询</ElButton></div>
    <ElTable v-loading="loading" :data="rows" row-key="caseId"><ElTableColumn prop="caseId" label="异常 ID" width="100" /><ElTableColumn prop="userId" label="用户 ID" width="100" /><ElTableColumn prop="orderId" label="订单 ID" width="100" /><ElTableColumn label="异常原因" min-width="150"><template #default="{ row }">{{ reasonText(row.reasonCode) }}</template></ElTableColumn><ElTableColumn prop="provider" label="商店渠道" width="125" /><ElTableColumn prop="coinBalance" label="当前金币" width="100" /><ElTableColumn prop="coinGrantAmount" label="应追回金币" width="120" /><ElTableColumn label="消费冻结" width="100"><template #default="{ row }">{{ row.spendFrozenAt ? '已冻结' : '未冻结' }}</template></ElTableColumn><ElTableColumn prop="createdAt" label="记录时间" min-width="175" /><ElTableColumn label="操作" width="85"><template #default="{ row }"><ElButton link type="primary" @click="openDetail(row)">详情</ElButton></template></ElTableColumn></ElTable><div class="mt-4 flex justify-end gap-2"><ElButton :disabled="cursorStack.length === 0" @click="previous">上一页</ElButton><ElButton :disabled="!nextCursor" @click="next">下一页</ElButton></div>
  </ElCard><ElDrawer v-model="detailOpen" title="财务异常详情" size="55%" @closed="detail = null"><ElDescriptions v-if="detail" :column="1" border><ElDescriptionsItem label="异常 ID">{{ detail.caseId }}</ElDescriptionsItem><ElDescriptionsItem label="用户 ID">{{ detail.userId }}</ElDescriptionsItem><ElDescriptionsItem label="订单 ID">{{ detail.orderId }}</ElDescriptionsItem><ElDescriptionsItem label="原因">{{ reasonText(detail.reasonCode) }}</ElDescriptionsItem><ElDescriptionsItem label="渠道">{{ detail.provider }}</ElDescriptionsItem><ElDescriptionsItem label="商店事件 ID">{{ detail.eventId }}</ElDescriptionsItem><ElDescriptionsItem label="金币余额">{{ detail.coinBalance ?? '不适用' }}</ElDescriptionsItem><ElDescriptionsItem label="应追回金币">{{ detail.coinGrantAmount ?? '不适用' }}</ElDescriptionsItem><ElDescriptionsItem label="消费冻结时间">{{ detail.spendFrozenAt || '未冻结' }}</ElDescriptionsItem><ElDescriptionsItem label="处理状态">待财务人工处理</ElDescriptionsItem><ElDescriptionsItem label="商店事件时间">{{ detail.occurredAt }}</ElDescriptionsItem></ElDescriptions></ElDrawer></div>
</template>
