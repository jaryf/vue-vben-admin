<script setup lang="ts">
import type { ReviewDetail, ReviewRow } from '#/api/moderation';

import { computed, onMounted, reactive, ref } from 'vue';

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
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElRadio,
  ElRadioGroup,
  ElSelect,
  ElTable,
  ElTableColumn,
} from 'element-plus';

import { decideReview, getReview, listReviews } from '#/api/moderation';
import AdminEnumTag from '#/components/admin-enum-tag.vue';
import AdminPage from '#/components/admin-page.vue';
import AdminTime from '#/components/admin-time.vue';
import { adminDateTimeRangeToUtc } from '#/utils/admin-datetime';
import { promptDialog } from '#/utils/message-box';
import { validateReasonCode } from '#/utils/reason-code';

const timezoneStore = useTimezoneStore();

const filter = reactive({
  reviewId: '',
  targetType: '',
  targetEntityId: '',
  targetMessageId: '',
  scene: '',
  languageCode: '',
  modelName: '',
  waitingMinutes: '',
  status: 'manual_review',
  finalDecision: '',
  riskLevel: '',
  category: '',
});
const requestedRange = ref<null | string[]>(null);
const rows = ref<ReviewRow[]>([]);
const nextCursor = ref<null | string>(null);
const cursorStack = ref<string[]>([]);
const loading = ref(false);
const detailOpen = ref(false);
const detail = ref<null | ReviewDetail>(null);
const detailReason = ref('');
const decision = ref('');
const decisionReason = ref('');
const decisionNote = ref('');
const decisionKey = ref('');
const saving = ref(false);
const decisionLabels: Record<string, string> = {
  approve: '通过',
  reject: '拒绝',
  manual_review: '继续人工复核',
  escalate: '升级复核',
};
const statusLabels: Record<string, string> = {
  manual_review: '人工复核',
  approved: '已通过',
  rejected: '已拒绝',
  pending: '待审核',
  failed: '失败',
};
const targetLabels: Record<string, string> = {
  bottle: '漂流瓶',
  message: '消息',
  media: '媒体',
};
const rejectionReasonLabels: Record<string, string> = {
  ADULT_CONTENT_DISABLED: '成人内容功能未启用',
  CONTACT_INFORMATION_NOT_ALLOWED: '不允许联系方式',
  DUPLICATE_SPAM: '重复或垃圾内容',
  EXTERNAL_LINK_NOT_ALLOWED: '不允许外部链接',
  HARASSMENT: '骚扰内容',
  ILLEGAL_CONTENT: '违法内容',
  MINOR_SAFETY_RISK: '未成年人安全风险',
  PROMOTION_NOT_ALLOWED: '不允许推广内容',
  QR_CODE_NOT_ALLOWED: '不允许二维码',
  REVIEW_UNAVAILABLE: '审核能力不可用',
  SCAM_RISK: '诈骗风险',
  THREAT: '威胁内容',
  UNSUPPORTED_MEDIA: '不支持的媒体',
};
const rejectionReasons = Object.keys(rejectionReasonLabels);
const moderationDecisionReasonPattern = /^[A-Za-z0-9][A-Za-z0-9_]{0,63}$/;
const decisionText = (value: string) => decisionLabels[value] || value || '—';
const selectedDecisionLabel = computed(
  () => decisionLabels[decision.value] || decision.value,
);

function waitingTime(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  if (!Number.isFinite(elapsed)) return '—';
  const minutes = Math.floor(elapsed / 60_000);
  return minutes < 60
    ? `${minutes} 分钟`
    : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}

async function load(cursor = '') {
  loading.value = true;
  try {
    const requestedUtc = adminDateTimeRangeToUtc(
      requestedRange.value,
      timezoneStore.timezone,
    );
    const result = await listReviews({
      limit: 20,
      cursor: cursor || undefined,
      reviewId: filter.reviewId.trim() || undefined,
      targetType: filter.targetType || undefined,
      targetEntityId: filter.targetEntityId.trim() || undefined,
      targetMessageId: filter.targetMessageId.trim() || undefined,
      scene: filter.scene.trim() || undefined,
      languageCode:
        filter.targetType === 'bottle'
          ? filter.languageCode.trim() || undefined
          : undefined,
      modelName: filter.modelName.trim() || undefined,
      waitingMinutes:
        filter.status === 'manual_review' || !filter.status
          ? filter.waitingMinutes || undefined
          : undefined,
      status: filter.status || undefined,
      finalDecision: filter.finalDecision || undefined,
      riskLevel: filter.riskLevel.trim() || undefined,
      category: filter.category.trim() || undefined,
      requestedFrom: requestedUtc?.[0],
      requestedUntil: requestedUtc?.[1],
    });
    rows.value = result.items || [];
    nextCursor.value = result.nextCursor;
  } finally {
    loading.value = false;
  }
}

