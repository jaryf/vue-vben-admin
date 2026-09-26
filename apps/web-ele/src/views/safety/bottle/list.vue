<script setup lang="ts">
import type { BottleContent, BottleDetail, BottleRow } from '#/api/bottles';

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useTimezoneStore } from '@vben/stores';

import {
  ElAlert,
  ElButton,
  ElCard,
  ElDatePicker,
  ElDescriptions,
  ElDescriptionsItem,
  ElDivider,
  ElDrawer,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
  ElTag,
} from 'element-plus';

import {
  getBottle,
  getBottleContent,
  getBottleVoicePreview,
  listBottleMatches,
  listBottles,
  removeBottle,
  restoreBottle,
  retryBottleReview,
} from '#/api/bottles';
import AdminEnumTag from '#/components/admin-enum-tag.vue';
import AdminPage from '#/components/admin-page.vue';
import AdminTime from '#/components/admin-time.vue';
import { adminDateTimeRangeToUtc } from '#/utils/admin-datetime';
import { promptDialog } from '#/utils/message-box';
import { validateReasonCode } from '#/utils/reason-code';

const { hasAccessByCodes } = useAccess();
const timezoneStore = useTimezoneStore();
const canSearchContent = computed(() =>
  hasAccessByCodes(['bottle.content.search_sensitive']),
);
const canReadContent = computed(() =>
  hasAccessByCodes(['bottle.content.read_sensitive']),
);
const canReadMatches = computed(() => hasAccessByCodes(['bottle.match.read']));
const canRemove = computed(() => hasAccessByCodes(['bottle.remove']));
const canRestore = computed(() => hasAccessByCodes(['bottle.restore']));
const canRetry = computed(() => hasAccessByCodes(['bottle.review.retry']));
const filter = reactive({
  bottleId: '',
  categoryId: '',
  contentType: '',
  createdRange: [] as string[],
  keyword: '',
  languageCode: '',
  ownerUserId: '',
  reviewStatus: '',
  sourceType: '',
  status: '',
});
const rows = ref<BottleRow[]>([]);
const nextCursor = ref<null | string>(null);
const cursorStack = ref<string[]>([]);
const searchReason = ref('');
const loading = ref(false);
const detailOpen = ref(false);
const detail = ref<BottleDetail | null>(null);
const content = ref<BottleContent | null>(null);
const matches = ref<Record<string, any>[]>([]);
const matchesLoaded = ref(false);
const matchCursor = ref<null | string>(null);
const matchReason = ref('');
const detailTab = ref('metadata');
const voicePreviewURL = ref('');
const voicePreviewBusy = ref(false);
const voicePlayer = ref<HTMLAudioElement | null>(null);
let voiceExpiryTimer: null | number = null;

async function askReason(title: string): Promise<null | string> {
  const result = await promptDialog(
    '请输入可审计的原因代码，例如 report_investigation',
    title,
    {
      inputValidator: validateReasonCode,
    },
  );
  if (!result) return null;
  const { value } = result;
  return value.trim();
}

const sourceLabels: Record<string, string> = {
  ai_generated: 'AI 生成',
  operator_created: '运营创建',
  user: '用户发布',
};
const bottleStatuses = [
  ['draft', '草稿'],
  ['uploading', '上传中'],
  ['pending_review', '待审核'],
  ['manual_review', '人工审核'],
  ['approved', '已通过'],
  ['distributing', '分发中'],
  ['partially_picked', '部分拾取'],
  ['conversation_created', '已创建会话'],
  ['expired', '已过期'],
  ['archived', '已归档'],
  ['rejected', '已拒绝'],
  ['user_deleted', '用户已删除'],
  ['admin_removed', '管理员下架'],
] as const;
const reviewStatuses = [
  ['not_submitted', '未提交'],
  ['pending', '待审核'],
  ['manual_review', '人工审核'],
  ['approved', '已通过'],
  ['rejected', '已拒绝'],
] as const;
const sourceText = (value: string) => sourceLabels[value] || value;
const statusText = (value: string) =>
  bottleStatuses.find(([code]) => code === value)?.[1] || value;
const reviewStatusText = (value: string) =>
  reviewStatuses.find(([code]) => code === value)?.[1] || value;
