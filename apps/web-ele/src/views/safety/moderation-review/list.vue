<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import { ElMessage, ElMessageBox } from 'element-plus';

import { decideReview, getReview, listReviews } from '#/api/moderation';
import type { ReviewDetail, ReviewRow } from '#/api/moderation';

const filter = reactive({
  reviewId: '', targetType: '', targetEntityId: '', targetMessageId: '',
  scene: '', status: 'manual_review', finalDecision: '', riskLevel: '', category: '',
});
const requestedRange = ref<Date[] | null>(null);
const rows = ref<ReviewRow[]>([]);
const nextCursor = ref<string | null>(null);
const cursorStack = ref<string[]>([]);
const loading = ref(false);
const detailOpen = ref(false);
const detail = ref<ReviewDetail | null>(null);
const detailReason = ref('');
const decision = ref('');
const decisionReason = ref('');
const decisionNote = ref('');
const decisionKey = ref('');
const saving = ref(false);
const decisionLabels: Record<string, string> = { approve: '通过', reject: '拒绝', manual_review: '继续人工复核', escalate: '升级复核' };
const statusLabels: Record<string, string> = { manual_review: '人工复核', approved: '已通过', rejected: '已拒绝', pending: '待审核', failed: '失败' };
const targetLabels: Record<string, string> = { bottle: '漂流瓶', message: '消息', media: '媒体' };
const decisionText = (value: string) => decisionLabels[value] || value || '—';
const selectedDecisionLabel = computed(() => decisionLabels[decision.value] || decision.value);

function waitingTime(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  if (!Number.isFinite(elapsed)) return '—';
  const minutes = Math.floor(elapsed / 60000);
  return minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}

async function load(cursor = '') {
  loading.value = true;
  try {
    const result = await listReviews({
      limit: 20, cursor: cursor || undefined,
      reviewId: filter.reviewId.trim() || undefined,
      targetType: filter.targetType || undefined,
      targetEntityId: filter.targetEntityId.trim() || undefined,
      targetMessageId: filter.targetMessageId.trim() || undefined,
      scene: filter.scene.trim() || undefined,
      status: filter.status || undefined,
      finalDecision: filter.finalDecision || undefined,
      riskLevel: filter.riskLevel.trim() || undefined,
      category: filter.category.trim() || undefined,
      requestedFrom: requestedRange.value?.[0]?.toISOString(),
      requestedUntil: requestedRange.value?.[1]?.toISOString(),
    });
    rows.value = result.items || [];
    nextCursor.value = result.nextCursor;
  } finally { loading.value = false; }
}

function search() { cursorStack.value = []; void load(); }
function targetTypeChanged() { filter.targetEntityId = ''; filter.targetMessageId = ''; }
function next() { if (!nextCursor.value) return; cursorStack.value.push(nextCursor.value); void load(nextCursor.value); }
function previous() { cursorStack.value.pop(); void load(cursorStack.value.at(-1) || ''); }

async function openDetail(id: number) {
  const { value } = await ElMessageBox.prompt('请输入查看脱敏证据的原因代码', '查看审核详情', {
    inputPattern: /^[A-Za-z0-9][A-Za-z0-9._-]*$/, inputErrorMessage: '请输入有效的原因代码',
  });
  detailReason.value = value.trim();
  detail.value = await getReview(id, detailReason.value);
  detailOpen.value = true;
  decision.value = ''; decisionReason.value = ''; decisionNote.value = '';
  decisionKey.value = crypto.randomUUID();
}

async function submitDecision() {
  if (!detail.value || !detail.value.allowedDecisions.includes(decision.value)) return;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(decisionReason.value)) {
    ElMessage.error('请输入有效的决策原因代码'); return;
  }
  saving.value = true;
  try {
    detail.value = await decideReview(detail.value.review.reviewId, {
      decision: decision.value, reasonCode: decisionReason.value.trim(), note: decisionNote.value.trim() || null,
    }, decisionKey.value);
    ElMessage.success('审核决策已记录');
    decision.value = '';
    decisionKey.value = crypto.randomUUID();
    await load(cursorStack.value.at(-1) || '');
  } finally { saving.value = false; }
}

function clearDetail() { detail.value = null; detailReason.value = ''; decisionNote.value = ''; }
onMounted(() => { void load(); });
</script>

