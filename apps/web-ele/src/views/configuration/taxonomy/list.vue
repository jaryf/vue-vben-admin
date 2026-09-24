<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';

import { ElMessage, ElMessageBox } from 'element-plus';

import { createBottleCategory, createInterest, listBottleCategories, listInterests, updateBottleCategory, updateInterest } from '#/api/taxonomy';
import type { TaxonomyRow } from '#/api/taxonomy';

const { hasAccessByCodes } = useAccess();
const canUpdate = computed(() => hasAccessByCodes(['taxonomy.update']));
const canCreate = computed(() => hasAccessByCodes(['taxonomy.create']));
const active = ref<'categories' | 'interests'>('categories');
const rows = ref<TaxonomyRow[]>([]);
const loading = ref(false);
const saving = ref(false);
const editorOpen = ref(false);
const createOpen = ref(false);
const createKey = ref('');
const editing = ref<TaxonomyRow | null>(null);
const filter = reactive({ code: '', enabled: '' });
const form = reactive({ enabled: false, sortOrder: 0 });
const createForm = reactive({ code: '', nameEn: '', sortOrder: 0 });
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
function openCreate() {
  Object.assign(createForm, { code: '', nameEn: '', sortOrder: 0 });
  createKey.value = crypto.randomUUID();
  createOpen.value = true;
}
async function saveCreate() {
  const code = createForm.code.trim().toLowerCase();
  const nameEn = createForm.nameEn.trim();
  if (!/^[a-z0-9_-]{1,64}$/.test(code) || !nameEn || nameEn.length > 80 ||
    !Number.isInteger(createForm.sortOrder) || createForm.sortOrder < 0 || createForm.sortOrder > 2_147_483_647) {
    ElMessage.error('请填写有效代码、英文名称和排序值'); return;
  }
  saving.value = true;
  try {
    const input = { code, nameEn, sortOrder: createForm.sortOrder };
    if (active.value === 'categories') await createBottleCategory(input, createKey.value);
    else await createInterest(input, createKey.value);
    createOpen.value = false;
    ElMessage.success('条目已创建，默认停用');
    await load();
  } finally { saving.value = false; }
}
onMounted(() => { void load(); });
</script>

<template>
  <div class="p-5"><ElCard shadow="never"><template #header>兴趣与漂流瓶分类</template>
    <ElTabs v-model="active" @tab-change="switchTab"><ElTabPane label="漂流瓶分类" name="categories" /><ElTabPane label="兴趣标签" name="interests" /></ElTabs>
    <div class="mb-4 flex gap-3"><ElInput v-model="filter.code" placeholder="分类代码" clearable class="!w-40" /><ElSelect v-model="filter.enabled" clearable placeholder="全部状态" class="!w-32"><ElOption label="启用" value="true" /><ElOption label="停用" value="false" /></ElSelect><ElButton @click="load">查询</ElButton><ElButton v-if="canCreate" type="primary" @click="openCreate">新增条目</ElButton></div>
    <ElTable v-loading="loading" :data="rows" row-key="id"><ElTableColumn prop="id" label="ID" width="90" /><ElTableColumn prop="code" label="代码" min-width="145" /><ElTableColumn label="翻译名称" min-width="240"><template #default="{ row }">{{ translationText(row) }}</template></ElTableColumn><ElTableColumn label="状态" width="90"><template #default="{ row }">{{ row.enabled ? '启用' : '停用' }}</template></ElTableColumn><ElTableColumn prop="sortOrder" label="排序" width="90" /><ElTableColumn prop="updatedAt" label="更新时间" min-width="175" /><ElTableColumn v-if="canUpdate" label="操作" width="85"><template #default="{ row }"><ElButton link type="primary" @click="openEditor(row)">配置</ElButton></template></ElTableColumn></ElTable>
  </ElCard><ElDialog v-model="editorOpen" :title="`配置 ${editing?.code || ''}`" width="480px"><ElForm label-width="95px"><ElFormItem label="启用"><ElSwitch v-model="form.enabled" /></ElFormItem><ElFormItem label="排序值"><ElInputNumber v-model="form.sortOrder" :min="0" /></ElFormItem></ElForm><template #footer><ElButton @click="editorOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="save">保存</ElButton></template></ElDialog>
  <ElDialog v-model="createOpen" :title="active === 'categories' ? '新增漂流瓶分类' : '新增兴趣标签'" width="500px"><ElAlert class="mb-4" title="新条目仅写入英文名称并默认停用；启用前请确认所需语言的翻译已准备。" type="info" show-icon :closable="false" /><ElForm label-width="110px"><ElFormItem label="代码"><ElInput v-model="createForm.code" maxlength="64" placeholder="小写字母、数字、下划线或连字符" /></ElFormItem><ElFormItem label="英文名称"><ElInput v-model="createForm.nameEn" maxlength="80" /></ElFormItem><ElFormItem label="排序值"><ElInputNumber v-model="createForm.sortOrder" :min="0" :max="2147483647" /></ElFormItem></ElForm><template #footer><ElButton @click="createOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="saveCreate">创建</ElButton></template></ElDialog></div>
</template>
