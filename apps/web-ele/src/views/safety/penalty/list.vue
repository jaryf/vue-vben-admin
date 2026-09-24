<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';

import { ElMessage, ElMessageBox } from 'element-plus';

import { createPenalty, listPenalties, revokePenalty } from '#/api/penalties';
import type { PenaltyRow } from '#/api/penalties';
import AdminTime from '#/components/admin-time.vue';

const { hasAccessByCodes } = useAccess();
const canCreate = computed(() => hasAccessByCodes(['penalty.create']));
const canRevoke = computed(() => hasAccessByCodes(['penalty.revoke']));
const rows = ref<PenaltyRow[]>([]);
const nextCursor = ref<string | null>(null);
const cursorStack = ref<string[]>([]);
const loading = ref(false);
const saving = ref(false);
const createOpen = ref(false);
const createKey = ref('');
const filter = reactive({ userId: '', status: '', penaltyType: '', scope: '', referenceType: '', referenceId: '', createdBy: '', createdRange: [] as Date[] });
const appliedFilter = ref<Record<string, unknown>>({});
const form = reactive({ userId: 0, penaltyType: '', scope: 'global', reasonCode: '', referenceType: '', referenceId: 0, endsAt: '' });
const types = [
  ['warning', '警告'], ['content_removed', '内容下架'], ['send_restricted', '限制发送'],
  ['pick_restricted', '限制捞取'], ['chat_restricted', '限制聊天'],
  ['temporary_suspension', '临时封禁'], ['permanent_ban', '永久封禁'],
  ['device_restricted', '限制设备'],
];
const code = (value: string) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value);
function typeText(value: string) { return types.find(([key]) => key === value)?.[1] || value; }

async function load(cursor = '') {
  loading.value = true;
  try {
    const result = await listPenalties({ ...appliedFilter.value, cursor: cursor || undefined, limit: 20 });
    rows.value = result.items || []; nextCursor.value = result.nextCursor;
  } finally { loading.value = false; }
}
function search() {
  if (filter.createdRange?.length === 2 && filter.createdRange[0]!.getTime() >= filter.createdRange[1]!.getTime()) {
    ElMessage.warning('结束时间必须晚于开始时间'); return;
  }
  appliedFilter.value = {
    userId: filter.userId.trim() || undefined,
    status: filter.status || undefined,
    penaltyType: filter.penaltyType || undefined,
    scope: filter.scope.trim() || undefined,
    referenceType: filter.referenceType.trim() || undefined,
    referenceId: filter.referenceId.trim() || undefined,
    createdBy: filter.createdBy.trim() || undefined,
    createdFrom: filter.createdRange?.[0]?.toISOString(),
    createdUntil: filter.createdRange?.[1]?.toISOString(),
  };
  cursorStack.value = [];
  void load();
}
function next() { if (!nextCursor.value) return; cursorStack.value.push(nextCursor.value); void load(nextCursor.value); }
function previous() { cursorStack.value.pop(); void load(cursorStack.value.at(-1) || ''); }
function openCreate() {
  Object.assign(form, { userId: 0, penaltyType: '', scope: 'global', reasonCode: '', referenceType: '', referenceId: 0, endsAt: '' });
  createKey.value = crypto.randomUUID(); createOpen.value = true;
}
async function save() {
  if (form.userId < 1 || form.referenceId < 1 || !form.penaltyType || !code(form.scope) || !code(form.reasonCode) || !code(form.referenceType)) {
    ElMessage.error('请填写用户、处罚类型、范围、原因及关联记录'); return;
  }
  saving.value = true;
  try {
    await createPenalty({ ...form, endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null }, createKey.value);
    createOpen.value = false; ElMessage.success('处罚已创建'); search();
  } finally { saving.value = false; }
}
async function revoke(row: PenaltyRow) {
  const { value } = await ElMessageBox.prompt(`请输入撤销处罚 #${row.penaltyId} 的原因代码`, '撤销处罚', {
    inputValidator: (text) => code(text.trim()) || '请输入 1–64 位稳定原因代码',
  });
  await revokePenalty(row.penaltyId, value.trim(), crypto.randomUUID());
  ElMessage.success('处罚已撤销'); await load(cursorStack.value.at(-1) || '');
}
onMounted(search);
</script>

