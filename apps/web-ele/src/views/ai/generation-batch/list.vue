<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  approveGenerationItem, cancelAIReplyTask, cancelGenerationBatch,
  createGenerationBatch, getAIReplyTask, getGenerationBatch,
  listAIReplyTasks, listGenerationBatches, listGenerationItems,
  publishGenerationItems, rejectGenerationItem, retryAIReplyTask,
  startGenerationBatch, updateGenerationItem,
} from '#/api/ai';
import type { AIGenerationBatch, AIGenerationItem, AIReplyTask } from '#/api/ai';

type Tab = 'batches' | 'items' | 'replies';
const active = ref<Tab>('batches');
const loading = ref(false);
const saving = ref(false);
const rows = ref<Array<AIGenerationBatch | AIGenerationItem | AIReplyTask>>([]);
const nextCursor = ref<string | null>(null);
const cursorStack = ref<string[]>([]);
const selectedItems = ref<AIGenerationItem[]>([]);
const detailOpen = ref(false);
const detail = ref<AIGenerationBatch | AIReplyTask | null>(null);
const createOpen = ref(false);
const createKey = ref('');
const editOpen = ref(false);
const editing = ref<AIGenerationItem | null>(null);
const editText = ref('');
const filter = reactive({ status: '', batchId: '', categoryId: '', languageCode: '', aiRoleId: '', conversationId: '' });
const draft = reactive({ categoryId: 0, languageCode: 'en', targetCount: 10, modelConfigVersion: '' });

const labels: Record<string, string> = {
  draft: '草稿', queued: '已排队', running: '生成中', completed: '已完成',
  failed: '失败', cancelled: '已取消', pending_review: '待自动审核',
  manual_review: '待人工审核', awaiting_approval: '待批准',
  ready_to_publish: '待发布', rejected: '已拒绝', published: '已发布',
  pending: '待处理', processing: '处理中', waiting_review: '等待审核',
  ready_to_send: '待发送', sent: '已发送', retrying: '重试中',
};
const statusText = (value: string) => labels[value] || value;
const batchStatuses = ['draft', 'queued', 'running', 'completed', 'failed', 'cancelled'];
const itemStatuses = ['pending_review', 'manual_review', 'awaiting_approval', 'ready_to_publish', 'rejected', 'published'];
const replyStatuses = ['pending', 'processing', 'waiting_review', 'ready_to_send', 'sent', 'retrying', 'failed', 'cancelled'];
const reasonCodes = [
  'CONTACT_INFORMATION_NOT_ALLOWED', 'EXTERNAL_LINK_NOT_ALLOWED', 'QR_CODE_NOT_ALLOWED',
  'PROMOTION_NOT_ALLOWED', 'SCAM_RISK', 'HARASSMENT', 'THREAT',
  'ADULT_CONTENT_DISABLED', 'MINOR_SAFETY_RISK', 'ILLEGAL_CONTENT',
  'DUPLICATE_SPAM', 'UNSUPPORTED_MEDIA', 'REVIEW_UNAVAILABLE',
];

async function load(cursor = '') {
  loading.value = true;
  try {
    const params: Record<string, unknown> = { cursor: cursor || undefined, limit: 20, status: filter.status || undefined };
    let result;
    if (active.value === 'batches') {
      Object.assign(params, { categoryId: filter.categoryId || undefined, languageCode: filter.languageCode || undefined });
      result = await listGenerationBatches(params);
    } else if (active.value === 'items') {
      Object.assign(params, { batchId: filter.batchId || undefined, aiRoleId: filter.aiRoleId || undefined });
      result = await listGenerationItems(params);
    } else {
      Object.assign(params, { conversationId: filter.conversationId || undefined, aiRoleId: filter.aiRoleId || undefined });
      result = await listAIReplyTasks(params);
    }
    rows.value = result.items || [];
    nextCursor.value = result.nextCursor;
    selectedItems.value = [];
  } finally { loading.value = false; }
}
function search() { cursorStack.value = []; void load(); }
function switchTab() { Object.assign(filter, { status: '', batchId: '', categoryId: '', languageCode: '', aiRoleId: '', conversationId: '' }); search(); }
function next() { if (!nextCursor.value) return; cursorStack.value.push(nextCursor.value); void load(nextCursor.value); }
function previous() { cursorStack.value.pop(); void load(cursorStack.value.at(-1) || ''); }
function viewBatchItems(batchId: number) { active.value = 'items'; filter.status = ''; filter.batchId = String(batchId); cursorStack.value = []; void load(); }
function openCreate() { Object.assign(draft, { categoryId: 0, languageCode: 'en', targetCount: 10, modelConfigVersion: '' }); createKey.value = crypto.randomUUID(); createOpen.value = true; }

