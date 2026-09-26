<script setup lang="ts">
import type { WebsiteContentVersion } from '#/api/website-content';

import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';

import {
  ElAlert,
  ElButton,
  ElCard,
  ElDescriptions,
  ElDescriptionsItem,
  ElDivider,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
  ElTable,
  ElTableColumn,
} from 'element-plus';

import {
  createWebsiteContent,
  getWebsiteContent,
  listWebsiteContent,
  publishWebsiteContent,
  retireWebsiteContent,
  reviewWebsiteContent,
  updateWebsiteContent,
} from '#/api/website-content';
import AdminEnumTag from '#/components/admin-enum-tag.vue';
import AdminPage from '#/components/admin-page.vue';
import AdminTime from '#/components/admin-time.vue';
import SafeMarkdownPreview from '#/components/safe-markdown-preview.vue';
import { confirmDialog } from '#/utils/message-box';

const { hasAccessByCodes } = useAccess();
const canWrite = computed(() => hasAccessByCodes(['website_content.write']));
const canReview = computed(() => hasAccessByCodes(['website_content.review']));
const canPublish = computed(() =>
  hasAccessByCodes(['website_content.publish']),
);
const rows = ref<WebsiteContentVersion[]>([]);
const nextCursor = ref<null | string>(null);
const cursorStack = ref<string[]>([]);
const loading = ref(false);
const saving = ref(false);
const detailOpen = ref(false);
const detail = ref<null | WebsiteContentVersion>(null);
const editorOpen = ref(false);
const editingId = ref<null | number>(null);
const createKey = ref('');
const filter = reactive({
  contentType: '',
  slug: '',
  languageCode: '',
  version: '',
  status: '',
});
const form = reactive({
  contentType: 'page',
  slug: '',
  languageCode: 'en',
  version: '',
  title: '',
  bodyMarkdown: '',
});
const typeText = (value: string) => {
  if (value === 'page') return '官网页面';
  return value === 'help_article' ? '帮助文章' : value;
};
const statusText = (value: string) =>
  ({ draft: '草稿', published: '已发布', retired: '已退役' })[
    value as 'draft' | 'published' | 'retired'
  ] || value;
async function load(cursor = '') {
  loading.value = true;
  try {
    const result = await listWebsiteContent({
      contentType: filter.contentType || undefined,
      slug: filter.slug.trim() || undefined,
      languageCode: filter.languageCode.trim() || undefined,
      version: filter.version.trim() || undefined,
      status: filter.status || undefined,
      cursor: cursor || undefined,
      limit: 20,
    });
    rows.value = result.items || [];
    nextCursor.value = result.nextCursor;
  } finally {
    loading.value = false;
  }
}
function search() {
  if (
    filter.slug.trim() &&
    !/^[a-z0-9][a-z0-9-]{0,79}$/.test(filter.slug.trim())
  ) {
    ElMessage.warning('路径标识只能包含小写字母、数字和连字符');
    return;
  }
  if (
    filter.languageCode.trim() &&
    !/^[a-zA-Z]{2,3}(-[a-zA-Z]{2})?$/.test(filter.languageCode.trim())
  ) {
    ElMessage.warning('请输入有效的语言代码');
    return;
  }
  if (
    filter.version.trim() &&
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(filter.version.trim())
  ) {
    ElMessage.warning('请输入有效的版本号');
    return;
  }
  cursorStack.value = [];
  void load();
}
function next() {
  if (!nextCursor.value) return;
  cursorStack.value.push(nextCursor.value);
  void load(nextCursor.value);
}
function previous() {
  cursorStack.value.pop();
  void load(cursorStack.value.at(-1) || '');
}
async function openDetail(row: WebsiteContentVersion) {
  detail.value = await getWebsiteContent(row.versionId);
  detailOpen.value = true;
}
async function openEditor(row?: WebsiteContentVersion) {
  editingId.value = row?.versionId ?? null;
  createKey.value = crypto.randomUUID();
  const current = row ? await getWebsiteContent(row.versionId) : null;
  Object.assign(form, {
    contentType: current?.contentType ?? 'page',
    slug: current?.slug ?? '',
    languageCode: current?.languageCode ?? 'en',
    version: current?.version ?? '',
    title: current?.title ?? '',
    bodyMarkdown: current?.bodyMarkdown ?? '',
  });
  editorOpen.value = true;
}
async function save() {
  if (
    !/^[a-z0-9][a-z0-9-]{0,79}$/.test(form.slug) ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(form.version) ||
    !form.languageCode.trim() ||
    !form.title.trim() ||
    !form.bodyMarkdown.trim()
  ) {
    ElMessage.error('请填写有效路径、版本、语言、标题和正文');
    return;
  }
  saving.value = true;
  try {
    const body = {
      version: form.version.trim(),
      title: form.title.trim(),
      bodyMarkdown: form.bodyMarkdown.trim(),
    };
    await (editingId.value === null
      ? createWebsiteContent(
          {
            ...body,
            contentType: form.contentType,
            slug: form.slug,
            languageCode: form.languageCode.trim(),
          },
          createKey.value,
        )
      : updateWebsiteContent(editingId.value, body));
    editorOpen.value = false;
    ElMessage.success('内容草稿已保存');
    await load(cursorStack.value.at(-1) || '');
  } finally {
    saving.value = false;
  }
}
async function action(
  row: WebsiteContentVersion,
  value: 'publish' | 'retire' | 'review',
) {
  const label = { review: '复核', publish: '发布', retire: '退役' }[value];
  if (
    !(await confirmDialog(
      `确定${label} ${row.slug} / ${row.languageCode} / ${row.version} 吗？`,
      '确认内容操作',
      { type: 'warning' },
    ))
  )
    return;
  if (value === 'review') await reviewWebsiteContent(row.versionId);
  else if (value === 'publish') await publishWebsiteContent(row.versionId);
  else await retireWebsiteContent(row.versionId);
  ElMessage.success('内容状态已更新');
  await load(cursorStack.value.at(-1) || '');
}
onMounted(() => {
  void load();
});
</script>