function search() {
  try {
    adminDateTimeRangeToUtc(requestedRange.value, timezoneStore.timezone);
  } catch (error) {
    ElMessage.error(
      error instanceof Error ? error.message : '请求时间范围无效',
    );
    return;
  }
  cursorStack.value = [];
  void load();
}
function targetTypeChanged() {
  filter.targetEntityId = '';
  filter.targetMessageId = '';
  filter.languageCode = '';
}
function statusChanged() {
  if (filter.status && filter.status !== 'manual_review')
    filter.waitingMinutes = '';
}
function decisionChanged() {
  decisionReason.value = '';
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
  const result = await promptDialog(
    '请输入查看脱敏证据的原因代码',
    '查看审核详情',
    {
      inputValidator: validateReasonCode,
    },
  );
  if (!result) return;
  const { value } = result;
  detailReason.value = value.trim();
  detail.value = await getReview(id, detailReason.value);
  detailOpen.value = true;
  decision.value = '';
  decisionReason.value = '';
  decisionNote.value = '';
  decisionKey.value = crypto.randomUUID();
}

async function submitDecision() {
  if (!detail.value || !detail.value.allowedDecisions.includes(decision.value))
    return;
  const normalizedReason = decisionReason.value.trim();
  const validReason =
    decision.value === 'reject'
      ? rejectionReasons.includes(normalizedReason)
      : moderationDecisionReasonPattern.test(normalizedReason);
  if (!validReason) {
    ElMessage.error(
      decision.value === 'reject'
        ? '请选择固定的拒绝原因'
        : '原因代码仅允许字母、数字和下划线',
    );
    return;
  }
  saving.value = true;
  try {
    detail.value = await decideReview(
      detail.value.review.reviewId,
      {
        decision: decision.value,
        reasonCode: normalizedReason.toUpperCase(),
        note: decisionNote.value.trim() || null,
      },
      decisionKey.value,
    );
    ElMessage.success('审核决策已记录');
    decision.value = '';
    decisionReason.value = '';
    decisionKey.value = crypto.randomUUID();
    await load(cursorStack.value.at(-1) || '');
  } finally {
    saving.value = false;
  }
}

function clearDetail() {
  detail.value = null;
  detailReason.value = '';
  decisionNote.value = '';
}
onMounted(() => {
  void load();
});
</script>