async function create() {
  if (draft.categoryId < 1 || !draft.languageCode.trim() || draft.targetCount < 1 || draft.targetCount > 1000 || !draft.modelConfigVersion.trim()) {
    ElMessage.error('请填写有效分类、语言、数量和模型配置版本'); return;
  }
  saving.value = true;
  try {
    await createGenerationBatch({ ...draft, languageCode: draft.languageCode.trim(), modelConfigVersion: draft.modelConfigVersion.trim() }, createKey.value);
    createOpen.value = false; ElMessage.success('批次草稿已创建'); search();
  } finally { saving.value = false; }
}
async function openDetail(row: AIGenerationBatch | AIReplyTask) {
  detail.value = 'batchId' in row ? await getGenerationBatch(row.batchId) : await getAIReplyTask(row.taskId);
  detailOpen.value = true;
}
async function batchAction(row: AIGenerationBatch, action: 'cancel' | 'start') {
  await ElMessageBox.confirm(`确定${action === 'start' ? '启动' : '取消'}批次 #${row.batchId} 吗？`, '确认批次操作', { type: 'warning' });
  if (action === 'start') await startGenerationBatch(row.batchId); else await cancelGenerationBatch(row.batchId);
  ElMessage.success('批次状态已更新'); await load(cursorStack.value.at(-1) || '');
}
function openEdit(row: AIGenerationItem) { editing.value = row; editText.value = row.text; editOpen.value = true; }
async function saveItem() {
  if (!editing.value || !editText.value.trim() || [...editText.value.trim()].length > 500) { ElMessage.error('内容长度需为 1–500 字'); return; }
  saving.value = true;
  try {
    await updateGenerationItem(editing.value.itemId, editText.value.trim());
    editOpen.value = false; ElMessage.success('内容已更新，需重新经过自动审核'); await load(cursorStack.value.at(-1) || '');
  } finally { saving.value = false; }
}
async function reviewItem(row: AIGenerationItem, approve: boolean) {
  if (approve) {
    await ElMessageBox.confirm(`确定批准内容 #${row.itemId} 吗？`, '确认复核', { type: 'warning' });
    await approveGenerationItem(row.itemId);
  } else {
    const { value } = await ElMessageBox.prompt('请输入拒绝原因代码', '拒绝内容', { inputType: 'text', inputValidator: (text) => reasonCodes.includes(text) || `有效代码：${reasonCodes.join('、')}` });
    await rejectGenerationItem(row.itemId, value);
  }
  ElMessage.success('复核结果已保存'); await load(cursorStack.value.at(-1) || '');
}
async function publish() {
  const ids = selectedItems.value.filter((row) => row.status === 'ready_to_publish').map((row) => row.itemId);
  if (!ids.length) { ElMessage.warning('请选择待发布的内容'); return; }
  await ElMessageBox.confirm(`确定发布选中的 ${ids.length} 条内容吗？`, '确认发布', { type: 'warning' });
  await publishGenerationItems(ids); ElMessage.success('内容已发布'); await load(cursorStack.value.at(-1) || '');
}
async function replyAction(row: AIReplyTask, action: 'cancel' | 'retry') {
  await ElMessageBox.confirm(`确定${action === 'retry' ? '重试' : '取消'}回复任务 #${row.taskId} 吗？`, '确认任务操作', { type: 'warning' });
  if (action === 'retry') await retryAIReplyTask(row.taskId); else await cancelAIReplyTask(row.taskId);
  ElMessage.success('任务状态已更新'); await load(cursorStack.value.at(-1) || '');
}
onMounted(() => { void load(); });
</script>