<template>
  <AdminPage
    title="官网内容与帮助文章"
    description="集中维护官网内容、多语言帮助与发布版本。"
  >
    <template #actions>
      <ElButton v-if="canWrite" type="primary" @click="openEditor()">
        创建草稿
      </ElButton>
</template><ElCard shadow="never">
      <ElAlert
        title="本轮提供内容后台和已发布内容公共 API；官网前端尚未接入。只有已复核并发布的版本会出现在公共 API。"
        type="info"
        show-icon
        :closable="false"
        class="mb-4"
      />
      <div class="admin-filter">
        <ElSelect
          v-model="filter.contentType"
          clearable
          placeholder="全部内容类型"
          class="!w-40"
        >
          <ElOption label="官网页面" value="page" /><ElOption
            label="帮助文章"
            value="help_article"
          />
</ElSelect><ElInput
          v-model="filter.slug"
          placeholder="路径标识"
          clearable
          class="!w-40"
        /><ElInput
          v-model="filter.languageCode"
          placeholder="语言代码"
          clearable
          class="!w-32"
        /><ElInput
          v-model="filter.version"
          placeholder="版本号"
          clearable
          class="!w-36"
        /><ElSelect
          v-model="filter.status"
          clearable
          placeholder="全部状态"
          class="!w-32"
        >
          <ElOption label="草稿" value="draft" /><ElOption
            label="已发布"
            value="published"
          /><ElOption label="已退役" value="retired" />
</ElSelect><ElButton type="primary" @click="search">查询</ElButton>
      </div>
      <ElTable v-loading="loading" :data="rows" row-key="versionId">
        <ElTableColumn
          prop="versionId"
          label="版本 ID"
          width="100"
        /><!-- @vue-generic {WebsiteContentVersion} --><ElTableColumn
          label="类型"
          width="105"
        >
          <template #default="{ row }">
            <AdminEnumTag
              :value="row.contentType"
              :label="typeText(row.contentType)"
            />
          </template>
</ElTableColumn><ElTableColumn
          prop="slug"
          label="路径标识"
          min-width="145"
        /><ElTableColumn
          prop="languageCode"
          label="语言"
          width="85"
        /><ElTableColumn
          prop="version"
          label="版本"
          width="110"
        /><ElTableColumn
          prop="title"
          label="标题"
          min-width="185"
        /><!-- @vue-generic {WebsiteContentVersion} --><ElTableColumn
          label="状态"
          width="120"
        >
          <template #default="{ row }">
            <AdminEnumTag :value="row.status" :label="statusText(row.status)" />
          </template>