<template>
  <AdminPage
    title="人工审核队列"
    description="聚焦待复核内容，结合脱敏证据完成审核决策。"
  >
    <ElCard shadow="never">
      <ElAlert
        title="等待时长仅供排序和人工判断；当前未设置自动超时处理时限。"
        type="info"
        show-icon
        :closable="false"
        class="mb-4"
      />
      <div class="admin-filter">
        <ElInput
          v-model="filter.reviewId"
          placeholder="审核 ID"
          clearable
          class="!w-36"
        />
        <ElSelect
          v-model="filter.targetType"
          clearable
          placeholder="全部对象"
          class="!w-36"
          @change="targetTypeChanged"
        >
          <ElOption label="漂流瓶" value="bottle" /><ElOption
            label="消息"
            value="message"
          /><ElOption label="媒体" value="media" />
        </ElSelect>
        <ElInput
          v-if="filter.targetType !== 'message'"
          v-model="filter.targetEntityId"
          placeholder="对象 ID"
          clearable
          class="!w-32"
        />
        <ElInput
          v-else
          v-model="filter.targetMessageId"
          placeholder="消息 UUID"
          clearable
          class="!w-64"
        />
        <ElInput
          v-model="filter.scene"
          placeholder="审核场景"
          clearable
          maxlength="64"
          class="!w-36"
        />
        <ElInput
          v-if="filter.targetType === 'bottle'"
          v-model="filter.languageCode"
          placeholder="瓶语言代码"
          clearable
          maxlength="16"
          class="!w-32"
        />
        <ElInput
          v-model="filter.modelName"
          placeholder="模型名称"
          clearable
          maxlength="128"
          class="!w-40"
        />
        <ElSelect
          v-model="filter.status"
          clearable
          placeholder="全部状态"
          class="!w-40"
          @change="statusChanged"
        >
          <ElOption label="人工复核" value="manual_review" /><ElOption
            label="已通过"
            value="approved"
          /><ElOption label="已拒绝" value="rejected" />
        </ElSelect>
        <ElSelect
          v-if="!filter.status || filter.status === 'manual_review'"
          v-model="filter.waitingMinutes"
          clearable
          placeholder="最少等待"
          class="!w-36"
        >
          <ElOption label="15 分钟" value="15" /><ElOption
            label="1 小时"
            value="60"
          /><ElOption label="4 小时" value="240" /><ElOption
            label="1 天"
            value="1440"
          />
        </ElSelect>
        <ElSelect
          v-model="filter.finalDecision"
          clearable
          placeholder="全部决策"
          class="!w-36"
        >
          <ElOption label="通过" value="approve" /><ElOption
            label="拒绝"
            value="reject"
          /><ElOption label="继续人工复核" value="manual_review" />
        </ElSelect>
        <ElInput
          v-model="filter.riskLevel"
          placeholder="风险等级"
          clearable
          class="!w-36"
        />
        <ElInput
          v-model="filter.category"
          placeholder="风险分类"
          clearable
          class="!w-36"
        />
        <ElDatePicker
          v-model="requestedRange"
          type="datetimerange"
          value-format="YYYY-MM-DD HH:mm:ss"
          start-placeholder="请求开始"
          end-placeholder="请求结束"
          class="!w-[360px]"
        />
        <ElButton @click="search" type="primary">查询</ElButton>
      </div>
      <ElTable v-loading="loading" :data="rows" row-key="reviewId">
        <ElTableColumn prop="reviewId" label="审核 ID" width="110" />
        <ElTableColumn label="对象类型" width="105">
          <template #default="{ row }">
            <AdminEnumTag
              :value="row.targetType"
              :label="targetLabels[row.targetType] || row.targetType"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn label="对象 ID" min-width="150">
          <template #default="{ row }">
            {{ row.targetEntityId || row.targetMessageId || '—' }}
          </template>
        </ElTableColumn>
        <ElTableColumn prop="scene" label="场景" min-width="120">
          <template #default="{ row }">
            <AdminEnumTag :value="row.scene" />
          </template>
        </ElTableColumn>
        <ElTableColumn prop="riskLevel" label="风险等级" width="110">
          <template #default="{ row }">
            <AdminEnumTag :value="row.riskLevel" />
          </template>
        </ElTableColumn>
        <ElTableColumn prop="modelName" label="模型" min-width="135" />
        <ElTableColumn label="状态" width="125">
          <template #default="{ row }">
            <AdminEnumTag
              :value="row.status"
              :label="statusLabels[row.status] || row.status"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn label="最终决策" width="120">
          <template #default="{ row }">
            <AdminEnumTag
              :value="row.finalDecision"
              :label="decisionText(row.finalDecision)"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn prop="evidenceCount" label="证据数" width="90" />
        <ElTableColumn label="等待时长" width="140">
          <template #default="{ row }">
            {{
              row.status === 'manual_review'
                ? waitingTime(row.requestedAt)
                : '—'
            }}
          </template>
        </ElTableColumn>
        <ElTableColumn prop="requestedAt" label="请求时间" min-width="180">
          <template #default="{ row }">
            <AdminTime :value="row.requestedAt" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="85">
          <template #default="{ row }">
            <ElButton link type="primary" @click="openDetail(row.reviewId)">
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
      :title="`审核记录 #${detail?.review.reviewId || ''}`"
      size="65%"
      @closed="clearDetail"
    >
      <template v-if="detail">
        <ElDescriptions :column="2" border>
          <ElDescriptionsItem label="对象">
            <AdminEnumTag
              :value="detail.review.targetType"
              :label="
                targetLabels[detail.review.targetType] ||
                detail.review.targetType
              "
            />
            #{{
              detail.review.targetEntityId || detail.review.targetMessageId
            }}