<template>
  <div class="p-5">
    <ElCard shadow="never">
      <template #header><div class="flex items-center justify-between"><span>AI 内容与回复任务</span><ElButton v-if="active === 'batches'" type="primary" @click="openCreate">创建生成批次</ElButton><ElButton v-else-if="active === 'items'" type="primary" :disabled="!selectedItems.some((row) => row.status === 'ready_to_publish')" @click="publish">发布所选内容</ElButton></div></template>
      <ElAlert title="生成和回复依赖外部 AI 服务。服务不可用时，以真实批次或任务状态及错误码为准；不会展示模拟结果。" type="info" show-icon :closable="false" class="mb-4" />
      <ElTabs v-model="active" @tab-click="switchTab"><ElTabPane label="生成批次" name="batches" /><ElTabPane label="生成内容" name="items" /><ElTabPane label="回复任务" name="replies" /></ElTabs>
      <div class="mb-4 flex flex-wrap gap-3">
        <ElSelect v-model="filter.status" clearable placeholder="全部状态" class="!w-44"><ElOption v-for="value in active === 'batches' ? batchStatuses : active === 'items' ? itemStatuses : replyStatuses" :key="value" :label="statusText(value)" :value="value" /></ElSelect>
        <ElInput v-if="active === 'items'" v-model="filter.batchId" placeholder="批次 ID" clearable class="!w-32" />
        <ElInput v-if="active === 'batches'" v-model="filter.categoryId" placeholder="分类 ID" clearable class="!w-32" />
        <ElInput v-if="active === 'batches'" v-model="filter.languageCode" placeholder="语言代码" clearable class="!w-32" />
        <ElInput v-if="active !== 'batches'" v-model="filter.aiRoleId" placeholder="AI 角色 ID" clearable class="!w-36" />
        <ElInput v-if="active === 'replies'" v-model="filter.conversationId" placeholder="会话 ID" clearable class="!w-36" />
        <ElButton @click="search">查询</ElButton>
      </div>
      <ElTable v-if="active === 'batches'" v-loading="loading" :data="rows" row-key="batchId">
        <ElTableColumn prop="batchId" label="批次 ID" width="95" /><ElTableColumn prop="categoryId" label="分类 ID" width="95" /><ElTableColumn prop="languageCode" label="语言" width="90" /><ElTableColumn prop="targetCount" label="目标数量" width="100" /><ElTableColumn prop="modelConfigVersion" label="模型配置版本" min-width="160" /><ElTableColumn label="状态" width="105"><template #default="{ row }">{{ statusText(row.status) }}</template></ElTableColumn><ElTableColumn prop="createdAt" label="创建时间" min-width="175" /><ElTableColumn label="操作" width="220" fixed="right"><template #default="{ row }"><ElButton link type="primary" @click="openDetail(row)">详情</ElButton><ElButton link type="primary" @click="viewBatchItems(row.batchId)">内容</ElButton><ElButton v-if="row.status === 'draft'" link type="success" @click="batchAction(row, 'start')">启动</ElButton><ElButton v-if="['draft', 'queued', 'running'].includes(row.status)" link type="warning" @click="batchAction(row, 'cancel')">取消</ElButton></template></ElTableColumn>
      </ElTable>
      <ElTable v-else-if="active === 'items'" v-loading="loading" :data="rows" row-key="itemId" @selection-change="selectedItems = $event">
        <ElTableColumn type="selection" width="48" /><ElTableColumn prop="itemId" label="内容 ID" width="95" /><ElTableColumn prop="batchId" label="批次 ID" width="95" /><ElTableColumn prop="aiRoleId" label="角色 ID" width="95" /><ElTableColumn prop="text" label="内容" min-width="260" show-overflow-tooltip /><ElTableColumn label="状态" width="125"><template #default="{ row }">{{ statusText(row.status) }}</template></ElTableColumn><ElTableColumn prop="contentRevision" label="修订" width="70" /><ElTableColumn label="操作" width="175" fixed="right"><template #default="{ row }"><ElButton v-if="row.status !== 'published'" link type="primary" @click="openEdit(row)">编辑</ElButton><ElButton v-if="row.status === 'awaiting_approval'" link type="success" @click="reviewItem(row, true)">批准</ElButton><ElButton v-if="row.status === 'awaiting_approval'" link type="danger" @click="reviewItem(row, false)">拒绝</ElButton></template></ElTableColumn>
      </ElTable>
      <ElTable v-else v-loading="loading" :data="rows" row-key="taskId">
        <ElTableColumn prop="taskId" label="任务 ID" width="95" /><ElTableColumn prop="conversationId" label="会话 ID" width="100" /><ElTableColumn prop="aiRoleId" label="角色 ID" width="100" /><ElTableColumn label="状态" width="110"><template #default="{ row }">{{ statusText(row.status) }}</template></ElTableColumn><ElTableColumn prop="attempts" label="尝试次数" width="95" /><ElTableColumn prop="lastErrorCode" label="错误码" min-width="155" /><ElTableColumn prop="scheduledAt" label="计划时间" min-width="175" /><ElTableColumn label="操作" width="170" fixed="right"><template #default="{ row }"><ElButton link type="primary" @click="openDetail(row)">详情</ElButton><ElButton v-if="row.status === 'failed'" link type="success" @click="replyAction(row, 'retry')">重试</ElButton><ElButton v-if="!['sent', 'cancelled'].includes(row.status)" link type="warning" @click="replyAction(row, 'cancel')">取消</ElButton></template></ElTableColumn>
      </ElTable>
      <div class="mt-4 flex justify-end gap-2"><ElButton :disabled="cursorStack.length === 0" @click="previous">上一页</ElButton><ElButton :disabled="!nextCursor" @click="next">下一页</ElButton></div>
    </ElCard>
    <ElDialog v-model="createOpen" title="创建生成批次" width="520px"><ElForm label-width="125px"><ElFormItem label="分类 ID"><ElInputNumber v-model="draft.categoryId" :min="1" /></ElFormItem><ElFormItem label="语言代码"><ElInput v-model="draft.languageCode" /></ElFormItem><ElFormItem label="目标数量"><ElInputNumber v-model="draft.targetCount" :min="1" :max="1000" /></ElFormItem><ElFormItem label="模型配置版本"><ElInput v-model="draft.modelConfigVersion" placeholder="已发布的模型配置版本" /></ElFormItem></ElForm><template #footer><ElButton @click="createOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="create">创建草稿</ElButton></template></ElDialog>
    <ElDialog v-model="editOpen" :title="`编辑内容 #${editing?.itemId || ''}`" width="650px"><ElAlert title="修改后会重新进入自动审核，不能直接发布。" type="warning" :closable="false" class="mb-4" /><ElInput v-model="editText" type="textarea" :rows="8" maxlength="500" show-word-limit /><template #footer><ElButton @click="editOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="saveItem">保存</ElButton></template></ElDialog>
    <ElDrawer v-model="detailOpen" title="AI 任务详情" size="50%"><ElDescriptions v-if="detail" :column="1" border><ElDescriptionsItem v-for="[key, value] in Object.entries(detail)" :key="key" :label="key">{{ value ?? '—' }}</ElDescriptionsItem></ElDescriptions></ElDrawer>
  </div>
</template>
