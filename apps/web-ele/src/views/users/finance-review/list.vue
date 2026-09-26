<script setup lang="ts">
import type {
  FinanceReviewAction,
  FinanceReviewActionInput,
  FinanceReviewCase,
} from '#/api/finance-reviews';

import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';

import {
  ElAlert,
  ElButton,
  ElCard,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDrawer,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElOption,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTimeline,
  ElTimelineItem,
} from 'element-plus';

import {
  createFinanceReviewAction,
  getFinanceReview,
  listFinanceReviewActions,
  listFinanceReviews,
} from '#/api/finance-reviews';
import AdminEnumTag from '#/components/admin-enum-tag.vue';
import AdminPage from '#/components/admin-page.vue';
import AdminTime from '#/components/admin-time.vue';
import { promptDialog } from '#/utils/message-box';
import { validateReasonCode } from '#/utils/reason-code';

const { hasAccessByCodes } = useAccess();
const canManage = computed(() => hasAccessByCodes(['finance_review.manage']));
const rows = ref<FinanceReviewCase[]>([]);
const nextCursor = ref<null | string>(null);
const cursorStack = ref<string[]>([]);
const loading = ref(false);
const saving = ref(false);
const detailOpen = ref(false);
const actionOpen = ref(false);
const detail = ref<FinanceReviewCase | null>(null);
const actions = ref<FinanceReviewAction[]>([]);
const detailReason = ref('');
const actionKey = ref('');
const filter = reactive({
  userId: '',
  orderId: '',
  reasonCode: '',
  status: '',
});
const actionForm = reactive({
  action: 'assign' as FinanceReviewActionInput['action'],
  assignedTo: '',
  note: '',
  externalReference: '',
});
function reasonText(value: string) {
  if (value === 'coin_shortfall') return '金币余额不足';
  if (value === 'partial_refund') return '部分退款待核验';
  return value;
}
const statusText = (value: string) =>
  ({ open: '待分派', in_review: '处理中', resolved: '已核验' })[
    value as 'in_review' | 'open' | 'resolved'
  ] || value;
const actionText = (value: string) =>
  ({ assign: '分派', note: '处理备注', resolve: '核验完成' })[
    value as FinanceReviewActionInput['action']
  ] || value;

