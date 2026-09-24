<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';

import { ElMessage, ElMessageBox } from 'element-plus';

import { changeAIRoleStatus, createAIRole, getAIRole, listAIRoles, updateAIRole } from '#/api/ai';
import type { AIRole } from '#/api/ai';

const rows = ref<AIRole[]>([]);
const nextCursor = ref<string | null>(null);
const cursorStack = ref<string[]>([]);
const status = ref('');
const loading = ref(false);
const saving = ref(false);
const editorOpen = ref(false);
const editingId = ref<number | null>(null);
const createKey = ref('');
const form = reactive({
  name: '', persona: '', styleRules: '', safetyRules: '', languages: 'en',
  interestTagIds: '', allowedCategories: '', adultEnabled: false,
  dailyMessageLimit: 20, replyDelayMinSeconds: 10, replyDelayMaxSeconds: 60,
});

function lines(value: string) { return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean); }
function commas(value: string) { return value.split(',').map((item) => item.trim()).filter(Boolean); }

async function load(cursor = '') {
  loading.value = true;
  try {
    const result = await listAIRoles({ status: status.value || undefined, cursor: cursor || undefined, limit: 20 });
    rows.value = result.items || [];
    nextCursor.value = result.nextCursor;
  } finally { loading.value = false; }
}

function search() { cursorStack.value = []; void load(); }
function next() { if (!nextCursor.value) return; cursorStack.value.push(nextCursor.value); void load(nextCursor.value); }
function previous() { cursorStack.value.pop(); void load(cursorStack.value.at(-1) || ''); }

async function openEditor(row?: AIRole) {
  editingId.value = row?.roleId ?? null;
  createKey.value = crypto.randomUUID();
  const value = row ? await getAIRole(row.roleId) : null;
  Object.assign(form, {
    name: value?.name ?? '', persona: value?.persona ?? '',
    styleRules: value?.styleRules.join('\n') ?? '', safetyRules: value?.safetyRules.join('\n') ?? '',
    languages: value?.languages.join(', ') ?? 'en',
    interestTagIds: value?.interestTagIds.join(', ') ?? '',
    allowedCategories: value?.allowedCategories.join(', ') ?? '',
    adultEnabled: value?.adultEnabled ?? false,
    dailyMessageLimit: value?.dailyMessageLimit ?? 20,
    replyDelayMinSeconds: value?.replyDelayMinSeconds ?? 10,
    replyDelayMaxSeconds: value?.replyDelayMaxSeconds ?? 60,
  });
  editorOpen.value = true;
}

async function save() {
  const ids = commas(form.interestTagIds).map(Number);
  if (!form.name.trim() || !form.persona.trim() || !commas(form.languages).length || ids.some((id) => !Number.isInteger(id) || id < 1)) {
    ElMessage.error('请填写名称、人设、语言及有效兴趣标签 ID'); return;
  }
  if (form.replyDelayMaxSeconds < form.replyDelayMinSeconds) {
    ElMessage.error('最大回复延迟不能小于最小值'); return;
  }
  const data = {
    name: form.name.trim(), persona: form.persona.trim(),
    styleRules: lines(form.styleRules), safetyRules: lines(form.safetyRules),
    languages: commas(form.languages), interestTagIds: ids,
    allowedCategories: commas(form.allowedCategories), adultEnabled: form.adultEnabled,
    dailyMessageLimit: form.dailyMessageLimit,
    replyDelayMinSeconds: form.replyDelayMinSeconds, replyDelayMaxSeconds: form.replyDelayMaxSeconds,
  };
  saving.value = true;
  try {
    if (editingId.value === null) await createAIRole(data, createKey.value);
    else await updateAIRole(editingId.value, data);
    editorOpen.value = false;
    ElMessage.success('AI 角色已保存');
    await load(cursorStack.value.at(-1) || '');
  } finally { saving.value = false; }
}

