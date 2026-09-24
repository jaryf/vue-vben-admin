<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';

import { ElMessage, ElMessageBox } from 'element-plus';

import { listLanguages, updateLanguage } from '#/api/languages';
import type { LanguageRow } from '#/api/languages';

const { hasAccessByCodes } = useAccess();
const canUpdate = computed(() => hasAccessByCodes(['language.update']));
const rows = ref<LanguageRow[]>([]);
const loading = ref(false);
const saving = ref(false);
const editorOpen = ref(false);
const editing = ref<LanguageRow | null>(null);
const filter = reactive({ code: '', enabled: '' });
const form = reactive({ enabled: false, clientAvailable: false, contentAvailable: false, moderationAvailable: false, aiGenerationAvailable: false });
async function load() {
  loading.value = true;
  try { rows.value = await listLanguages({ code: filter.code.trim() || undefined, enabled: filter.enabled || undefined }); }
  finally { loading.value = false; }
}
function openEditor(row: LanguageRow) {
  editing.value = row;
  Object.assign(form, {
    enabled: row.enabled, clientAvailable: row.clientAvailable,
    contentAvailable: row.contentAvailable, moderationAvailable: row.moderationAvailable,
    aiGenerationAvailable: row.aiGenerationAvailable,
  });
  editorOpen.value = true;
}
async function save() {
  if (!editing.value) return;
  await ElMessageBox.confirm(`确定更新 ${editing.value.displayName} 的能力开关吗？`, '确认语言配置', { type: 'warning' });
  saving.value = true;
  try {
    await updateLanguage(editing.value.code, { ...form });
    editorOpen.value = false; ElMessage.success('语言能力已更新'); await load();
  } finally { saving.value = false; }
}
onMounted(() => { void load(); });
</script>

<template>
  <div class="p-5"><ElCard shadow="never"><template #header>语言与能力</template>
    <div class="mb-4 flex gap-3"><ElInput v-model="filter.code" placeholder="语言代码" clearable class="!w-36" /><ElSelect v-model="filter.enabled" clearable placeholder="全部启用状态" class="!w-40"><ElOption label="启用" value="true" /><ElOption label="停用" value="false" /></ElSelect><ElButton @click="load">查询</ElButton></div>
    <ElTable v-loading="loading" :data="rows" row-key="code"><ElTableColumn prop="code" label="代码" width="90" /><ElTableColumn prop="displayName" label="显示名称" min-width="130" /><ElTableColumn prop="nativeName" label="本地名称" min-width="130" /><ElTableColumn label="启用" width="75"><template #default="{ row }">{{ row.enabled ? '是' : '否' }}</template></ElTableColumn><ElTableColumn label="客户端" width="80"><template #default="{ row }">{{ row.clientAvailable ? '可用' : '不可用' }}</template></ElTableColumn><ElTableColumn label="内容" width="80"><template #default="{ row }">{{ row.contentAvailable ? '可用' : '不可用' }}</template></ElTableColumn><ElTableColumn label="审核" width="80"><template #default="{ row }">{{ row.moderationAvailable ? '可用' : '不可用' }}</template></ElTableColumn><ElTableColumn label="AI 生成" width="90"><template #default="{ row }">{{ row.aiGenerationAvailable ? '可用' : '不可用' }}</template></ElTableColumn><ElTableColumn prop="fallbackLanguageCode" label="回退语言" width="105" /><ElTableColumn prop="updatedAt" label="更新时间" min-width="170" /><ElTableColumn v-if="canUpdate" label="操作" width="85"><template #default="{ row }"><ElButton link type="primary" @click="openEditor(row)">配置</ElButton></template></ElTableColumn></ElTable>
  </ElCard><ElDialog v-model="editorOpen" :title="`配置语言 ${editing?.displayName || ''}`" width="520px"><ElForm label-width="125px"><ElFormItem label="启用语言"><ElSwitch v-model="form.enabled" /></ElFormItem><ElFormItem label="客户端可用"><ElSwitch v-model="form.clientAvailable" /></ElFormItem><ElFormItem label="内容可用"><ElSwitch v-model="form.contentAvailable" /></ElFormItem><ElFormItem label="审核可用"><ElSwitch v-model="form.moderationAvailable" /></ElFormItem><ElFormItem label="AI 生成可用"><ElSwitch v-model="form.aiGenerationAvailable" /></ElFormItem></ElForm><template #footer><ElButton @click="editorOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="save">保存</ElButton></template></ElDialog></div>
</template>
