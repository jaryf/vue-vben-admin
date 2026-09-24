<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';

import dayjs from 'dayjs';
import { ElMessage, ElMessageBox } from 'element-plus';

import {
  createLegalVersion, getLegalVersion, listLegalVersions, publishLegalVersion,
  retireLegalVersion, reviewLegalVersion, updateLegalVersion,
} from '#/api/legal-documents';
import type { LegalDetail, LegalTranslation, LegalVersion } from '#/api/legal-documents';
import AdminTime from '#/components/admin-time.vue';

const { hasAccessByCodes } = useAccess();
const canWrite = computed(() => hasAccessByCodes(['legal_document.write']));
const canReview = computed(() => hasAccessByCodes(['legal_document.review']));
const canPublish = computed(() => hasAccessByCodes(['legal_document.publish']));
const rows = ref<LegalVersion[]>([]);
const nextCursor = ref<string | null>(null);
const cursorStack = ref<string[]>([]);
const loading = ref(false);
const saving = ref(false);
const editorOpen = ref(false);
const detailOpen = ref(false);
const detail = ref<LegalDetail | null>(null);
const editingId = ref<number | null>(null);
const filter = reactive({ documentType: '', status: '' });
const form = reactive<{ documentType: string; version: string; effectiveAt: string; translations: LegalTranslation[] }>({
  documentType: 'terms', version: '', effectiveAt: '', translations: [{ languageCode: 'en', title: '', bodyMarkdown: '' }],
});
const types = [['terms', '服务条款'], ['privacy', '隐私政策'], ['community_guidelines', '社区准则'], ['content_policy', '内容政策'], ['account_deletion', '账户注销说明']];
const typeText = (value: string) => types.find(([key]) => key === value)?.[1] || value;
const statusText = (value: string) => ({ draft: '草稿', published: '已发布', retired: '已退役' })[value as 'draft' | 'published' | 'retired'] || value;
async function load(cursor = '') {
  loading.value = true;
  try {
    const result = await listLegalVersions({ documentType: filter.documentType || undefined, status: filter.status || undefined, cursor: cursor || undefined, limit: 20 });
    rows.value = result.items || []; nextCursor.value = result.nextCursor;
  } finally { loading.value = false; }
}
function search() { cursorStack.value = []; void load(); }
function next() { if (!nextCursor.value) return; cursorStack.value.push(nextCursor.value); void load(nextCursor.value); }
function previous() { cursorStack.value.pop(); void load(cursorStack.value.at(-1) || ''); }
async function openDetail(row: LegalVersion) { detail.value = await getLegalVersion(row.versionId); detailOpen.value = true; }
async function openEditor(row?: LegalVersion) {
  editingId.value = row?.versionId ?? null;
  const current = row ? await getLegalVersion(row.versionId) : null;
  Object.assign(form, {
    documentType: current?.version.documentType ?? 'terms', version: current?.version.version ?? '',
    effectiveAt: current ? dayjs(current.version.effectiveAt).format('YYYY-MM-DDTHH:mm:ss') : '',
    translations: current ? current.translations.map(({ languageCode, title, bodyMarkdown }) => ({ languageCode, title, bodyMarkdown })) : [{ languageCode: 'en', title: '', bodyMarkdown: '' }],
  });
  editorOpen.value = true;
}
function addTranslation() { form.translations.push({ languageCode: '', title: '', bodyMarkdown: '' }); }
async function save() {
  const translations = form.translations.map((item) => ({ languageCode: item.languageCode.trim(), title: item.title.trim(), bodyMarkdown: item.bodyMarkdown.trim() }));
  if (!form.version.trim() || !form.effectiveAt || translations.length === 0 || translations.some((item) => !item.languageCode || !item.title || !item.bodyMarkdown) || new Set(translations.map((item) => item.languageCode)).size !== translations.length) {
    ElMessage.error('请填写版本、生效时间及不重复的完整翻译'); return;
  }
  saving.value = true;
  try {
    const payload = { version: form.version.trim(), effectiveAt: new Date(form.effectiveAt).toISOString(), translations };
    if (editingId.value === null) await createLegalVersion({ ...payload, documentType: form.documentType });
    else await updateLegalVersion(editingId.value, payload);
    editorOpen.value = false; ElMessage.success('法律文档草稿已保存'); await load(cursorStack.value.at(-1) || '');
  } finally { saving.value = false; }
}
async function action(row: LegalVersion, value: 'publish' | 'retire' | 'review') {
  const label = value === 'review' ? '复核翻译' : value === 'publish' ? '发布' : '退役';
  await ElMessageBox.confirm(`确定${label} ${typeText(row.documentType)} ${row.version} 吗？`, '确认文档操作', { type: 'warning' });
  if (value === 'review') await reviewLegalVersion(row.versionId);
  else if (value === 'publish') await publishLegalVersion(row.versionId);
  else await retireLegalVersion(row.versionId);
  ElMessage.success('文档状态已更新'); await load(cursorStack.value.at(-1) || '');
}
onMounted(() => { void load(); });
</script>

