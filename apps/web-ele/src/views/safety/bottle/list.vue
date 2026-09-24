<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  getBottle, getBottleContent, listBottleMatches, listBottles,
  removeBottle, restoreBottle, retryBottleReview,
} from '#/api/bottles';
import type { BottleContent, BottleDetail, BottleRow } from '#/api/bottles';

const { hasAccessByCodes } = useAccess();
const canSearchContent = computed(() => hasAccessByCodes(['bottle.content.search_sensitive']));
const canReadContent = computed(() => hasAccessByCodes(['bottle.content.read_sensitive']));
const canReadMatches = computed(() => hasAccessByCodes(['bottle.match.read']));
const canRemove = computed(() => hasAccessByCodes(['bottle.remove']));
const canRestore = computed(() => hasAccessByCodes(['bottle.restore']));
const canRetry = computed(() => hasAccessByCodes(['bottle.review.retry']));
const filter = reactive({ bottleId: '', ownerUserId: '', status: '', reviewStatus: '', contentType: '', keyword: '' });
const rows = ref<BottleRow[]>([]);
const nextCursor = ref<string | null>(null);
const cursorStack = ref<string[]>([]);
const searchReason = ref('');
const loading = ref(false);
const detailOpen = ref(false);
const detail = ref<BottleDetail | null>(null);
const content = ref<BottleContent | null>(null);
const matches = ref<Record<string, any>[]>([]);
const matchesLoaded = ref(false);
const matchCursor = ref<string | null>(null);
const matchReason = ref('');
const detailTab = ref('metadata');

const reasonPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
async function askReason(title: string): Promise<string> {
  const { value } = await ElMessageBox.prompt('请输入可审计的原因代码，例如 report_investigation', title, {
    inputPattern: reasonPattern, inputErrorMessage: '原因代码只能包含字母、数字、点、下划线和横线',
  });
  return value.trim();
}

async function load(cursor = '') {
  loading.value = true;
  try {
    const result = await listBottles({
      limit: 20, cursor: cursor || undefined,
      bottleId: filter.bottleId.trim() || undefined,
      ownerUserId: filter.ownerUserId.trim() || undefined,
      status: filter.status || undefined,
      reviewStatus: filter.reviewStatus || undefined,
      contentType: filter.contentType || undefined,
      keyword: filter.keyword.trim() || undefined,
      reasonCode: filter.keyword.trim() ? searchReason.value : undefined,
    });
    rows.value = result.items || [];
    nextCursor.value = result.nextCursor;
  } finally { loading.value = false; }
}

async function search() {
  if (filter.keyword.trim()) {
    if (!canSearchContent.value) { ElMessage.error('没有正文搜索权限'); return; }
    searchReason.value = await askReason('正文敏感搜索');
  } else { searchReason.value = ''; }
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
  detail.value = null; content.value = null; matches.value = []; matchesLoaded.value = false;
  detailTab.value = 'metadata'; detailOpen.value = true;
  detail.value = await getBottle(id);
}

async function revealContent() {
  if (!detail.value) return;
  const reason = await askReason('查看受控内容');
  content.value = await getBottleContent(detail.value.bottle.bottleId, reason);
  detailTab.value = 'content';
}

async function revealMatches() {
  if (!detail.value) return;
  matchReason.value = await askReason('查看匹配记录');
  const result = await listBottleMatches(detail.value.bottle.bottleId, matchReason.value);
  matches.value = result.items || [];
  matchesLoaded.value = true;
  matchCursor.value = result.nextCursor;
  detailTab.value = 'matches';
}

function clearSensitive() {
  content.value = null;
  matches.value = [];
  matchesLoaded.value = false;
  matchReason.value = '';
}

async function nextMatches() {
  if (!detail.value || !matchCursor.value) return;
  const result = await listBottleMatches(detail.value.bottle.bottleId, matchReason.value, matchCursor.value);
  matches.value.push(...(result.items || []));
  matchCursor.value = result.nextCursor;
}

async function changeBottle(kind: 'remove' | 'restore' | 'retry') {
  if (!detail.value) return;
  const reason = await askReason(kind === 'remove' ? '下架漂流瓶' : kind === 'restore' ? '恢复漂流瓶' : '重新发起审核');
  const id = detail.value.bottle.bottleId;
  if (kind === 'remove') await removeBottle(id, reason);
  else if (kind === 'restore') await restoreBottle(id, reason);
  else await retryBottleReview(id, reason);
  ElMessage.success('操作已提交并记录审计');
  detail.value = await getBottle(id);
  await load(cursorStack.value.at(-1) || '');
}

onMounted(() => { void load(); });
</script>

