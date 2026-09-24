<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';

import { ElMessage, ElMessageBox } from 'element-plus';

import { createBottleCategory, createInterest, listBottleCategories, listInterests, listTaxonomyTranslations, reviewTaxonomyTranslation, submitTaxonomyTranslation, updateBottleCategory, updateInterest } from '#/api/taxonomy';
import type { TaxonomyRow, TaxonomyTranslationRequest } from '#/api/taxonomy';
import AdminTime from '#/components/admin-time.vue';

const { hasAccessByCodes } = useAccess();
const canUpdate = computed(() => hasAccessByCodes(['taxonomy.update']));
const canCreate = computed(() => hasAccessByCodes(['taxonomy.create']));
const canWriteTranslation = computed(() => hasAccessByCodes(['taxonomy.translation.write']));
const canReviewTranslation = computed(() => hasAccessByCodes(['taxonomy.translation.review']));
const active = ref<'categories' | 'interests'>('categories');
const rows = ref<TaxonomyRow[]>([]);
const loading = ref(false);
const saving = ref(false);
const editorOpen = ref(false);
const createOpen = ref(false);
const createKey = ref('');
const translationOpen = ref(false);
const translationKey = ref('');
const translationRows = ref<TaxonomyTranslationRequest[]>([]);
const translationNextCursor = ref<string | null>(null);
const translationCursorStack = ref<string[]>([]);
const translationStatus = ref('pending');
const editing = ref<TaxonomyRow | null>(null);
const filter = reactive({ code: '', enabled: '' });
const form = reactive({ enabled: false, sortOrder: 0 });
const createForm = reactive({ code: '', nameEn: '', sortOrder: 0 });
const translationForm = reactive({ resourceId: 0, resourceType: 'bottle_category' as 'bottle_category' | 'interest', code: '', languageCode: '', name: '' });
async function load() {
  loading.value = true;
  try {
    const params = { code: filter.code.trim() || undefined, enabled: filter.enabled || undefined };
    rows.value = active.value === 'categories' ? await listBottleCategories(params) : await listInterests(params);
  } finally { loading.value = false; }
}
async function loadTranslations(cursor = '') {
  const result = await listTaxonomyTranslations({ status: translationStatus.value || undefined, cursor: cursor || undefined, limit: 20 });
  translationRows.value = result.items || [];
  translationNextCursor.value = result.nextCursor;
}
function searchTranslations() { translationCursorStack.value = []; void loadTranslations(); }
function nextTranslations() { if (!translationNextCursor.value) return; translationCursorStack.value.push(translationNextCursor.value); void loadTranslations(translationNextCursor.value); }
function previousTranslations() { translationCursorStack.value.pop(); void loadTranslations(translationCursorStack.value.at(-1) || ''); }
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
function openTranslation(row: TaxonomyRow) {
  Object.assign(translationForm, { resourceId: row.id, resourceType: active.value === 'categories' ? 'bottle_category' : 'interest', code: row.code, languageCode: '', name: '' });
  translationKey.value = crypto.randomUUID();
  translationOpen.value = true;
}
async function saveTranslation() {
  const languageCode = translationForm.languageCode.trim();
  const name = translationForm.name.trim();
  if (!/^[a-z]{2,3}(-[A-Z]{2})?$/.test(languageCode) || !name || name.length > 80) {
    ElMessage.error('请输入已登记语言代码和不超过 80 字的名称'); return;
  }
  saving.value = true;
  try {
    await submitTaxonomyTranslation({ resourceType: translationForm.resourceType, resourceId: translationForm.resourceId, languageCode, name }, translationKey.value);
    translationOpen.value = false;
    ElMessage.success('翻译已提交复核，当前展示名称尚未改变');
    await loadTranslations();
  } finally { saving.value = false; }
}
async function reviewTranslation(row: TaxonomyTranslationRequest, approve: boolean) {
  const { value } = await ElMessageBox.prompt(approve ? '可填写复核说明' : '请填写驳回原因', approve ? '通过翻译' : '驳回翻译', {
    inputValidator: (text) => text.length <= 500 && (approve || !!text.trim()) || '请填写不超过 500 字的原因',
  });
  await reviewTaxonomyTranslation(row.requestId, approve, value.trim());
  ElMessage.success(approve ? '翻译已复核并发布' : '翻译已驳回');
  await Promise.all([load(), loadTranslations(translationCursorStack.value.at(-1) || '')]);
}
onMounted(() => { void Promise.all([load(), loadTranslations()]); });
</script>