</ElDescriptionsItem><ElDescriptionsItem label="场景">
            <AdminEnumTag :value="detail.review.scene" />
</ElDescriptionsItem><ElDescriptionsItem label="状态">
            <AdminEnumTag
              :value="detail.review.status"
              :label="
                statusLabels[detail.review.status] || detail.review.status
              "
            />
</ElDescriptionsItem><ElDescriptionsItem label="最终决策">
            <AdminEnumTag
              :value="detail.review.finalDecision"
              :label="decisionText(detail.review.finalDecision)"
            />
</ElDescriptionsItem><ElDescriptionsItem label="风险等级">
            <AdminEnumTag
              :value="detail.review.riskLevel"
            />
</ElDescriptionsItem><ElDescriptionsItem label="风险分类">
            {{
              detail.review.categories?.join('、') || '无'
            }}
</ElDescriptionsItem><ElDescriptionsItem label="规则版本">
            {{ detail.review.ruleVersion }}
</ElDescriptionsItem><ElDescriptionsItem label="模型版本">
            {{ detail.review.modelName }}
</ElDescriptionsItem><ElDescriptionsItem label="证据数">
            {{ detail.review.evidenceCount }}
</ElDescriptionsItem><ElDescriptionsItem label="请求时间">
            <AdminTime
              :value="detail.review.requestedAt"
            />
</ElDescriptionsItem><ElDescriptionsItem label="完成时间">
            <AdminTime
              :value="detail.review.completedAt"
            />
</ElDescriptionsItem><ElDescriptionsItem label="等待时长">
            {{
              detail.review.status === 'manual_review'
                ? waitingTime(detail.review.requestedAt)
                : '—'
            }}
          </ElDescriptionsItem>
        </ElDescriptions>
        <ElDivider>脱敏证据</ElDivider>
        <ElTable :data="detail.evidence">
          <ElTableColumn
            prop="evidenceId"
            label="证据 ID"
            width="100"
          /><ElTableColumn prop="sourceType" label="来源" width="130">
            <template #default="{ row }">
              <AdminEnumTag :value="row.sourceType" />
            </template>
</ElTableColumn><ElTableColumn
            prop="maskedText"
            label="脱敏片段"
            min-width="250"
          /><ElTableColumn
            prop="mediaAssetId"
            label="媒体 ID"
            width="100"
          /><ElTableColumn prop="createdAt" label="时间" min-width="180">
            <template #default="{ row }">
              <AdminTime :value="row.createdAt" />
            </template>
          </ElTableColumn>
        </ElTable>
        <template v-if="detail.allowedDecisions.length">
          <ElDivider>人工决策</ElDivider>
          <ElForm label-position="top" @submit.prevent="submitDecision">
            <ElFormItem label="决策">
              <ElRadioGroup v-model="decision" @change="decisionChanged">
                <ElRadio
                  v-for="item in detail.allowedDecisions"
                  :key="item"
                  :value="item"
                >
                  {{ decisionLabels[item] || item }}
                </ElRadio>
              </ElRadioGroup>
            </ElFormItem>
            <ElFormItem label="原因代码">
              <ElSelect
                v-if="decision === 'reject'"
                v-model="decisionReason"
                placeholder="请选择固定拒绝原因"
                filterable
                class="w-full"
              >
                <ElOption
                  v-for="item in rejectionReasons"
                  :key="item"
                  :label="`${rejectionReasonLabels[item]}（${item}）`"
                  :value="item"
                />
              </ElSelect>
              <ElInput
                v-else
                v-model="decisionReason"
                placeholder="例如 SAFETY_REVIEWED（字母、数字、下划线）"
                maxlength="64"
              />
            </ElFormItem>
            <ElFormItem label="备注">
              <ElInput
                v-model="decisionNote"
                type="textarea"
                maxlength="1000"
                show-word-limit
              />
            </ElFormItem>
            <ElButton
              type="primary"
              :disabled="!decision"
              :loading="saving"
              @click="submitDecision"
            >
              提交{{ selectedDecisionLabel }}
            </ElButton>
          </ElForm>
        </template>
      </template>
    </ElDrawer>
  </AdminPage>
</template>
