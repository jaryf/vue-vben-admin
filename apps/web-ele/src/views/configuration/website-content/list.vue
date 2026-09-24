<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  createWebsiteContent, getWebsiteContent, listWebsiteContent,
  publishWebsiteContent, retireWebsiteContent, reviewWebsiteContent, updateWebsiteContent,
} from '#/api/website-content';
import type { WebsiteContentVersion } from '#/api/website-content';

const { hasAccessByCodes } = useAccess();
const canWrite = computed(() => hasAccessByCodes(['website_content.write']));
const canReview = computed(() => hasAccessByCodes(['website_content.review']));
const canPublish = computed(() => hasAccessByCodes(['website_content.publish']));
const rows = ref<WebsiteContentVersion[]>([]);
const nextCursor = ref<string | null>(null);
const cursorStack = ref<string[]>([]);
const loading = ref(false);
const saving = ref(false);
const detailOpen = ref(false);
const detail = ref<WebsiteContentVersion | null>(null);
const editorOpen = ref(false);
const editingId = ref<number | null>(null);
const createKey = ref('');
const filter = reactive({ contentType: '', slug: '', status: '' });
const form = reactive({ contentType: 'page', slug: '', languageCode: 'en', version: '', title: '', bodyMarkdown: '' });
const typeText = (value: string) => value === 'page' ? '官网页面' : value === 'help_article' ? '帮助文章' : value;
const statusText = (value: string) => ({ draft: '草稿', published: '已发布', retired: '已退役' })[value as 'draft' | 'published' | 'retired'] || value;
async function load(cursor = '') {
  loading.value = true;
  try {
    const result = await listWebsiteContent({ contentType: filter.contentType || undefined, slug: filter.slug.trim() || undefined, status: filter.status || undefined, cursor: cursor || undefined, limit: 20 });
    rows.value = result.items || []; nextCursor.value = result.nextCursor;
  } finally { loading.value = false; }
}
function search() { cursorStack.value = []; void load(); }
function next() { if (!nextCursor.value) return; cursorStack.value.push(nextCursor.value); void load(nextCursor.value); }
function previous() { cursorStack.value.pop(); void load(cursorStack.value.at(-1) || ''); }
async function openDetail(row: WebsiteContentVersion) { detail.value = await getWebsiteContent(row.versionId); detailOpen.value = true; }
async function openEditor(row?: WebsiteContentVersion) {
  editingId.value = row?.versionId ?? null;
  createKey.value = crypto.randomUUID();
  const current = row ? await getWebsiteContent(row.versionId) : null;
  Object.assign(form, {
    contentType: current?.contentType ?? 'page', slug: current?.slug ?? '',
    languageCode: current?.languageCode ?? 'en', version: current?.version ?? '',
    title: current?.title ?? '', bodyMarkdown: current?.bodyMarkdown ?? '',
  });
  editorOpen.value = true;
}
async function save() {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(form.slug) || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(form.version) || !form.languageCode.trim() || !form.title.trim() || !form.bodyMarkdown.trim()) {
    ElMessage.error('请填写有效路径、版本、语言、标题和正文'); return;
  }
  saving.value = true;
  try {
    const body = { version: form.version.trim(), title: form.title.trim(), bodyMarkdown: form.bodyMarkdown.trim() };
    if (editingId.value === null) await createWebsiteContent({ ...body, contentType: form.contentType, slug: form.slug, languageCode: form.languageCode.trim() }, createKey.value);
    else await updateWebsiteContent(editingId.value, body);
    editorOpen.value = false; ElMessage.success('内容草稿已保存'); await load(cursorStack.value.at(-1) || '');
  } finally { saving.value = false; }
}
async function action(row: WebsiteContentVersion, value: 'publish' | 'retire' | 'review') {
  const label = value === 'review' ? '复核' : value === 'publish' ? '发布' : '退役';
  await ElMessageBox.confirm(`确定${label} ${row.slug} / ${row.languageCode} / ${row.version} 吗？`, '确认内容操作', { type: 'warning' });
  if (value === 'review') await reviewWebsiteContent(row.versionId);
  else if (value === 'publish') await publishWebsiteContent(row.versionId);
  else await retireWebsiteContent(row.versionId);
  ElMessage.success('内容状态已更新'); await load(cursorStack.value.at(-1) || '');
}
onMounted(() => { void load(); });
</script>