<template>
  <div class="p-5">
    <ElCard shadow="never">
      <template #header>漂流瓶治理</template>
      <div class="mb-4 flex flex-wrap gap-3">
        <ElInput v-model="filter.bottleId" placeholder="漂流瓶 ID" clearable class="!w-36" />
        <ElInput v-model="filter.ownerUserId" placeholder="发布者 ID" clearable class="!w-36" />
        <ElSelect v-model="filter.status" clearable placeholder="全部状态" class="!w-44"><ElOption label="待审核" value="pending_review" /><ElOption label="人工审核" value="manual_review" /><ElOption label="已通过" value="approved" /><ElOption label="分发中" value="distributing" /><ElOption label="管理员下架" value="admin_removed" /><ElOption label="已拒绝" value="rejected" /></ElSelect>
        <ElSelect v-model="filter.contentType" clearable placeholder="全部内容类型" class="!w-36"><ElOption label="文字" value="text" /><ElOption label="语音" value="voice" /></ElSelect>
        <ElInput v-if="canSearchContent" v-model="filter.keyword" placeholder="正文关键词（需审计）" clearable class="!w-56" @keyup.enter="search" />
        <ElButton @click="search">查询</ElButton>
      </div>
      <ElTable v-loading="loading" :data="rows" row-key="bottleId" class="w-full">
        <ElTableColumn prop="bottleId" label="漂流瓶 ID" width="110" />
        <ElTableColumn prop="ownerUserId" label="发布者 ID" width="110" />
        <ElTableColumn prop="textPreview" label="内容摘要" min-width="200" show-overflow-tooltip />
        <ElTableColumn label="类型" width="80"><template #default="{ row }">{{ row.contentType === 'text' ? '文字' : '语音' }}</template></ElTableColumn>
        <ElTableColumn prop="languageCode" label="语言" width="85" />
        <ElTableColumn prop="status" label="状态" min-width="130" />
        <ElTableColumn prop="reviewStatus" label="审核状态" min-width="110" />
        <ElTableColumn prop="reportCount" label="举报数" width="85" />
        <ElTableColumn prop="createdAt" label="创建时间" min-width="170" />
        <ElTableColumn label="操作" width="85" fixed="right"><template #default="{ row }"><ElButton link type="primary" @click="openDetail(row.bottleId)">详情</ElButton></template></ElTableColumn>
      </ElTable>
      <div class="mt-4 flex justify-end gap-2"><ElButton :disabled="cursorStack.length === 0" @click="previous">上一页</ElButton><ElButton :disabled="!nextCursor" @click="next">下一页</ElButton></div>
    </ElCard>

    <ElDrawer v-model="detailOpen" :title="`漂流瓶 #${detail?.bottle.bottleId || ''}`" size="70%" @closed="clearSensitive">
      <div v-if="!detail" v-loading="true" class="h-48" />
      <template v-else>
        <div class="mb-4 flex flex-wrap gap-2">
          <ElButton v-if="canReadContent" @click="revealContent">查看受控内容</ElButton>
          <ElButton v-if="canReadMatches" @click="revealMatches">查看匹配记录</ElButton>
          <ElButton v-if="canRemove && detail.bottle.status !== 'admin_removed'" type="danger" @click="changeBottle('remove')">下架</ElButton>
          <ElButton v-if="canRestore && detail.bottle.status === 'admin_removed'" type="success" @click="changeBottle('restore')">恢复</ElButton>
          <ElButton v-if="canRetry && ['manual_review', 'rejected'].includes(detail.bottle.status)" @click="changeBottle('retry')">重新审核</ElButton>
        </div>
        <ElTabs v-model="detailTab">
          <ElTabPane label="元数据" name="metadata">
            <ElDescriptions :column="2" border><ElDescriptionsItem label="发布者">{{ detail.bottle.ownerUserId || '匿名' }}</ElDescriptionsItem><ElDescriptionsItem label="来源">{{ detail.bottle.sourceType }}</ElDescriptionsItem><ElDescriptionsItem label="状态">{{ detail.bottle.status }}</ElDescriptionsItem><ElDescriptionsItem label="审核">{{ detail.bottle.reviewStatus }}</ElDescriptionsItem><ElDescriptionsItem label="分类 ID">{{ detail.bottle.categoryId }}</ElDescriptionsItem><ElDescriptionsItem label="已获取/上限">{{ detail.bottle.pickedCount }} / {{ detail.bottle.maxPickCount }}</ElDescriptionsItem></ElDescriptions>
            <ElDivider>状态记录</ElDivider><ElTable :data="detail.statusLogs"><ElTableColumn prop="fromStatus" label="原状态" /><ElTableColumn prop="toStatus" label="新状态" /><ElTableColumn prop="reasonCode" label="原因" /><ElTableColumn prop="createdAt" label="时间" /></ElTable>
          </ElTabPane>
          <ElTabPane v-if="content" label="受控内容" name="content"><ElAlert title="敏感内容已记录查看原因与审计，离开详情后不再保留在页面。" type="warning" show-icon :closable="false" class="mb-4" /><div v-if="content.text" class="whitespace-pre-wrap rounded border p-4">{{ content.text }}</div><ElDescriptions v-else :column="1" border><ElDescriptionsItem label="语音媒体 ID">{{ content.voice?.mediaId }}</ElDescriptionsItem><ElDescriptionsItem label="时长（毫秒）">{{ content.voice?.durationMs }}</ElDescriptionsItem></ElDescriptions></ElTabPane>
          <ElTabPane v-if="matchesLoaded" label="匹配记录" name="matches"><ElTable :data="matches"><ElTableColumn prop="matchLogId" label="记录 ID" /><ElTableColumn prop="userId" label="用户 ID" /><ElTableColumn prop="result" label="结果" /><ElTableColumn prop="ruleVersion" label="规则版本" /><ElTableColumn prop="createdAt" label="时间" /></ElTable><div class="mt-3 text-right"><ElButton v-if="matchCursor" @click="nextMatches">加载更多</ElButton></div></ElTabPane>
        </ElTabs>
      </template>
    </ElDrawer>
  </div>
</template>