<template>
  <div class="p-5">
    <ElCard shadow="never">
      <template #header>人工审核队列</template>
      <ElAlert title="等待时长仅供排序和人工判断；当前未设置自动超时处理时限。" type="info" show-icon :closable="false" class="mb-4" />
      <div class="mb-4 flex flex-wrap gap-3">
        <ElInput v-model="filter.reviewId" placeholder="审核 ID" clearable class="!w-36" />
        <ElSelect v-model="filter.targetType" clearable placeholder="全部对象" class="!w-36" @change="targetTypeChanged"><ElOption label="漂流瓶" value="bottle" /><ElOption label="消息" value="message" /><ElOption label="媒体" value="media" /></ElSelect>
        <ElInput v-if="filter.targetType !== 'message'" v-model="filter.targetEntityId" placeholder="对象 ID" clearable class="!w-32" />
        <ElInput v-else v-model="filter.targetMessageId" placeholder="消息 UUID" clearable class="!w-64" />
        <ElInput v-model="filter.scene" placeholder="审核场景" clearable maxlength="64" class="!w-36" />
        <ElSelect v-model="filter.status" clearable placeholder="全部状态" class="!w-40"><ElOption label="人工复核" value="manual_review" /><ElOption label="已通过" value="approved" /><ElOption label="已拒绝" value="rejected" /></ElSelect>
        <ElSelect v-model="filter.finalDecision" clearable placeholder="全部决策" class="!w-36"><ElOption label="通过" value="approve" /><ElOption label="拒绝" value="reject" /><ElOption label="继续人工复核" value="manual_review" /></ElSelect>
        <ElInput v-model="filter.riskLevel" placeholder="风险等级" clearable class="!w-36" />
        <ElInput v-model="filter.category" placeholder="风险分类" clearable class="!w-36" />
        <ElDatePicker v-model="requestedRange" type="datetimerange" start-placeholder="请求开始" end-placeholder="请求结束" class="!w-[360px]" />
        <ElButton @click="search">查询</ElButton>
      </div>
      <ElTable v-loading="loading" :data="rows" row-key="reviewId">
        <ElTableColumn prop="reviewId" label="审核 ID" width="110" />
        <ElTableColumn label="对象类型" width="100"><template #default="{ row }">{{ targetLabels[row.targetType] || row.targetType }}</template></ElTableColumn>
        <ElTableColumn label="对象 ID" min-width="150"><template #default="{ row }">{{ row.targetEntityId || row.targetMessageId || '—' }}</template></ElTableColumn>
        <ElTableColumn prop="scene" label="场景" min-width="120" />
        <ElTableColumn prop="riskLevel" label="风险等级" width="110" />
        <ElTableColumn label="状态" width="125"><template #default="{ row }">{{ statusLabels[row.status] || row.status }}</template></ElTableColumn>
        <ElTableColumn label="最终决策" width="105"><template #default="{ row }">{{ decisionText(row.finalDecision) }}</template></ElTableColumn>
        <ElTableColumn prop="evidenceCount" label="证据数" width="90" />
        <ElTableColumn label="等待时长" width="140"><template #default="{ row }">{{ row.status === 'manual_review' ? waitingTime(row.requestedAt) : '—' }}</template></ElTableColumn>
        <ElTableColumn prop="requestedAt" label="请求时间" min-width="180" />
        <ElTableColumn label="操作" width="85"><template #default="{ row }"><ElButton link type="primary" @click="openDetail(row.reviewId)">详情</ElButton></template></ElTableColumn>
      </ElTable>
      <div class="mt-4 flex justify-end gap-2"><ElButton :disabled="cursorStack.length === 0" @click="previous">上一页</ElButton><ElButton :disabled="!nextCursor" @click="next">下一页</ElButton></div>
    </ElCard>

    <ElDrawer v-model="detailOpen" :title="`审核记录 #${detail?.review.reviewId || ''}`" size="65%" @closed="clearDetail">
      <template v-if="detail">
        <ElDescriptions :column="2" border><ElDescriptionsItem label="对象">{{ targetLabels[detail.review.targetType] || detail.review.targetType }} #{{ detail.review.targetEntityId || detail.review.targetMessageId }}</ElDescriptionsItem><ElDescriptionsItem label="场景">{{ detail.review.scene }}</ElDescriptionsItem><ElDescriptionsItem label="状态">{{ statusLabels[detail.review.status] || detail.review.status }}</ElDescriptionsItem><ElDescriptionsItem label="最终决策">{{ decisionText(detail.review.finalDecision) }}</ElDescriptionsItem><ElDescriptionsItem label="风险等级">{{ detail.review.riskLevel }}</ElDescriptionsItem><ElDescriptionsItem label="风险分类">{{ detail.review.categories?.join('、') || '无' }}</ElDescriptionsItem><ElDescriptionsItem label="规则版本">{{ detail.review.ruleVersion }}</ElDescriptionsItem><ElDescriptionsItem label="模型版本">{{ detail.review.modelName }}</ElDescriptionsItem><ElDescriptionsItem label="证据数">{{ detail.review.evidenceCount }}</ElDescriptionsItem><ElDescriptionsItem label="请求时间">{{ detail.review.requestedAt }}</ElDescriptionsItem><ElDescriptionsItem label="完成时间">{{ detail.review.completedAt || '—' }}</ElDescriptionsItem><ElDescriptionsItem label="等待时长">{{ detail.review.status === 'manual_review' ? waitingTime(detail.review.requestedAt) : '—' }}</ElDescriptionsItem></ElDescriptions>
        <ElDivider>脱敏证据</ElDivider>
        <ElTable :data="detail.evidence"><ElTableColumn prop="evidenceId" label="证据 ID" width="100" /><ElTableColumn prop="sourceType" label="来源" width="130" /><ElTableColumn prop="maskedText" label="脱敏片段" min-width="250" /><ElTableColumn prop="mediaAssetId" label="媒体 ID" width="100" /><ElTableColumn prop="createdAt" label="时间" min-width="180" /></ElTable>
        <template v-if="detail.allowedDecisions.length">
          <ElDivider>人工决策</ElDivider>
          <ElForm label-position="top" @submit.prevent="submitDecision">
            <ElFormItem label="决策"><ElRadioGroup v-model="decision"><ElRadio v-for="item in detail.allowedDecisions" :key="item" :value="item">{{ decisionLabels[item] || item }}</ElRadio></ElRadioGroup></ElFormItem>
            <ElFormItem label="原因代码"><ElInput v-model="decisionReason" placeholder="例如 safety_reviewed" maxlength="64" /></ElFormItem>
            <ElFormItem label="备注"><ElInput v-model="decisionNote" type="textarea" maxlength="1000" show-word-limit /></ElFormItem>
            <ElButton type="primary" :disabled="!decision" :loading="saving" @click="submitDecision">提交{{ selectedDecisionLabel }}</ElButton>
          </ElForm>
        </template>
      </template>
    </ElDrawer>
  </div>
</template>
