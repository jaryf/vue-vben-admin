<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useUserStore } from '@vben/stores';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  approveDataExport, createDataExport, downloadDataExport, getDataExport,
  listDataExports, rejectDataExport,
} from '#/api/data-exports';
import type { DataExportTask } from '#/api/data-exports';

const { hasAccessByCodes } = useAccess();
const userStore = useUserStore();
const canApprove = computed(() => hasAccessByCodes(['data_export.approve']));
const canDownload = computed(() => hasAccessByCodes(['data_export.download']));
const currentUserId = computed(() => userStore.userInfo?.userId);
const rows = ref<DataExportTask[]>([]);
const nextCursor = ref<null | string>(null);
const cursorStack = ref<string[]>([]);
const loading = ref(false);
const saving = ref(false);
const editorOpen = ref(false);
const detailOpen = ref(false);
const detail = ref<DataExportTask | null>(null);
const status = ref('');
const form = reactive({ dataset: 'audit_logs', range: [] as Date[], purpose: '' });
const datasetLabels: Record<string, string> = {
  audit_logs: '审计日志元数据', finance_reviews: '财务异常元数据',
  orders: '订单', payment_transactions: '支付交易', subscriptions: '订阅',
  entitlement_ledger: '权益账本', coin_ledger: '金币账本',
  bottles: '漂流瓶业务字段与内容',
  risk_events: '风险事件',
  reports: '举报记录', report_evidence: '举报证据',
};
const datasetPermissions: Record<string, string[]> = {
  audit_logs: ['audit_log.read'], finance_reviews: ['finance_review.read'],
  orders: ['order.read'], payment_transactions: ['order.read'], subscriptions: ['order.read'],
  entitlement_ledger: ['order.read'], coin_ledger: ['order.read'],
  bottles: ['bottle.read', 'bottle.content.read_sensitive'],
  risk_events: ['risk_event.read'],
  reports: ['report.read'], report_evidence: ['report.read', 'report.evidence.read_sensitive'],
};
const canUseDataset = (dataset: string) => (datasetPermissions[dataset] || []).every((code) => hasAccessByCodes([code])) && !!datasetPermissions[dataset];
const selectableDatasets = computed(() => Object.entries(datasetLabels).filter(([value]) => canUseDataset(value)));
const canRequest = computed(() => hasAccessByCodes(['data_export.request']) && selectableDatasets.value.length > 0);
const datasetText = (value: string) => datasetLabels[value] || value;
const statusText = (value: string) => ({ pending: '待审批', queued: '排队生成', ready: '可下载', rejected: '已驳回', expired: '已过期', failed: '生成失败' })[value as DataExportTask['status']] || value;