async function toggle(row: AIRole) {
  const enable = row.status !== 'enabled';
  await ElMessageBox.confirm(`确定${enable ? '启用' : '停用'} AI 角色「${row.name}」吗？`, '确认状态变更', { type: 'warning' });
  await changeAIRoleStatus(row.roleId, enable);
  ElMessage.success('状态已更新');
  await load(cursorStack.value.at(-1) || '');
}

onMounted(() => { void load(); });
</script>

<template>
  <div class="p-5">
    <ElCard shadow="never">
      <template #header><div class="flex items-center justify-between"><span>AI 角色</span><ElButton type="primary" @click="openEditor()">新增角色</ElButton></div></template>
      <div class="mb-4 flex gap-3"><ElSelect v-model="status" clearable placeholder="全部状态" class="!w-40"><ElOption label="启用" value="enabled" /><ElOption label="停用" value="disabled" /></ElSelect><ElButton @click="search">查询</ElButton></div>
      <ElTable v-loading="loading" :data="rows" row-key="roleId"><ElTableColumn prop="roleId" label="角色 ID" width="95" /><ElTableColumn prop="name" label="名称" min-width="135" /><ElTableColumn prop="persona" label="人设" min-width="220" show-overflow-tooltip /><ElTableColumn label="语言" min-width="125"><template #default="{ row }">{{ row.languages?.join('、') }}</template></ElTableColumn><ElTableColumn prop="dailyMessageLimit" label="每日回复上限" width="120" /><ElTableColumn prop="status" label="状态" width="100" /><ElTableColumn prop="createdAt" label="创建时间" min-width="175" /><ElTableColumn label="操作" width="145"><template #default="{ row }"><ElButton link type="primary" @click="openEditor(row)">编辑</ElButton><ElButton link :type="row.status === 'enabled' ? 'warning' : 'success'" @click="toggle(row)">{{ row.status === 'enabled' ? '停用' : '启用' }}</ElButton></template></ElTableColumn></ElTable>
      <div class="mt-4 flex justify-end gap-2"><ElButton :disabled="cursorStack.length === 0" @click="previous">上一页</ElButton><ElButton :disabled="!nextCursor" @click="next">下一页</ElButton></div>
    </ElCard>
    <ElDialog v-model="editorOpen" :title="editingId === null ? '新增 AI 角色' : '编辑 AI 角色'" width="650px" destroy-on-close>
      <ElForm label-width="120px" @submit.prevent="save">
        <ElFormItem label="名称"><ElInput v-model="form.name" /></ElFormItem>
        <ElFormItem label="人设"><ElInput v-model="form.persona" type="textarea" :rows="3" /></ElFormItem>
        <ElFormItem label="风格规则"><ElInput v-model="form.styleRules" type="textarea" :rows="3" placeholder="每行一条" /></ElFormItem>
        <ElFormItem label="安全规则"><ElInput v-model="form.safetyRules" type="textarea" :rows="3" placeholder="每行一条" /></ElFormItem>
        <ElFormItem label="语言代码"><ElInput v-model="form.languages" placeholder="逗号分隔，例如 en, hi" /></ElFormItem>
        <ElFormItem label="兴趣标签 ID"><ElInput v-model="form.interestTagIds" placeholder="逗号分隔" /></ElFormItem>
        <ElFormItem label="允许分类"><ElInput v-model="form.allowedCategories" placeholder="逗号分隔分类代码" /></ElFormItem>
        <ElFormItem label="成人内容"><ElSwitch v-model="form.adultEnabled" /></ElFormItem>
        <ElFormItem label="每日回复上限"><ElInputNumber v-model="form.dailyMessageLimit" :min="1" /></ElFormItem>
        <ElFormItem label="最小回复延迟"><ElInputNumber v-model="form.replyDelayMinSeconds" :min="0" /> 秒</ElFormItem>
        <ElFormItem label="最大回复延迟"><ElInputNumber v-model="form.replyDelayMaxSeconds" :min="0" /> 秒</ElFormItem>
      </ElForm>
      <template #footer><ElButton @click="editorOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="save">保存</ElButton></template>
    </ElDialog>
  </div>
</template>