<template>
  <div class="p-5"><ElCard shadow="never"><template #header><div class="flex items-center justify-between"><span>官网内容与帮助文章</span><ElButton v-if="canWrite" type="primary" @click="openEditor()">创建草稿</ElButton></div></template>
    <ElAlert title="本轮提供内容后台和已发布内容公共 API；官网前端尚未接入。只有已复核并发布的版本会出现在公共 API。" type="info" show-icon :closable="false" class="mb-4" />
    <div class="mb-4 flex flex-wrap gap-3"><ElSelect v-model="filter.contentType" clearable placeholder="全部内容类型" class="!w-40"><ElOption label="官网页面" value="page" /><ElOption label="帮助文章" value="help_article" /></ElSelect><ElInput v-model="filter.slug" placeholder="路径标识" clearable class="!w-40" /><ElSelect v-model="filter.status" clearable placeholder="全部状态" class="!w-32"><ElOption label="草稿" value="draft" /><ElOption label="已发布" value="published" /><ElOption label="已退役" value="retired" /></ElSelect><ElButton @click="search">查询</ElButton></div>
    <ElTable v-loading="loading" :data="rows" row-key="versionId"><ElTableColumn prop="versionId" label="版本 ID" width="100" /><ElTableColumn label="类型" width="105"><template #default="{ row }">{{ typeText(row.contentType) }}</template></ElTableColumn><ElTableColumn prop="slug" label="路径标识" min-width="145" /><ElTableColumn prop="languageCode" label="语言" width="85" /><ElTableColumn prop="version" label="版本" width="110" /><ElTableColumn prop="title" label="标题" min-width="185" /><ElTableColumn label="状态" width="90"><template #default="{ row }">{{ statusText(row.status) }}</template></ElTableColumn><ElTableColumn prop="reviewedBy" label="复核人" width="90" /><ElTableColumn prop="updatedAt" label="更新时间" min-width="175" /><ElTableColumn label="操作" min-width="235" fixed="right"><template #default="{ row }"><ElButton link type="primary" @click="openDetail(row)">详情</ElButton><ElButton v-if="canWrite && row.status === 'draft'" link type="primary" @click="openEditor(row)">编辑</ElButton><ElButton v-if="canReview && row.status === 'draft'" link type="success" @click="action(row, 'review')">复核</ElButton><ElButton v-if="canPublish && row.status === 'draft' && row.reviewedBy" link type="success" @click="action(row, 'publish')">发布</ElButton><ElButton v-if="canPublish && row.status === 'published'" link type="warning" @click="action(row, 'retire')">退役</ElButton></template></ElTableColumn></ElTable><div class="mt-4 flex justify-end gap-2"><ElButton :disabled="cursorStack.length === 0" @click="previous">上一页</ElButton><ElButton :disabled="!nextCursor" @click="next">下一页</ElButton></div>
  </ElCard><ElDrawer v-model="detailOpen" title="内容版本详情" size="65%" @closed="detail = null"><ElDescriptions v-if="detail" :column="2" border><ElDescriptionsItem label="路径">{{ detail.slug }}</ElDescriptionsItem><ElDescriptionsItem label="语言">{{ detail.languageCode }}</ElDescriptionsItem><ElDescriptionsItem label="类型">{{ typeText(detail.contentType) }}</ElDescriptionsItem><ElDescriptionsItem label="版本">{{ detail.version }}</ElDescriptionsItem><ElDescriptionsItem label="标题">{{ detail.title }}</ElDescriptionsItem><ElDescriptionsItem label="状态">{{ statusText(detail.status) }}</ElDescriptionsItem></ElDescriptions><ElDivider>Markdown 正文</ElDivider><pre v-if="detail" class="whitespace-pre-wrap break-all">{{ detail.bodyMarkdown }}</pre></ElDrawer>
  <ElDrawer v-model="editorOpen" :title="editingId === null ? '创建内容草稿' : `编辑草稿 #${editingId}`" size="65%"><ElForm label-width="100px"><ElFormItem label="内容类型"><ElSelect v-model="form.contentType" :disabled="editingId !== null"><ElOption label="官网页面" value="page" /><ElOption label="帮助文章" value="help_article" /></ElSelect></ElFormItem><ElFormItem label="路径标识"><ElInput v-model="form.slug" :disabled="editingId !== null" placeholder="小写字母、数字和连字符" /></ElFormItem><ElFormItem label="语言代码"><ElInput v-model="form.languageCode" :disabled="editingId !== null" /></ElFormItem><ElFormItem label="版本"><ElInput v-model="form.version" /></ElFormItem><ElFormItem label="标题"><ElInput v-model="form.title" /></ElFormItem><ElFormItem label="Markdown"><ElInput v-model="form.bodyMarkdown" type="textarea" :rows="18" /></ElFormItem></ElForm><template #footer><ElButton @click="editorOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="save">保存草稿</ElButton></template></ElDrawer></div>
</template>