<template>
  <div class="p-5"><ElCard shadow="never"><template #header><div class="flex items-center justify-between"><span>法律文档版本</span><ElButton v-if="canWrite" type="primary" @click="openEditor()">创建草稿</ElButton></div></template>
    <div class="mb-4 flex gap-3"><ElSelect v-model="filter.documentType" clearable placeholder="全部文档类型" class="!w-44"><ElOption v-for="[value, label] in types" :key="value" :label="label" :value="value" /></ElSelect><ElSelect v-model="filter.status" clearable placeholder="全部状态" class="!w-36"><ElOption label="草稿" value="draft" /><ElOption label="已发布" value="published" /><ElOption label="已退役" value="retired" /></ElSelect><ElButton @click="search">查询</ElButton></div>
    <ElTable v-loading="loading" :data="rows" row-key="versionId"><ElTableColumn prop="versionId" label="版本 ID" width="100" /><ElTableColumn label="文档类型" min-width="145"><template #default="{ row }">{{ typeText(row.documentType) }}</template></ElTableColumn><ElTableColumn prop="version" label="版本" min-width="125" /><ElTableColumn label="状态" width="95"><template #default="{ row }">{{ statusText(row.status) }}</template></ElTableColumn><ElTableColumn label="翻译语言" min-width="145"><template #default="{ row }">{{ row.translationLanguages.join('、') }}</template></ElTableColumn><ElTableColumn prop="reviewedBy" label="复核管理员" width="115" /><ElTableColumn prop="effectiveAt" label="生效时间" min-width="175"><template #default="{ row }"><AdminTime :value="row.effectiveAt" /></template></ElTableColumn><ElTableColumn label="操作" min-width="240" fixed="right"><template #default="{ row }"><ElButton link type="primary" @click="openDetail(row)">详情</ElButton><ElButton v-if="canWrite && row.status === 'draft'" link type="primary" @click="openEditor(row)">编辑</ElButton><ElButton v-if="canReview && row.status === 'draft'" link type="success" @click="action(row, 'review')">复核</ElButton><ElButton v-if="canPublish && row.status === 'draft' && row.reviewedBy" link type="success" @click="action(row, 'publish')">发布</ElButton><ElButton v-if="canPublish && row.status === 'published'" link type="warning" @click="action(row, 'retire')">退役</ElButton></template></ElTableColumn></ElTable>
    <div class="mt-4 flex justify-end gap-2"><ElButton :disabled="cursorStack.length === 0" @click="previous">上一页</ElButton><ElButton :disabled="!nextCursor" @click="next">下一页</ElButton></div>
  </ElCard>
  <ElDrawer v-model="detailOpen" title="法律文档详情" size="68%" @closed="detail = null"><template v-if="detail"><ElDescriptions :column="2" border><ElDescriptionsItem label="文档类型">{{ typeText(detail.version.documentType) }}</ElDescriptionsItem><ElDescriptionsItem label="版本">{{ detail.version.version }}</ElDescriptionsItem><ElDescriptionsItem label="状态">{{ statusText(detail.version.status) }}</ElDescriptionsItem><ElDescriptionsItem label="生效时间"><AdminTime :value="detail.version.effectiveAt" /></ElDescriptionsItem></ElDescriptions><div v-for="translation in detail.translations" :key="translation.languageCode" class="mt-5"><ElDivider>{{ translation.languageCode }} · {{ translation.title }}</ElDivider><pre class="whitespace-pre-wrap break-all">{{ translation.bodyMarkdown }}</pre></div></template></ElDrawer>
  <ElDrawer v-model="editorOpen" :title="editingId === null ? '创建法律文档草稿' : `编辑草稿 #${editingId}`" size="70%"><ElForm label-width="110px"><ElFormItem label="文档类型"><ElSelect v-model="form.documentType" :disabled="editingId !== null"><ElOption v-for="[value, label] in types" :key="value" :label="label" :value="value" /></ElSelect></ElFormItem><ElFormItem label="版本"><ElInput v-model="form.version" maxlength="64" /></ElFormItem><ElFormItem label="生效时间"><ElDatePicker v-model="form.effectiveAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" /></ElFormItem><ElDivider>翻译内容</ElDivider><div v-for="(translation, index) in form.translations" :key="index" class="mb-5 rounded border p-4"><div class="mb-3 flex justify-between"><strong>翻译 {{ index + 1 }}</strong><ElButton v-if="form.translations.length > 1" link type="danger" @click="form.translations.splice(index, 1)">移除</ElButton></div><ElFormItem label="语言代码"><ElInput v-model="translation.languageCode" class="!w-40" /></ElFormItem><ElFormItem label="标题"><ElInput v-model="translation.title" /></ElFormItem><ElFormItem label="Markdown 正文"><ElInput v-model="translation.bodyMarkdown" type="textarea" :rows="10" /></ElFormItem></div><ElButton @click="addTranslation">添加翻译</ElButton></ElForm><template #footer><ElButton @click="editorOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="save">保存草稿</ElButton></template></ElDrawer></div>
</template>