<template>
  <div class="p-5"><ElCard shadow="never"><template #header>兴趣与漂流瓶分类</template>
    <ElTabs v-model="active" @tab-change="switchTab"><ElTabPane label="漂流瓶分类" name="categories" /><ElTabPane label="兴趣标签" name="interests" /></ElTabs>
    <div class="mb-4 flex gap-3"><ElInput v-model="filter.code" placeholder="分类代码" clearable class="!w-40" /><ElSelect v-model="filter.enabled" clearable placeholder="全部状态" class="!w-32"><ElOption label="启用" value="true" /><ElOption label="停用" value="false" /></ElSelect><ElButton @click="load">查询</ElButton><ElButton v-if="canCreate" type="primary" @click="openCreate">新增条目</ElButton></div>
    <ElTable v-loading="loading" :data="rows" row-key="id"><ElTableColumn prop="id" label="ID" width="90" /><ElTableColumn prop="code" label="代码" min-width="145" /><ElTableColumn label="翻译名称" min-width="240"><template #default="{ row }">{{ translationText(row) }}</template></ElTableColumn><ElTableColumn label="状态" width="90"><template #default="{ row }">{{ row.enabled ? '启用' : '停用' }}</template></ElTableColumn><ElTableColumn prop="sortOrder" label="排序" width="90" /><ElTableColumn prop="updatedAt" label="更新时间" min-width="175"><template #default="{ row }"><AdminTime :value="row.updatedAt" /></template></ElTableColumn><ElTableColumn v-if="canUpdate || canWriteTranslation" label="操作" width="150"><template #default="{ row }"><ElButton v-if="canUpdate" link type="primary" @click="openEditor(row)">配置</ElButton><ElButton v-if="canWriteTranslation" link type="primary" @click="openTranslation(row)">提交翻译</ElButton></template></ElTableColumn></ElTable>
  </ElCard>
  <ElCard class="mt-5" shadow="never"><template #header>分类翻译复核</template>
    <div class="mb-4 flex gap-3"><ElSelect v-model="translationStatus" clearable placeholder="全部状态" class="!w-36"><ElOption label="待复核" value="pending" /><ElOption label="已发布" value="approved" /><ElOption label="已驳回" value="rejected" /></ElSelect><ElButton @click="searchTranslations">查询</ElButton></div>
    <ElTable :data="translationRows" row-key="requestId"><ElTableColumn prop="requestId" label="申请 ID" width="95" /><ElTableColumn label="条目类型" width="115"><template #default="{ row }">{{ row.resourceType === 'interest' ? '兴趣标签' : '漂流瓶分类' }}</template></ElTableColumn><ElTableColumn prop="resourceId" label="条目 ID" width="90" /><ElTableColumn prop="languageCode" label="语言" width="85" /><ElTableColumn prop="proposedName" label="拟发布名称" min-width="170" /><ElTableColumn label="状态" width="95"><template #default="{ row }">{{ row.status === 'pending' ? '待复核' : row.status === 'approved' ? '已发布' : '已驳回' }}</template></ElTableColumn><ElTableColumn prop="requestedBy" label="提交人 ID" width="105" /><ElTableColumn prop="createdAt" label="提交时间" min-width="170"><template #default="{ row }"><AdminTime :value="row.createdAt" /></template></ElTableColumn><ElTableColumn v-if="canReviewTranslation" label="复核" width="150"><template #default="{ row }"><template v-if="row.status === 'pending'"><ElButton link type="primary" @click="reviewTranslation(row, true)">通过</ElButton><ElButton link type="danger" @click="reviewTranslation(row, false)">驳回</ElButton></template></template></ElTableColumn></ElTable>
    <div class="mt-4 flex justify-end gap-2"><ElButton :disabled="translationCursorStack.length === 0" @click="previousTranslations">上一页</ElButton><ElButton :disabled="!translationNextCursor" @click="nextTranslations">下一页</ElButton></div>
  </ElCard>
  <ElDialog v-model="editorOpen" :title="`配置 ${editing?.code || ''}`" width="480px"><ElForm label-width="95px"><ElFormItem label="启用"><ElSwitch v-model="form.enabled" /></ElFormItem><ElFormItem label="排序值"><ElInputNumber v-model="form.sortOrder" :min="0" /></ElFormItem></ElForm><template #footer><ElButton @click="editorOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="save">保存</ElButton></template></ElDialog>
  <ElDialog v-model="createOpen" :title="active === 'categories' ? '新增漂流瓶分类' : '新增兴趣标签'" width="500px"><ElAlert class="mb-4" title="新条目仅写入英文名称并默认停用；启用前请确认所需语言的翻译已准备。" type="info" show-icon :closable="false" /><ElForm label-width="110px"><ElFormItem label="代码"><ElInput v-model="createForm.code" maxlength="64" placeholder="小写字母、数字、下划线或连字符" /></ElFormItem><ElFormItem label="英文名称"><ElInput v-model="createForm.nameEn" maxlength="80" /></ElFormItem><ElFormItem label="排序值"><ElInputNumber v-model="createForm.sortOrder" :min="0" :max="2147483647" /></ElFormItem></ElForm><template #footer><ElButton @click="createOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="saveCreate">创建</ElButton></template></ElDialog>
  <ElDialog v-model="translationOpen" :title="`提交 ${translationForm.code} 翻译`" width="500px"><ElForm label-width="100px"><ElFormItem label="语言代码"><ElInput v-model="translationForm.languageCode" placeholder="如 hi 或 en" /></ElFormItem><ElFormItem label="翻译名称"><ElInput v-model="translationForm.name" maxlength="80" /></ElFormItem></ElForm><template #footer><ElButton @click="translationOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="saveTranslation">提交复核</ElButton></template></ElDialog></div>
</template>