</ElTableColumn><ElTableColumn
          prop="reviewedBy"
          label="复核人"
          width="90"
        /><!-- @vue-generic {WebsiteContentVersion} --><ElTableColumn
          prop="updatedAt"
          label="更新时间"
          min-width="175"
        >
          <template #default="{ row }">
            <AdminTime :value="row.updatedAt" />
          </template>
</ElTableColumn><!-- @vue-generic {WebsiteContentVersion} --><ElTableColumn
          label="操作"
          min-width="235"
          fixed="right"
        >
          <template #default="{ row }">
            <ElButton link type="primary" @click="openDetail(row)">
              详情
</ElButton><ElButton
              v-if="canWrite && row.status === 'draft'"
              link
              type="primary"
              @click="openEditor(row)"
            >
              编辑
</ElButton><ElButton
              v-if="canReview && row.status === 'draft'"
              link
              type="success"
              @click="action(row, 'review')"
            >
              复核
</ElButton><ElButton
              v-if="canPublish && row.status === 'draft' && row.reviewedBy"
              link
              type="success"
              @click="action(row, 'publish')"
            >
              发布
</ElButton><ElButton
              v-if="canPublish && row.status === 'published'"
              link
              type="warning"
              @click="action(row, 'retire')"
            >
              退役
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
      <div class="admin-pagination">
        <ElButton :disabled="cursorStack.length === 0" @click="previous">
          上一页
</ElButton><ElButton :disabled="!nextCursor" @click="next">下一页</ElButton>
      </div>
</ElCard><ElDrawer
      v-model="detailOpen"
      title="内容版本详情"
      size="65%"
      @closed="detail = null"
    >
      <ElDescriptions v-if="detail" :column="2" border>
        <ElDescriptionsItem label="路径">{{ detail.slug }}</ElDescriptionsItem><ElDescriptionsItem label="语言">
          {{ detail.languageCode }}
</ElDescriptionsItem><ElDescriptionsItem label="类型">
          <AdminEnumTag
            :value="detail.contentType"
            :label="typeText(detail.contentType)"
          />
</ElDescriptionsItem><ElDescriptionsItem label="版本">
          {{ detail.version }}
</ElDescriptionsItem><ElDescriptionsItem label="标题">{{ detail.title }}</ElDescriptionsItem><ElDescriptionsItem label="状态">
          <AdminEnumTag
            :value="detail.status"
            :label="statusText(detail.status)"
          />
        </ElDescriptionsItem>
</ElDescriptions><ElDivider>Markdown 安全预览</ElDivider><ElAlert
        v-if="detail"
        class="mb-4"
        title="原始 HTML 已禁用，HTML 标签只会作为文本显示。"
        type="info"
        show-icon
        :closable="false"
      /><SafeMarkdownPreview v-if="detail" :source="detail.bodyMarkdown" />
    </ElDrawer>
    <ElDrawer
      v-model="editorOpen"
      :title="editingId === null ? '创建内容草稿' : `编辑草稿 #${editingId}`"
      size="65%"
    >
      <ElForm label-width="100px">
        <ElFormItem label="内容类型">
          <ElSelect v-model="form.contentType" :disabled="editingId !== null">
            <ElOption label="官网页面" value="page" /><ElOption
              label="帮助文章"
              value="help_article"
            />
          </ElSelect>
</ElFormItem><ElFormItem label="路径标识">
          <ElInput
            v-model="form.slug"
            :disabled="editingId !== null"
            placeholder="小写字母、数字和连字符"
          />
</ElFormItem><ElFormItem label="语言代码">
          <ElInput
            v-model="form.languageCode"
            :disabled="editingId !== null"
          />
</ElFormItem><ElFormItem label="版本"><ElInput v-model="form.version" /></ElFormItem><ElFormItem label="标题"><ElInput v-model="form.title" /></ElFormItem><ElFormItem label="Markdown">
          <ElInput
            v-model="form.bodyMarkdown"
            type="textarea"
            :rows="18"
          />
</ElFormItem><ElDivider>安全预览</ElDivider><SafeMarkdownPreview :source="form.bodyMarkdown" />
</ElForm><template #footer>
        <ElButton @click="editorOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="save">
          保存草稿
        </ElButton>
      </template>
    </ElDrawer>
  </AdminPage>
</template>