const durationText = (value: null | number) =>
  value === null ? '—' : `${(value / 1000).toFixed(1)} 秒`;

async function load(cursor = '') {
  loading.value = true;
  try {
    const createdRange = adminDateTimeRangeToUtc(
      filter.createdRange,
      timezoneStore.timezone,
    );
    const result = await listBottles({
      limit: 20,
      cursor: cursor || undefined,
      bottleId: filter.bottleId.trim() || undefined,
      ownerUserId: filter.ownerUserId.trim() || undefined,
      status: filter.status || undefined,
      reviewStatus: filter.reviewStatus || undefined,
      contentType: filter.contentType || undefined,
      sourceType: filter.sourceType || undefined,
      categoryId: filter.categoryId.trim() || undefined,
      languageCode: filter.languageCode.trim().toLowerCase() || undefined,
      keyword: filter.keyword.trim() || undefined,
      reasonCode: filter.keyword.trim() ? searchReason.value : undefined,
      createdFrom: createdRange?.[0],
      createdUntil: createdRange?.[1],
    });
    rows.value = result.items || [];
    nextCursor.value = result.nextCursor;
  } finally {
    loading.value = false;
  }
}

async function search() {
  if (
    filter.categoryId.trim() &&
    !/^[1-9]\d*$/.test(filter.categoryId.trim())
  ) {
    ElMessage.error('分类 ID 必须为正整数');
    return;
  }
  try {
    adminDateTimeRangeToUtc(filter.createdRange, timezoneStore.timezone);
  } catch (error) {
    ElMessage.error(
      error instanceof Error ? error.message : '创建时间范围无效',
    );
    return;
  }
  if (filter.keyword.trim()) {
    if (!canSearchContent.value) {
      ElMessage.error('没有正文搜索权限');
      return;
    }
    const reason = await askReason('正文敏感搜索');
    if (reason === null) return;
    searchReason.value = reason;
  } else {
    searchReason.value = '';
  }
  cursorStack.value = [];
  await load();
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

async function openDetail(id: number) {
  clearVoicePreview();
  detail.value = null;
  content.value = null;
  matches.value = [];
  matchesLoaded.value = false;
  detailTab.value = 'metadata';
  detailOpen.value = true;
  detail.value = await getBottle(id);
}

async function revealContent() {
  const bottleId = detail.value?.bottle.bottleId;
  if (!bottleId) return;
  const reason = await askReason('查看受控内容');
  if (reason === null) return;
  const result = await getBottleContent(bottleId, reason);
  if (!detailOpen.value || detail.value?.bottle.bottleId !== bottleId) return;
  clearVoicePreview();
  content.value = result;
  detailTab.value = 'content';
}

function clearVoicePreview() {
  if (voiceExpiryTimer !== null) window.clearTimeout(voiceExpiryTimer);
  voiceExpiryTimer = null;
  voicePlayer.value?.pause();
  if (voicePreviewURL.value) URL.revokeObjectURL(voicePreviewURL.value);
  voicePreviewURL.value = '';
}

async function previewVoice() {
  const bottleId = detail.value?.bottle.bottleId;
  if (
    !bottleId ||
    content.value?.contentType !== 'voice' ||
    !content.value.voice?.mediaId ||
    voicePreviewBusy.value
  )
    return;
  const reason = await askReason('播放漂流瓶语音，请填写审计原因');
  if (reason === null) return;
  voicePreviewBusy.value = true;
  try {
    const blob = await getBottleVoicePreview(bottleId, reason);
    if (!detailOpen.value || detail.value?.bottle.bottleId !== bottleId) return;
    if (!(blob instanceof Blob) || !blob.type.startsWith('audio/')) {
      ElMessage.error('服务端未返回可播放的语音');
      return;
    }
    clearVoicePreview();
    voicePreviewURL.value = URL.createObjectURL(blob);
    voiceExpiryTimer = window.setTimeout(
      () => {
        clearVoicePreview();
        ElMessage.info('语音预览已到期，请重新填写原因后查看');
      },
      5 * 60 * 1000,
    );
  } finally {
    voicePreviewBusy.value = false;
  }
}

async function revealMatches() {
  if (!detail.value) return;
  const reason = await askReason('查看匹配记录');
  if (reason === null) return;
  matchReason.value = reason;
  const result = await listBottleMatches(
    detail.value.bottle.bottleId,
    matchReason.value,
  );
  matches.value = result.items || [];
  matchesLoaded.value = true;
  matchCursor.value = result.nextCursor;
  detailTab.value = 'matches';
}

function clearSensitive() {
  clearVoicePreview();
  content.value = null;
  matches.value = [];
  matchesLoaded.value = false;
  matchReason.value = '';
}

async function nextMatches() {
  if (!detail.value || !matchCursor.value) return;
  const result = await listBottleMatches(
    detail.value.bottle.bottleId,
    matchReason.value,
    matchCursor.value,
  );
  matches.value.push(...(result.items || []));
  matchCursor.value = result.nextCursor;
}

async function changeBottle(kind: 'remove' | 'restore' | 'retry') {
  if (!detail.value) return;
  const titles = {
    remove: '下架漂流瓶',
    restore: '恢复漂流瓶',
    retry: '重新发起审核',
  };
  const reason = await askReason(titles[kind]);
  if (reason === null) return;
  const id = detail.value.bottle.bottleId;
  if (kind === 'remove') await removeBottle(id, reason);
  else if (kind === 'restore') await restoreBottle(id, reason);
  else await retryBottleReview(id, reason);
  ElMessage.success('操作已提交并记录审计');
  detail.value = await getBottle(id);
  await load(cursorStack.value.at(-1) || '');
}

onMounted(() => {
  void load();
});
onBeforeUnmount(clearVoicePreview);
</script>

<template>
  <AdminPage
    title="漂流瓶治理"
    description="检索发布内容与审核状态，追踪受控内容和匹配记录。"
  >
    <ElCard shadow="never">
      <div class="admin-filter">
        <ElInput
          v-model="filter.bottleId"
          placeholder="漂流瓶 ID"
          clearable
          class="!w-36"
        />
        <ElInput
          v-model="filter.ownerUserId"
          placeholder="发布者 ID"
          clearable
          class="!w-36"
        />
        <ElSelect
          v-model="filter.status"
          clearable
          placeholder="全部状态"
          class="!w-44"
        >
          <ElOption
            v-for="[value, label] in bottleStatuses"
            :key="value"
            :label="label"
            :value="value"
          />
        </ElSelect>
        <ElSelect
          v-model="filter.reviewStatus"
          clearable
          placeholder="全部审核状态"
          class="!w-40"
        >
          <ElOption
            v-for="[value, label] in reviewStatuses"
            :key="value"
            :label="label"
            :value="value"
          />
        </ElSelect>
        <ElSelect
          v-model="filter.sourceType"
          clearable
          placeholder="全部来源"
          class="!w-36"
        >
          <ElOption label="用户发布" value="user" /><ElOption
            label="AI 生成"
            value="ai_generated"
          /><ElOption label="运营创建" value="operator_created" />
        </ElSelect>
        <ElSelect
          v-model="filter.contentType"
          clearable
          placeholder="全部内容类型"
          class="!w-36"
        >
          <ElOption label="文字" value="text" /><ElOption
            label="语音"
            value="voice"
          />
        </ElSelect>
        <ElInput
          v-model="filter.categoryId"
          placeholder="分类 ID"
          clearable
          class="!w-32"
        />
        <ElInput
          v-model="filter.languageCode"
          placeholder="语言代码"
          maxlength="16"
          clearable
          class="!w-32"
        />
        <ElDatePicker
          v-model="filter.createdRange"
          type="datetimerange"
          value-format="YYYY-MM-DD HH:mm:ss"
          range-separator="至"
          start-placeholder="创建开始"
          end-placeholder="创建结束"
          class="!w-[390px]"
        />
        <ElInput
          v-if="canSearchContent"
          v-model="filter.keyword"
          placeholder="正文关键词（需审计）"
          clearable
          class="!w-56"
          @keyup.enter="search"
        />
        <ElButton @click="search" type="primary">查询</ElButton>
      </div>
      <ElTable
        v-loading="loading"
        :data="rows"
        row-key="bottleId"
        class="w-full"
      >
        <ElTableColumn prop="bottleId" label="漂流瓶 ID" width="110" />
        <ElTableColumn prop="ownerUserId" label="发布者 ID" width="110" />
        <ElTableColumn label="来源" width="105">
          <template #default="{ row }">
            <AdminEnumTag
              :value="row.sourceType"
              :label="sourceText(row.sourceType)"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn prop="categoryId" label="分类 ID" width="90" />
        <ElTableColumn
          prop="textPreview"
          label="内容摘要"
          min-width="200"
          show-overflow-tooltip
        />
        <ElTableColumn label="类型" width="105">
          <template #default="{ row }">
            <AdminEnumTag :value="row.contentType" />
          </template>
        </ElTableColumn>
        <ElTableColumn prop="languageCode" label="语言" width="85" />
        <ElTableColumn label="状态" min-width="130">
          <template #default="{ row }">
            <AdminEnumTag :value="row.status" :label="statusText(row.status)" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="审核状态" min-width="120">
          <template #default="{ row }">
            <AdminEnumTag
              :value="row.reviewStatus"
              :label="reviewStatusText(row.reviewStatus)"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn label="语音时长" width="100">
          <template #default="{ row }">
            {{ durationText(row.voiceDurationMs) }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="拾取/上限" width="105">
          <template #default="{ row }">
            {{ row.pickedCount }} / {{ row.maxPickCount }}
          </template>
        </ElTableColumn>
        <ElTableColumn prop="conversationCount" label="会话数" width="85" />
        <ElTableColumn prop="reportCount" label="举报数" width="85" />
        <ElTableColumn prop="expiresAt" label="过期时间" min-width="170">
          <template #default="{ row }">
            <AdminTime :value="row.expiresAt" />
          </template>
        </ElTableColumn>
        <ElTableColumn prop="createdAt" label="创建时间" min-width="170">
          <template #default="{ row }">
            <AdminTime :value="row.createdAt" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="85" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click="openDetail(row.bottleId)">
              详情
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
      <div class="admin-pagination">
        <ElButton :disabled="cursorStack.length === 0" @click="previous">
          上一页
</ElButton><ElButton :disabled="!nextCursor" @click="next">下一页</ElButton>
      </div>
    </ElCard>

    <ElDrawer
      v-model="detailOpen"
      :title="`漂流瓶 #${detail?.bottle.bottleId || ''}`"
      size="70%"
      @closed="clearSensitive"
    >
      <div v-if="!detail" v-loading="true" class="h-48"></div>
      <template v-else>
        <div class="mb-4 flex flex-wrap gap-2">
          <ElButton v-if="canReadContent" @click="revealContent">
            查看受控内容
          </ElButton>
          <ElButton v-if="canReadMatches" @click="revealMatches">
            查看匹配记录
          </ElButton>
          <ElButton
            v-if="canRemove && detail.bottle.status !== 'admin_removed'"
            type="danger"
            @click="changeBottle('remove')"
          >
            下架
          </ElButton>
          <ElButton
            v-if="canRestore && detail.bottle.status === 'admin_removed'"
            type="success"
            @click="changeBottle('restore')"
          >
            恢复
          </ElButton>
          <ElButton
            v-if="
              canRetry &&
              ['manual_review', 'rejected'].includes(detail.bottle.status)
            "
            @click="changeBottle('retry')"
          >
            重新审核
          </ElButton>
        </div>
        <ElTabs v-model="detailTab">
          <ElTabPane label="元数据" name="metadata">
            <ElDescriptions :column="2" border>
              <ElDescriptionsItem label="发布者">
                {{ detail.bottle.ownerUserId || '匿名' }}
</ElDescriptionsItem><ElDescriptionsItem label="来源">
                <AdminEnumTag
                  :value="detail.bottle.sourceType"
                  :label="sourceText(detail.bottle.sourceType)"
                />
</ElDescriptionsItem><ElDescriptionsItem label="状态">
                <AdminEnumTag
                  :value="detail.bottle.status"
                  :label="statusText(detail.bottle.status)"
                />
</ElDescriptionsItem><ElDescriptionsItem label="审核">
                <AdminEnumTag
                  :value="detail.bottle.reviewStatus"
                  :label="reviewStatusText(detail.bottle.reviewStatus)"
                />
</ElDescriptionsItem><ElDescriptionsItem label="分类 ID">
                {{ detail.bottle.categoryId }}
</ElDescriptionsItem><ElDescriptionsItem label="语言">
                {{ detail.bottle.languageCode }}
</ElDescriptionsItem><ElDescriptionsItem label="语音时长">
                {{
                  durationText(detail.bottle.voiceDurationMs)
                }}
</ElDescriptionsItem><ElDescriptionsItem label="已获取/上限">
                {{ detail.bottle.pickedCount }} /
                {{ detail.bottle.maxPickCount }}
</ElDescriptionsItem><ElDescriptionsItem label="会话 / 举报">
                {{ detail.bottle.conversationCount }} /
                {{ detail.bottle.reportCount }}
</ElDescriptionsItem><ElDescriptionsItem label="过期时间">
                <AdminTime :value="detail.bottle.expiresAt" />
              </ElDescriptionsItem>
            </ElDescriptions>
            <ElDivider>状态记录</ElDivider><ElTable :data="detail.statusLogs">
              <ElTableColumn prop="fromStatus" label="原状态">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.fromStatus" />
                </template>
</ElTableColumn><ElTableColumn prop="toStatus" label="新状态">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.toStatus" />
                </template>
</ElTableColumn><ElTableColumn prop="reasonCode" label="原因" /><ElTableColumn
                prop="createdAt"
                label="时间"
              >
                <template #default="{ row }">
                  <AdminTime :value="row.createdAt" />
                </template>
              </ElTableColumn>
            </ElTable>
          </ElTabPane>
          <ElTabPane v-if="content" label="受控内容" name="content">
            <ElAlert
              title="敏感内容已记录查看原因与审计，离开详情后不再保留在页面。"
              type="warning"
              show-icon
              :closable="false"
              class="mb-4"
            />
            <ElAlert
              class="mb-4"
              :type="content.contentSource === 'history' ? 'warning' : 'info'"
              show-icon
              :closable="false"
              :title="
                content.contentSource === 'history'
                  ? '内容来自历史快照，不是当前活动表记录。'
                  : '内容来自当前活动表记录。'
              "
            />
            <p v-if="content.archivedAt" class="mb-4 text-sm text-gray-500">
              归档时间：<AdminTime :value="content.archivedAt" />
            </p>
            <div
              v-if="content.contentType === 'text'"
              class="whitespace-pre-wrap rounded border p-4"
            >
              {{ content.text || '—' }}
            </div>
            <template v-else>
              <ElDescriptions :column="1" border>
                <ElDescriptionsItem label="语音媒体 ID">
                  {{ content.voice?.mediaId || '—' }}
                </ElDescriptionsItem>
                <ElDescriptionsItem label="时长（毫秒）">
                  {{ content.voice?.durationMs ?? '—' }}
                </ElDescriptionsItem>
                <ElDescriptionsItem label="转写">
                  <ElTag type="info">能力未接通</ElTag><span class="ml-2">当前无语音转写文本</span>
                </ElDescriptionsItem>
              </ElDescriptions>
              <ElButton
                v-if="content.voice?.mediaId"
                class="mt-4"
                type="primary"
                :loading="voicePreviewBusy"
                @click="previewVoice"
              >
                填写原因并播放
              </ElButton>
              <audio
                v-if="voicePreviewURL"
                ref="voicePlayer"
                class="mt-4 w-full"
                :src="voicePreviewURL"
                controls
                controlslist="nodownload noplaybackrate"
                preload="none"
                @contextmenu.prevent
              ></audio>
            </template>
          </ElTabPane>
          <ElTabPane v-if="matchesLoaded" label="匹配记录" name="matches">
            <ElTable :data="matches">
              <ElTableColumn prop="matchLogId" label="记录 ID" /><ElTableColumn
                prop="userId"
                label="用户 ID"
              /><ElTableColumn prop="result" label="结果" /><ElTableColumn
                prop="ruleVersion"
                label="规则版本"
              /><ElTableColumn prop="createdAt" label="时间">
                <template #default="{ row }">
                  <AdminTime :value="row.createdAt" />
                </template>
              </ElTableColumn>
            </ElTable>
            <div class="admin-pagination">
              <ElButton v-if="matchCursor" @click="nextMatches">
                加载更多
              </ElButton>
            </div>
          </ElTabPane>
        </ElTabs>
      </template>
    </ElDrawer>
  </AdminPage>
</template>