<template>
  <div class="p-5"><ElCard shadow="never">
    <template #header><div class="flex items-center justify-between"><span>用户处罚</span><ElButton v-if="canCreate" type="primary" @click="openCreate">创建处罚</ElButton></div></template>
    <div class="mb-4 flex flex-wrap gap-3"><ElInput v-model="filter.userId" placeholder="用户 ID" clearable class="!w-32" /><ElSelect v-model="filter.status" clearable placeholder="全部状态" class="!w-32"><ElOption label="生效中" value="active" /><ElOption label="已过期" value="expired" /><ElOption label="已撤销" value="revoked" /></ElSelect><ElSelect v-model="filter.penaltyType" clearable placeholder="处罚类型" class="!w-44"><ElOption v-for="[value, label] in types" :key="value" :label="label" :value="value" /></ElSelect><ElInput v-model="filter.scope" placeholder="生效范围" clearable class="!w-32" /><ElInput v-model="filter.referenceType" placeholder="关联类型" clearable class="!w-32" /><ElInput v-model="filter.referenceId" placeholder="关联 ID" clearable class="!w-32" /><ElInput v-model="filter.createdBy" placeholder="创建管理员 ID" clearable class="!w-40" /><ElDatePicker v-model="filter.createdRange" type="datetimerange" range-separator="至" start-placeholder="创建开始" end-placeholder="创建结束" class="!w-[390px]" /><ElButton @click="search">查询</ElButton></div>
    <ElTable v-loading="loading" :data="rows" row-key="penaltyId"><ElTableColumn prop="penaltyId" label="处罚 ID" width="100" /><ElTableColumn prop="userId" label="用户 ID" width="100" /><ElTableColumn label="类型" min-width="120"><template #default="{ row }">{{ typeText(row.penaltyType) }}</template></ElTableColumn><ElTableColumn prop="scope" label="范围" width="110" /><ElTableColumn prop="reasonCode" label="原因代码" min-width="145" /><ElTableColumn label="关联记录" min-width="150"><template #default="{ row }">{{ row.referenceType }} #{{ row.referenceId }}</template></ElTableColumn><ElTableColumn prop="status" label="状态" width="95" /><ElTableColumn prop="endsAt" label="结束时间" min-width="170"><template #default="{ row }"><AdminTime :value="row.endsAt" /></template></ElTableColumn><ElTableColumn label="操作" width="95"><template #default="{ row }"><ElButton v-if="canRevoke && row.status === 'active'" link type="warning" @click="revoke(row)">撤销</ElButton></template></ElTableColumn></ElTable>
    <div class="mt-4 flex justify-end gap-2"><ElButton :disabled="cursorStack.length === 0" @click="previous">上一页</ElButton><ElButton :disabled="!nextCursor" @click="next">下一页</ElButton></div>
  </ElCard>
  <ElDialog v-model="createOpen" title="创建处罚" width="540px"><ElForm label-width="110px"><ElFormItem label="用户 ID"><ElInputNumber v-model="form.userId" :min="1" /></ElFormItem><ElFormItem label="处罚类型"><ElSelect v-model="form.penaltyType" placeholder="请选择"><ElOption v-for="[value, label] in types" :key="value" :label="label" :value="value" /></ElSelect></ElFormItem><ElFormItem label="生效范围"><ElInput v-model="form.scope" placeholder="稳定范围代码" /></ElFormItem><ElFormItem label="原因代码"><ElInput v-model="form.reasonCode" /></ElFormItem><ElFormItem label="关联类型"><ElInput v-model="form.referenceType" placeholder="如 report" /></ElFormItem><ElFormItem label="关联 ID"><ElInputNumber v-model="form.referenceId" :min="1" /></ElFormItem><ElFormItem label="结束时间"><ElDatePicker v-model="form.endsAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="留空表示无固定结束时间" /></ElFormItem></ElForm><template #footer><ElButton @click="createOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="save">创建</ElButton></template></ElDialog>
  </div>
</template>