async function load(cursor = '') {
  loading.value = true;
  try {
    const result = await listDataExports({ status: status.value || undefined, cursor: cursor || undefined, limit: 20 });
    rows.value = result.items || []; nextCursor.value = result.nextCursor;
  } finally { loading.value = false; }
}
function search() { cursorStack.value = []; void load(); }
function next() { if (!nextCursor.value) return; cursorStack.value.push(nextCursor.value); void load(nextCursor.value); }
function previous() { cursorStack.value.pop(); void load(cursorStack.value.at(-1) || ''); }
function openEditor() {
  form.dataset = selectableDatasets.value[0]?.[0] || '';
  form.range = [new Date(Date.now() - 24 * 3600_000), new Date(Date.now() - 1000)];
  form.purpose = '';
  editorOpen.value = true;
}
async function save() {
  if (form.range.length !== 2 || form.purpose.trim().length < 10 || form.purpose.trim().length > 200) { ElMessage.error('请填写 10 至 200 字的用途并选择时间范围'); return; }
  const [from, to] = form.range;
  if (!from || !to || to.getTime() <= from.getTime() || to.getTime() - from.getTime() > 30 * 24 * 3600_000 || to.getTime() > Date.now()) { ElMessage.error('时间范围不得超过 30 天或包含未来时间'); return; }
  saving.value = true;
  try {
    await createDataExport({ dataset: form.dataset, fromAt: from.toISOString(), toAt: to.toISOString(), purpose: form.purpose.trim() }, crypto.randomUUID());
    editorOpen.value = false; ElMessage.success('导出申请已提交，等待其他管理员审批'); await load();
  } finally { saving.value = false; }
}
async function openDetail(row: DataExportTask) { detail.value = await getDataExport(row.exportId); detailOpen.value = true; }
async function review(row: DataExportTask, approve: boolean) {
  const { value } = await ElMessageBox.prompt(approve ? '可填写审批说明' : '请输入驳回原因', approve ? '批准导出' : '驳回导出', { inputValidator: (text) => text.length > 500 ? '最多 500 字' : !approve && !text.trim() ? '请填写驳回原因' : true });
  if (approve) await approveDataExport(row.exportId, value);
  else await rejectDataExport(row.exportId, value);
  ElMessage.success('审批结果已保存'); await load(cursorStack.value.at(-1) || '');
}
async function download(row: DataExportTask) {
  const { value } = await ElMessageBox.prompt('请输入此次下载的审计原因代码', '下载数据导出', { inputValidator: (text) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(text.trim()) || '请输入有效稳定原因代码' });
  const blob = await downloadDataExport(row.exportId, value.trim());
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url; link.download = `driftly-${row.dataset}-${row.exportId}.csv`;
    document.body.append(link); link.click(); link.remove();
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
onMounted(() => { void load(); });
</script>

<template>
  <div class="p-5"><ElCard shadow="never"><template #header><div class="flex items-center justify-between"><span>异步数据导出</span><ElButton v-if="canRequest" type="primary" @click="openEditor">申请导出</ElButton></div></template>
    <ElAlert class="mb-4" type="info" show-icon :closable="false" title="可按权限导出审计、商业化、漂流瓶、风险事件及举报数据。漂流瓶内容和举报证据需要各自的敏感权限。单次最多 30 天、10,000 行；申请人与审批人必须不同。生成后 24 小时过期，下载链接仅可使用一次、最长有效 60 秒。" />
    <div class="mb-4 flex gap-3"><ElSelect v-model="status" clearable placeholder="全部状态" class="!w-36"><ElOption label="待审批" value="pending" /><ElOption label="排队生成" value="queued" /><ElOption label="可下载" value="ready" /><ElOption label="已驳回" value="rejected" /><ElOption label="已过期" value="expired" /><ElOption label="生成失败" value="failed" /></ElSelect><ElButton @click="search">查询</ElButton><ElButton @click="load(cursorStack.at(-1) || '')">刷新</ElButton></div>
    <ElTable v-loading="loading" :data="rows" row-key="exportId"><ElTableColumn prop="exportId" label="任务 ID" width="95" /><ElTableColumn label="数据集" min-width="155"><template #default="{ row }">{{ datasetText(row.dataset) }}</template></ElTableColumn><ElTableColumn label="状态" width="105"><template #default="{ row }">{{ statusText(row.status) }}</template></ElTableColumn><ElTableColumn prop="requestedBy" label="申请人" width="95" /><ElTableColumn prop="reviewedBy" label="审批人" width="95" /><ElTableColumn prop="rowCount" label="行数" width="85" /><ElTableColumn prop="expiresAt" label="下载截止" min-width="175" /><ElTableColumn label="操作" width="210" fixed="right"><template #default="{ row }"><ElButton link type="primary" @click="openDetail(row)">详情</ElButton><ElButton v-if="canApprove && canUseDataset(row.dataset) && row.status === 'pending' && row.requestedBy !== currentUserId" link type="success" @click="review(row, true)">批准</ElButton><ElButton v-if="canApprove && canUseDataset(row.dataset) && row.status === 'pending' && row.requestedBy !== currentUserId" link type="warning" @click="review(row, false)">驳回</ElButton><ElButton v-if="canDownload && canUseDataset(row.dataset) && row.status === 'ready' && row.requestedBy === currentUserId && row.expiresAt && new Date(row.expiresAt).getTime() > Date.now()" link type="primary" @click="download(row)">下载</ElButton></template></ElTableColumn></ElTable><div class="mt-4 flex justify-end gap-2"><ElButton :disabled="cursorStack.length === 0" @click="previous">上一页</ElButton><ElButton :disabled="!nextCursor" @click="next">下一页</ElButton></div>
  </ElCard><ElDrawer v-model="detailOpen" title="导出任务详情" size="55%" @closed="detail = null"><ElDescriptions v-if="detail" :column="1" border><ElDescriptionsItem label="任务 ID">{{ detail.exportId }}</ElDescriptionsItem><ElDescriptionsItem label="数据集">{{ datasetText(detail.dataset) }}</ElDescriptionsItem><ElDescriptionsItem label="用途">{{ detail.purpose }}</ElDescriptionsItem><ElDescriptionsItem label="时间范围">{{ detail.fromAt }} ～ {{ detail.toAt }}</ElDescriptionsItem><ElDescriptionsItem label="状态">{{ statusText(detail.status) }}</ElDescriptionsItem><ElDescriptionsItem label="审批意见">{{ detail.reviewNote || '—' }}</ElDescriptionsItem><ElDescriptionsItem label="生成行数">{{ detail.rowCount ?? '—' }}</ElDescriptionsItem><ElDescriptionsItem label="文件 SHA-256">{{ detail.fileSha256 || '—' }}</ElDescriptionsItem><ElDescriptionsItem label="过期时间">{{ detail.expiresAt || '—' }}</ElDescriptionsItem><ElDescriptionsItem label="失败原因">{{ detail.failureCode || '—' }}</ElDescriptionsItem></ElDescriptions></ElDrawer>
  <ElDialog v-model="editorOpen" title="申请数据导出" width="600px"><ElForm label-width="100px"><ElFormItem label="数据集"><ElSelect v-model="form.dataset"><ElOption v-for="entry in selectableDatasets" :key="entry[0]" :label="entry[1]" :value="entry[0]" /></ElSelect></ElFormItem><ElFormItem label="时间范围"><ElDatePicker v-model="form.range" type="datetimerange" start-placeholder="开始时间" end-placeholder="结束时间" class="!w-full" /></ElFormItem><ElFormItem label="用途"><ElInput v-model="form.purpose" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="说明业务用途、接收者和必要性" /></ElFormItem></ElForm><template #footer><ElButton @click="editorOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="save">提交审批</ElButton></template></ElDialog></div>
</template>
