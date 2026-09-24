<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';

import { ElMessage, ElMessageBox } from 'element-plus';

import { listBottleCategories, listInterests, updateBottleCategory, updateInterest } from '#/api/taxonomy';
import type { TaxonomyRow } from '#/api/taxonomy';

const { hasAccessByCodes } = useAccess();
const canUpdate = computed(() => hasAccessByCodes(['taxonomy.update']));
const active = ref<'categories' | 'interests'>('categories');
const rows = ref<TaxonomyRow[]>([]);
const loading = ref(false);
const saving = ref(false);
const editorOpen = ref(false);
const editing = ref<TaxonomyRow | null>(null);
const filter = reactive({ code: '', enabled: '' });
const form = reactive({ enabled: false, sortOrder: 0 });
async function load() {
  loading.value = true;
  try {
    const params = { code: filter.code.trim() || undefined, enabled: filter.enabled || undefined };
    rows.value = active.value === 'categories' ? await listBottleCategories(params) : await listInterests(params);
  } finally { loading.value = false; }
}
function switchTab() { Object.assign(filter, { code: '', enabled: '' }); void load(); }
function translationText(row: TaxonomyRow) { return row.translations.map((item) => `${item.languageCode}: ${item.name}`).join('；') || '尚无翻译'; }
function openEditor(row: TaxonomyRow) { editing.value = row; Object.assign(form, { enabled: row.enabled, sortOrder: row.sortOrder }); editorOpen.value = true; }
async function save() {
  if (!editing.value) return;
  await ElMessageBox.confirm(`确定更新「${editing.value.code}」吗？`, '确认分类调整', { type: 'warning' });
  saving.value = true;
  try {
    if (active.value === 'categories') await updateBottleCategory(editing.value.id, { ...form });
    else await updateInterest(editing.value.id, { ...form });
    editorOpen.value = false; ElMessage.success('分类已更新'); await load();
  } finally { saving.value = false; }
}
onMounted(() => { void load(); });
</script>

<template>
  <div class="p-5"><ElCard shadow="never"><template #header>兴趣与漂流瓶分类</template>
    <ElTabs v-model="active" @tab-change="switchTab"><ElTabPane label="漂流瓶分类" name="categories" /><ElTabPane label="兴趣标签" name="interests" /></ElTabs>
    <div class="mb-4 flex gap-3"><ElInput v-model="filter.code" placeholder="分类代码" clearable class="!w-40" /><ElSelect v-model="filter.enabled" clearable placeholder="全部状态" class="!w-32"><ElOption label="启用" value="true" /><ElOption label="停用" value="false" /></ElSelect><ElButton @click="load">查询</ElButton></div>
    <ElTable v-loading="loading" :data="rows" row-key="id"><ElTableColumn prop="id" label="ID" width="90" /><ElTableColumn prop="code" label="代码" min-width="145" /><ElTableColumn label="翻译名称" min-width="240"><template #default="{ row }">{{ translationText(row) }}</template></ElTableColumn><ElTableColumn label="状态" width="90"><template #default="{ row }">{{ row.enabled ? '启用' : '停用' }}</template></ElTableColumn><ElTableColumn prop="sortOrder" label="排序" width="90" /><ElTableColumn prop="updatedAt" label="更新时间" min-width="175" /><ElTableColumn v-if="canUpdate" label="操作" width="85"><template #default="{ row }"><ElButton link type="primary" @click="openEditor(row)">配置</ElButton></template></ElTableColumn></ElTable>
  </ElCard><ElDialog v-model="editorOpen" :title="`配置 ${editing?.code || ''}`" width="480px"><ElForm label-width="95px"><ElFormItem label="启用"><ElSwitch v-model="form.enabled" /></ElFormItem><ElFormItem label="排序值"><ElInputNumber v-model="form.sortOrder" :min="0" /></ElFormItem></ElForm><template #footer><ElButton @click="editorOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="save">保存</ElButton></template></ElDialog></div>
</template>