async function load(cursor = '') {
  loading.value = true;
  try {
    const result = await listFinanceReviews({
      userId: filter.userId || undefined,
      orderId: filter.orderId || undefined,
      reasonCode: filter.reasonCode || undefined,
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
async function refreshDetail() {
  if (!detail.value) return;
  const id = detail.value.caseId;
  const [caseDetail, history] = await Promise.all([
    getFinanceReview(id, detailReason.value),
    listFinanceReviewActions(id, detailReason.value),
  ]);
  detail.value = caseDetail;
  actions.value = history;
}
async function openDetail(row: FinanceReviewCase) {
  const result = await promptDialog(
    `查看财务异常 #${row.caseId}，请填写审计原因`,
    '审计原因',
    {
      inputValidator: validateReasonCode,
    },
  );
  if (!result) return;
  const { value } = result;
  detailReason.value = value.trim();
  detail.value = row;
  await refreshDetail();
  detailOpen.value = true;
}
function openAction(action: FinanceReviewActionInput['action']) {
  if (!detail.value) return;
  Object.assign(actionForm, {
    action,
    assignedTo: String(detail.value.assignedTo || ''),
    note: '',
    externalReference: '',
  });
  actionKey.value = crypto.randomUUID();
  actionOpen.value = true;
}
async function submitAction() {
  if (!detail.value) return;
  const note = actionForm.note.trim();
  if (note.length < 10 || note.length > 1000) {
    ElMessage.error('处理说明需填写 10 到 1000 字');
    return;
  }
  const input: FinanceReviewActionInput = { action: actionForm.action, note };
  if (actionForm.action === 'assign') {
    if (!/^[1-9]\d*$/.test(actionForm.assignedTo)) {
      ElMessage.error('请输入有效的接手管理员 ID');
      return;
    }
    input.assignedTo = Number(actionForm.assignedTo);
  }
  if (actionForm.action === 'resolve') {
    const reference = actionForm.externalReference.trim();
    if (reference.length < 3 || reference.length > 256) {
      ElMessage.error('请填写外部核验凭据编号');
      return;
    }
    input.externalReference = reference;
  }
  saving.value = true;
  try {
    detail.value = await createFinanceReviewAction(
      detail.value.caseId,
      input,
      actionKey.value,
    );
    actionOpen.value = false;
    ElMessage.success('处理记录已保存');
    await Promise.all([refreshDetail(), load(cursorStack.value.at(-1) || '')]);
  } finally {
    saving.value = false;
  }
}
onMounted(() => {
  void load();
});
</script>

<template>
  <AdminPage
    title="财务异常处理"
    description="跟进商店退款与金币异常，记录人工分派和核验过程。"
  >
    <ElCard shadow="never">
      <ElAlert
        class="mb-4"
        type="warning"
        show-icon
        :closable="false"
        title="商店退款与拒付以官方通知为准。金币不足案件保持消费冻结；本页面仅记录分派和核验，不会发起退款、追回金币或解除冻结。"
      />
      <div class="admin-filter">
        <ElInput
          v-model="filter.userId"
          placeholder="用户 ID"
          clearable
          class="!w-32"
        />
        <ElInput
          v-model="filter.orderId"
          placeholder="订单 ID"
          clearable
          class="!w-32"
        />
        <ElSelect
          v-model="filter.reasonCode"
          clearable
          placeholder="全部异常"
          class="!w-44"
        >
          <ElOption label="金币余额不足" value="coin_shortfall" /><ElOption
            label="部分退款待核验"
            value="partial_refund"
          />
        </ElSelect>
        <ElSelect
          v-model="filter.status"
          clearable
          placeholder="全部状态"
          class="!w-36"
        >
          <ElOption label="待分派" value="open" /><ElOption
            label="处理中"
            value="in_review"
          /><ElOption label="已核验" value="resolved" />
        </ElSelect>
        <ElButton @click="search" type="primary">查询</ElButton>
      </div>
      <ElTable v-loading="loading" :data="rows" row-key="caseId">
        <ElTableColumn prop="caseId" label="异常 ID" width="100" />
        <ElTableColumn prop="userId" label="用户 ID" width="100" />
        <ElTableColumn prop="orderId" label="订单 ID" width="100" />
        <ElTableColumn label="异常原因" min-width="150">
          <template #default="{ row }">
            <AdminEnumTag
              :value="row.reasonCode"
              :label="reasonText(row.reasonCode)"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="120">
          <template #default="{ row }">
            <AdminEnumTag :value="row.status" :label="statusText(row.status)" />
          </template>
        </ElTableColumn>
        <ElTableColumn prop="assignedTo" label="接手人 ID" width="105" />
        <ElTableColumn label="消费冻结" width="105">
          <template #default="{ row }">
            <AdminEnumTag
              :value="Boolean(row.spendFrozenAt)"
              :label="row.spendFrozenAt ? '已冻结' : '未冻结'"
              :tone="row.spendFrozenAt ? 'danger' : 'info'"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn prop="createdAt" label="记录时间" min-width="175">
          <template #default="{ row }">
            <AdminTime :value="row.createdAt" />
          </template>
        </ElTableColumn>
        <!-- @vue-generic {FinanceReviewCase} --><ElTableColumn
          label="操作"
          width="85"
        >
          <template #default="{ row }">
            <ElButton link type="primary" @click="openDetail(row)">
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
      title="财务异常详情"
      size="55%"
      @closed="detail = null"
    >
      <template v-if="detail">
        <ElDescriptions :column="1" border>
          <ElDescriptionsItem label="异常 ID">
            {{ detail.caseId }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="用户 / 订单 ID">
            {{ detail.userId }} / {{ detail.orderId }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="原因 / 状态">
            <AdminEnumTag
              :value="detail.reasonCode"
              :label="reasonText(detail.reasonCode)"
            />
            /
            <AdminEnumTag
              :value="detail.status"
              :label="statusText(detail.status)"
            />
          </ElDescriptionsItem>
          <ElDescriptionsItem label="商店事件">
            <AdminEnumTag :value="detail.provider" /> /
            {{ detail.eventId }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="事件时金币余额">
            {{ detail.coinBalance ?? '不适用' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="应追回金币">
            {{ detail.coinGrantAmount ?? '不适用' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="消费冻结时间">
            <AdminTime
              v-if="detail.spendFrozenAt"
              :value="detail.spendFrozenAt"
            /><span v-else>未冻结</span>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="接手管理员 ID">
            {{ detail.assignedTo || '未分派' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="核验管理员 ID">
            {{ detail.resolvedBy || '未核验' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="核验时间">
            <AdminTime :value="detail.resolvedAt" />
          </ElDescriptionsItem>
          <ElDescriptionsItem label="商店事件时间">
            <AdminTime :value="detail.occurredAt" />
          </ElDescriptionsItem>
        </ElDescriptions>
        <div
          v-if="canManage && detail.status !== 'resolved'"
          class="my-5 flex flex-wrap gap-2"
        >
          <ElButton @click="openAction('assign')">分派处理</ElButton>
          <ElButton @click="openAction('note')">添加备注</ElButton>
          <ElButton
            v-if="
              detail.reasonCode === 'partial_refund' &&
              detail.status === 'in_review'
            "
            type="primary"
            @click="openAction('resolve')"
          >
            记录外部核验完成
          </ElButton>
        </div>
        <ElAlert
          v-if="detail.reasonCode === 'coin_shortfall'"
          class="my-4"
          type="warning"
          show-icon
          :closable="false"
          title="金币不足案件只能分派和记录调查过程；消费冻结仍由服务端强制执行，需另行完成财务追回方案。"
        />
        <h3 class="my-4 text-base font-medium">处理记录（最近 100 条）</h3>
        <ElTimeline v-if="actions.length">
          <ElTimelineItem
            v-for="item in actions"
            :key="item.actionId"
            :timestamp="item.createdAt"
          >
            <div>
              {{ actionText(item.action) }} · 管理员 {{ item.actorId
              }}<span v-if="item.assignedTo">
                · 接手人 {{ item.assignedTo }}</span>
            </div>
            <div class="whitespace-pre-wrap">{{ item.note }}</div>
            <div v-if="item.externalReference">
              外部凭据：{{ item.externalReference }}
            </div>
          </ElTimelineItem>
        </ElTimeline>
        <ElEmpty v-else description="暂无处理记录" />
      </template>
    </ElDrawer>
    <ElDialog
      v-model="actionOpen"
      :title="actionText(actionForm.action)"
      width="560px"
    >
      <ElForm label-width="110px">
        <ElFormItem v-if="actionForm.action === 'assign'" label="管理员 ID">
          <ElInput
            v-model="actionForm.assignedTo"
            placeholder="接手管理员 ID"
          />
        </ElFormItem>
        <ElFormItem v-if="actionForm.action === 'resolve'" label="外部凭据编号">
          <ElInput
            v-model="actionForm.externalReference"
            placeholder="商店工单或核验凭据编号"
          />
        </ElFormItem>
        <ElFormItem label="处理说明">
          <ElInput
            v-model="actionForm.note"
            type="textarea"
            :rows="4"
            maxlength="1000"
            show-word-limit
            placeholder="至少 10 字，说明依据和下一步处理"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="actionOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="submitAction">
          保存记录
        </ElButton>
      </template>
    </ElDialog>
  </AdminPage>
</template>
