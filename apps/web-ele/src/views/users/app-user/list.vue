<script setup lang="ts">
import type { AppUserDetail, AppUserRow } from '#/api/app-users';
import type { OrderDetail } from '#/api/commerce';

import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useTimezoneStore } from '@vben/stores';

import {
  ElAlert,
  ElButton,
  ElCard,
  ElDatePicker,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDivider,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElRadio,
  ElRadioGroup,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
} from 'element-plus';

import {
  adjustAppUserEntitlement,
  adjustAppUserQuota,
  getAppUser,
  getDeletionRequest,
  listAppUserBindings,
  listAppUserDevices,
  listAppUserIdentityConflicts,
  listAppUsers,
  listAppUserSessions,
  listDeletionRequests,
  reviewDeletionRequest,
  revokeAppUserSession,
  revokeAppUserSessions,
  updateAppUserBirthDate,
  updateAppUserStatus,
} from '#/api/app-users';
import { listBottles } from '#/api/bottles';
import {
  getOrder,
  listAppUserOrders,
  listCoinLedger,
  listEntitlementLedger,
} from '#/api/commerce';
import { listConversations } from '#/api/conversations';
import { listRiskEvents } from '#/api/risk-events';
import { listReports } from '#/api/safety-cases';
import AdminEnumTag from '#/components/admin-enum-tag.vue';
import AdminPage from '#/components/admin-page.vue';
import AdminTime from '#/components/admin-time.vue';
import { adminDateTimeRangeToUtc } from '#/utils/admin-datetime';
import { promptDialog } from '#/utils/message-box';
import { isValidReasonCode, validateReasonCode } from '#/utils/reason-code';

const { hasAccessByCodes } = useAccess();
const timezoneStore = useTimezoneStore();
const canRevoke = computed(() =>
  hasAccessByCodes(['account_user.session.revoke']),
);
const canStatus = computed(() =>
  hasAccessByCodes(['account_user.status.update']),
);
const canUpdateBirthDate = computed(() =>
  hasAccessByCodes(['account_user.birth_date.update']),
);
const canQuota = computed(() => hasAccessByCodes(['quota.adjust']));
const canEntitlement = computed(() => hasAccessByCodes(['entitlement.adjust']));
const canReviewDeletion = computed(() =>
  hasAccessByCodes(['account_user.deletion.review']),
);
const canReadOrders = computed(() => hasAccessByCodes(['order.read']));
const canReadBottles = computed(() => hasAccessByCodes(['bottle.read']));
const canReadConversations = computed(() =>
  hasAccessByCodes(['message.read_context']),
);
const canReadReports = computed(() => hasAccessByCodes(['report.read']));
const canReadRisk = computed(() => hasAccessByCodes(['risk_event.read']));
const canReadActivity = computed(
  () =>
    canReadBottles.value ||
    canReadConversations.value ||
    canReadReports.value ||
    canReadRisk.value,
);
const filters = reactive({
  userId: '',
  nickname: '',
  status: '',
  countryCode: '',
  interfaceLanguage: '',
  bindingMethod: '',
  vipStatus: '',
});
const registeredRange = ref<null | string[]>(null);
const activeRange = ref<null | string[]>(null);
const rows = ref<AppUserRow[]>([]);
const nextCursor = ref<null | string>(null);
const cursorStack = ref<string[]>([]);
const loading = ref(false);
const detailOpen = ref(false);
const detail = ref<AppUserDetail | null>(null);
const detailUserId = ref<null | number>(null);
const sessions = ref<Record<string, any>[]>([]);
const devices = ref<Record<string, any>[]>([]);
const bindings = ref<Record<string, any>[]>([]);
const conflicts = ref<Record<string, any>[]>([]);
const detailTab = ref('profile');
const commerceKind = ref<'coins' | 'entitlements' | 'orders'>('orders');
const commerceRows = ref<Record<string, any>[]>([]);
const commerceCursor = ref<null | string>(null);
const commerceLoading = ref(false);
let commerceRevision = 0;
const orderDetail = ref<null | OrderDetail>(null);
const orderDetailOpen = ref(false);
type ActivityKind = 'bottles' | 'conversations' | 'reports' | 'risks';
const activityKind = ref<ActivityKind>('bottles');
const activityRows = ref<Record<string, any>[]>([]);
const activityCursor = ref<null | string>(null);
const activityLoading = ref(false);
let activityRevision = 0;
const actionOpen = ref(false);
const action = ref<'birth-date' | 'entitlement' | 'quota' | 'status'>('status');
const saving = ref(false);
const actionKey = ref('');
const actionForm = reactive({
  status: 'active',
  birthDate: '',
  quotaType: 'bottle_send',
  amount: 1,
  entitlementType: '',
  reasonCode: '',
  note: '',
});
const deletionOpen = ref(false);
const deletionRows = ref<Record<string, any>[]>([]);
const deletionCursor = ref<null | string>(null);
const deletionStack = ref<string[]>([]);
const deletionFilter = reactive({ userId: '', status: 'pending' });
const reviewOpen = ref(false);
const reviewTarget = ref<null | Record<string, any>>(null);
const reviewForm = reactive({ decision: 'approve', reasonCode: '', note: '' });

const statusLabels: Record<string, string> = {
  pending_profile: '待完善资料',
  active: '正常',
  restricted: '受限',
  suspended: '暂停',
  banned: '封禁',
  deleting: '注销冷静期',
  deleted: '已注销',
};
const statusLabel = (value: string) => statusLabels[value] || value;

async function load(cursor = '') {
  loading.value = true;
  try {
    const registeredUtc = adminDateTimeRangeToUtc(
      registeredRange.value,
      timezoneStore.timezone,
    );
    const activeUtc = adminDateTimeRangeToUtc(
      activeRange.value,
      timezoneStore.timezone,
    );
    const result = await listAppUsers({
      limit: 20,
      cursor: cursor || undefined,
      userId: filters.userId.trim() || undefined,
      nickname: filters.nickname.trim() || undefined,
      status: filters.status || undefined,
      countryCode: filters.countryCode.trim().toUpperCase() || undefined,
      interfaceLanguage:
        filters.interfaceLanguage.trim().toLowerCase() || undefined,
      bindingMethod: filters.bindingMethod || undefined,
      vipStatus: filters.vipStatus || undefined,
      registeredFrom: registeredUtc?.[0],
      registeredUntil: registeredUtc?.[1],
      lastActiveFrom: activeUtc?.[0],
      lastActiveUntil: activeUtc?.[1],
    });
    rows.value = result.items || [];
    nextCursor.value = result.nextCursor;
  } finally {
    loading.value = false;
  }
}

function search() {
  try {
    adminDateTimeRangeToUtc(registeredRange.value, timezoneStore.timezone);
    adminDateTimeRangeToUtc(activeRange.value, timezoneStore.timezone);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '时间范围无效');
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

async function openDetail(id: number) {
  detailUserId.value = id;
  detailTab.value = 'profile';
  detailOpen.value = true;
  detail.value = null;
  orderDetailOpen.value = false;
  orderDetail.value = null;
  commerceRevision += 1;
  activityRevision += 1;
  if (canReadBottles.value) activityKind.value = 'bottles';
  else if (canReadConversations.value) activityKind.value = 'conversations';
  else if (canReadReports.value) activityKind.value = 'reports';
  else activityKind.value = 'risks';
  activityRows.value = [];
  activityCursor.value = null;
  commerceKind.value = 'orders';
  commerceRows.value = [];
  commerceCursor.value = null;
  const [user, sessionList, deviceList, bindingList, conflictList] =
    await Promise.all([
      getAppUser(id),
      listAppUserSessions(id),
      listAppUserDevices(id),
      listAppUserBindings(id),
      listAppUserIdentityConflicts(id),
    ]);
  detail.value = user;
  sessions.value = sessionList || [];
  devices.value = deviceList || [];
  bindings.value = bindingList || [];
  conflicts.value = conflictList || [];
}

async function loadCommerce(cursor = '') {
  const userId = detailUserId.value;
  const kind = commerceKind.value;
  if (!userId || !canReadOrders.value) return;
  const revision = ++commerceRevision;
  commerceLoading.value = true;
  try {
    const params = { userId, cursor: cursor || undefined, limit: 20 };
    const loaders = {
      coins: () => listCoinLedger(params),
      entitlements: () => listEntitlementLedger(params),
      orders: () => listAppUserOrders(userId, params),
    };
    const result = await loaders[kind]();
    if (
      detailUserId.value !== userId ||
      commerceKind.value !== kind ||
      revision !== commerceRevision
    )
      return;
    commerceRows.value = cursor
      ? [...commerceRows.value, ...(result.items || [])]
      : result.items || [];
    commerceCursor.value = result.nextCursor;
  } finally {
    if (revision === commerceRevision) commerceLoading.value = false;
  }
}
function switchCommerce() {
  commerceRows.value = [];
  commerceCursor.value = null;
  void loadCommerce();
}
function detailTabChanged(tab: number | string) {
  if (tab === 'commerce') switchCommerce();
  if (tab === 'activity') switchActivity();
}
async function openOrderDetail(id: number) {
  const userId = detailUserId.value;
  const result = await getOrder(id);
  if (detailUserId.value !== userId) return;
  orderDetail.value = result;
  orderDetailOpen.value = true;
}
async function loadActivity(cursor = '') {
  const userId = detailUserId.value;
  const kind = activityKind.value;
  const permissions = {
    bottles: canReadBottles.value,
    conversations: canReadConversations.value,
    reports: canReadReports.value,
    risks: canReadRisk.value,
  };
  const permitted = permissions[kind];
  if (!userId || !permitted) return;
  const revision = ++activityRevision;
  activityLoading.value = true;
  try {
    const params = { cursor: cursor || undefined, limit: 20 };
    const loaders = {
      bottles: () => listBottles({ ...params, ownerUserId: userId }),
      conversations: () =>
        listConversations({ ...params, memberUserId: userId }),
      reports: () => listReports({ ...params, reporterUserId: userId }),
      risks: () => listRiskEvents({ ...params, userId }),
    };
    const result = await loaders[kind]();
    if (
      detailUserId.value !== userId ||
      activityKind.value !== kind ||
      revision !== activityRevision
    )
      return;
    activityRows.value = cursor
      ? [...activityRows.value, ...(result.items || [])]
      : result.items || [];
    activityCursor.value = result.nextCursor;
  } finally {
    if (revision === activityRevision) activityLoading.value = false;
  }
}
function switchActivity() {
  activityRows.value = [];
  activityCursor.value = null;
  void loadActivity();
}

async function refreshDetail() {
  if (!detailUserId.value) return;
  await openDetail(detailUserId.value);
  await load(cursorStack.value.at(-1) || '');
}

async function revokeAll() {
  if (!detailUserId.value) return;
  const result = await promptDialog(
    '请输入操作原因代码，例如 security_incident',
    '强制退出全部会话',
    { inputValidator: validateReasonCode },
  );
  if (!result) return;
  const { value } = result;
  await revokeAppUserSessions(detailUserId.value, value.trim());
  ElMessage.success('已撤销该用户的全部会话');
  await refreshDetail();
}

async function revokeOne(sessionId: number) {
  if (!detailUserId.value) return;
  const result = await promptDialog('请输入操作原因代码', '撤销会话', {
    inputValidator: validateReasonCode,
  });
  if (!result) return;
  const { value } = result;
  await revokeAppUserSession(detailUserId.value, sessionId, value.trim());
  ElMessage.success('会话已撤销');
  await refreshDetail();
}

function openAction(kind: 'birth-date' | 'entitlement' | 'quota' | 'status') {
  action.value = kind;
  actionKey.value = crypto.randomUUID();
  Object.assign(actionForm, {
    status: 'active',
    birthDate: detail.value?.profile?.birthDate || '',
    quotaType: 'bottle_send',
    amount: 1,
    entitlementType: '',
    reasonCode: '',
    note: '',
  });
  actionOpen.value = true;
}

async function submitAction() {
  if (!detailUserId.value || !isValidReasonCode(actionForm.reasonCode)) {
    ElMessage.error('请输入有效的原因代码');
    return;
  }
  saving.value = true;
  try {
    const reasonCode = actionForm.reasonCode.trim();
    if (action.value === 'status') {
      await updateAppUserStatus(
        detailUserId.value,
        actionForm.status,
        reasonCode,
      );
    } else if (action.value === 'birth-date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(actionForm.birthDate)) {
        ElMessage.error('请选择有效的出生日期');
        return;
      }
      await updateAppUserBirthDate(
        detailUserId.value,
        actionForm.birthDate,
        reasonCode,
      );
    } else if (action.value === 'quota') {
      if (!Number.isInteger(actionForm.amount) || actionForm.amount === 0) {
        ElMessage.error('调整数量必须是非零整数');
        return;
      }
      await adjustAppUserQuota(
        detailUserId.value,
        {
          quotaType: actionForm.quotaType,
          amount: actionForm.amount,
          reasonCode,
          note: actionForm.note || null,
        },
        actionKey.value,
      );
    } else {
      if (
        !actionForm.entitlementType.trim() ||
        !Number.isInteger(actionForm.amount) ||
        actionForm.amount < 1
      ) {
        ElMessage.error('请输入权益类型与正向调整数量');
        return;
      }
      await adjustAppUserEntitlement(
        detailUserId.value,
        {
          entitlementType: actionForm.entitlementType.trim(),
          amount: actionForm.amount,
          reasonCode,
          note: actionForm.note || null,
        },
        actionKey.value,
      );
    }
    actionOpen.value = false;
    ElMessage.success('操作已完成并记录审计');
    await refreshDetail();
  } finally {
    saving.value = false;
  }
}

async function loadDeletions(cursor = '') {
  const result = await listDeletionRequests({
    cursor: cursor || undefined,
    limit: 20,
    userId: deletionFilter.userId.trim() || undefined,
    status: deletionFilter.status || undefined,
  });
  deletionRows.value = result.items || [];
  deletionCursor.value = result.nextCursor;
}

function openDeletions() {
  deletionOpen.value = true;
  deletionStack.value = [];
  void loadDeletions();
}

function searchDeletions() {
  deletionStack.value = [];
  void loadDeletions();
}
function nextDeletion() {
  if (!deletionCursor.value) return;
  deletionStack.value.push(deletionCursor.value);
  void loadDeletions(deletionCursor.value);
}
function previousDeletion() {
  deletionStack.value.pop();
  void loadDeletions(deletionStack.value.at(-1) || '');
}

async function openReview(id: number) {
  reviewTarget.value = await getDeletionRequest(id);
  Object.assign(reviewForm, { decision: 'approve', reasonCode: '', note: '' });
  reviewOpen.value = true;
}

async function submitReview() {
  if (!reviewTarget.value || !isValidReasonCode(reviewForm.reasonCode)) {
    ElMessage.error('请输入有效的复核原因代码');
    return;
  }
  saving.value = true;
  try {
    await reviewDeletionRequest(reviewTarget.value.requestId, {
      decision: reviewForm.decision,
      reasonCode: reviewForm.reasonCode.trim(),
      note: reviewForm.note.trim() || null,
    });
    reviewOpen.value = false;
    ElMessage.success('注销复核已记录');
    await loadDeletions(deletionStack.value.at(-1) || '');
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
    title="App 用户"
    description="查看用户资料、活跃状态、权益及内容安全记录。"
  >
    <template #actions>
      <ElButton v-if="canReviewDeletion" @click="openDeletions">
        注销申请复核
      </ElButton>
    </template>
    <ElCard shadow="never">
      <ElAlert
        title="认证方式显示当前绑定状态，可同时绑定多个方式；VIP 按当前有效的订阅类商品权益判断。注册时间筛选不包含尚未注册的游客。"
        type="info"
        show-icon
        :closable="false"
        class="mb-4"
      />
      <div class="admin-filter">
        <ElInput
          v-model="filters.userId"
          placeholder="用户 ID"
          clearable
          class="!w-36"
          @keyup.enter="search"
        />
        <ElInput
          v-model="filters.nickname"
          placeholder="昵称"
          clearable
          class="!w-44"
          @keyup.enter="search"
        />
        <ElSelect
          v-model="filters.status"
          clearable
          placeholder="全部状态"
          class="!w-40"
        >
          <ElOption
            v-for="(label, key) in statusLabels"
            :key="key"
            :label="label"
            :value="key"
          />
        </ElSelect>
        <ElInput
          v-model="filters.countryCode"
          placeholder="国家代码"
          maxlength="2"
          clearable
          class="!w-32"
          @keyup.enter="search"
        />
        <ElInput
          v-model="filters.interfaceLanguage"
          placeholder="界面语言"
          maxlength="16"
          clearable
          class="!w-32"
          @keyup.enter="search"
        />
        <ElSelect
          v-model="filters.bindingMethod"
          clearable
          placeholder="已绑定方式"
          class="!w-40"
        >
          <ElOption label="邮箱密码" value="email" /><ElOption
            label="Google"
            value="google"
          /><ElOption label="Apple" value="apple" />
        </ElSelect>
        <ElSelect
          v-model="filters.vipStatus"
          clearable
          placeholder="全部 VIP 状态"
          class="!w-40"
        >
          <ElOption label="VIP 有效" value="active" /><ElOption
            label="非 VIP"
            value="inactive"
          />
        </ElSelect>
        <ElDatePicker
          v-model="registeredRange"
          type="datetimerange"
          value-format="YYYY-MM-DD HH:mm:ss"
          start-placeholder="注册开始"
          end-placeholder="注册结束"
          class="!w-[350px]"
        />
        <ElDatePicker
          v-model="activeRange"
          type="datetimerange"
          value-format="YYYY-MM-DD HH:mm:ss"
          start-placeholder="活跃开始"
          end-placeholder="活跃结束"
          class="!w-[350px]"
        />
        <ElButton @click="search" type="primary">查询</ElButton>
      </div>
      <ElTable v-loading="loading" :data="rows" row-key="userId" class="w-full">
        <ElTableColumn prop="userId" label="用户 ID" min-width="110" />
        <ElTableColumn prop="nickname" label="昵称" min-width="140" />
        <ElTableColumn label="状态" width="120">
          <template #default="{ row }">
            <AdminEnumTag
              :value="row.status"
              :label="statusLabel(row.status)"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn prop="countryCode" label="国家" width="85" />
        <ElTableColumn prop="interfaceLanguage" label="语言" width="90" />
        <ElTableColumn label="已绑定方式" min-width="180">
          <template #default="{ row }">
            <span v-if="!row.emailBound && !row.googleBound && !row.appleBound">—</span><template v-else>
              <AdminEnumTag
                v-if="row.emailBound"
                value="email"
                class="mr-1"
              /><AdminEnumTag
                v-if="row.googleBound"
                value="google"
                class="mr-1"
              /><AdminEnumTag v-if="row.appleBound" value="apple" />
            </template>
          </template>
        </ElTableColumn>
        <ElTableColumn label="VIP" width="105">
          <template #default="{ row }">
            <AdminEnumTag
              :value="row.vipActive"
              :label="row.vipActive ? '有效' : '无'"
              :tone="row.vipActive ? 'success' : 'info'"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn prop="activeSessionCount" label="活跃会话" width="100" />
        <ElTableColumn prop="lastActiveAt" label="最近活跃" min-width="170">
          <template #default="{ row }">
            <AdminTime :value="row.lastActiveAt" />
          </template>
        </ElTableColumn>
        <ElTableColumn prop="registeredAt" label="注册时间" min-width="170">
          <template #default="{ row }">
            <AdminTime :value="row.registeredAt" />
          </template>
        </ElTableColumn>
        <ElTableColumn prop="createdAt" label="创建时间" min-width="170">
          <template #default="{ row }">
            <AdminTime :value="row.createdAt" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="85" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click="openDetail(row.userId)">
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
      :title="`App 用户 #${detailUserId}`"
      size="75%"
    >
      <div v-if="!detail" v-loading="true" class="h-48"></div>
      <template v-else>
        <div class="mb-5 flex flex-wrap gap-2">
          <ElButton v-if="canStatus" @click="openAction('status')">
            调整状态
          </ElButton>
          <ElButton v-if="canUpdateBirthDate" @click="openAction('birth-date')">
            更正出生日期
          </ElButton>
          <ElButton v-if="canQuota" @click="openAction('quota')">
            调整一次性额度
          </ElButton>
          <ElButton v-if="canEntitlement" @click="openAction('entitlement')">
            正向权益补发
          </ElButton>
          <ElButton v-if="canRevoke" type="warning" @click="revokeAll">
            强制退出全部会话
          </ElButton>
        </div>
        <ElTabs v-model="detailTab" @tab-change="detailTabChanged">
          <ElTabPane label="资料与状态" name="profile">
            <ElDescriptions :column="2" border>
              <ElDescriptionsItem label="用户 ID">
                {{ detail.user.userId }}
              </ElDescriptionsItem>
              <ElDescriptionsItem label="状态">
                <AdminEnumTag
                  :value="detail.user.status"
                  :label="statusLabel(detail.user.status)"
                />
              </ElDescriptionsItem>
              <ElDescriptionsItem label="昵称">
                {{ detail.profile?.nickname || '—' }}
              </ElDescriptionsItem>
              <ElDescriptionsItem label="国家">
                {{ detail.profile?.countryCode || '—' }}
              </ElDescriptionsItem>
              <ElDescriptionsItem v-if="canUpdateBirthDate" label="出生日期">
                {{ detail.profile?.birthDate || '—' }}
              </ElDescriptionsItem>
              <ElDescriptionsItem label="注册时间">
                <AdminTime :value="detail.user.registeredAt" />
              </ElDescriptionsItem>
              <ElDescriptionsItem label="最近活跃">
                <AdminTime :value="detail.user.lastActiveAt" />
              </ElDescriptionsItem>
              <ElDescriptionsItem label="当前处罚">
                <div
                  v-if="detail.risk?.activePenaltyTypes?.length"
                  class="flex flex-wrap gap-2"
                >
                  <AdminEnumTag
                    v-for="penalty in detail.risk.activePenaltyTypes"
                    :key="penalty"
                    :value="penalty"
                  />
                </div>
                <span v-else>无</span>
              </ElDescriptionsItem>
              <ElDescriptionsItem label="注销申请">
                <AdminEnumTag
                  v-if="detail.pendingDeletion"
                  :value="detail.pendingDeletion.status"
                /><span v-else>无</span>
              </ElDescriptionsItem>
            </ElDescriptions>
            <ElAlert
              v-if="detail.imAccount?.status === 'temporarily_unavailable'"
              class="mt-4"
              title="即时通讯服务暂时不可用"
              type="warning"
              show-icon
              :closable="false"
            />
          </ElTabPane>
          <ElTabPane label="额度与权益" name="quota">
            <ElDescriptions :column="2" border>
              <ElDescriptionsItem label="额度日期">
                {{ detail.quota.quotaDate }}
              </ElDescriptionsItem>
              <ElDescriptionsItem label="重置时间">
                <AdminTime :value="detail.quota.resetAt" />
              </ElDescriptionsItem>
              <ElDescriptionsItem label="投放剩余">
                {{ detail.quota.send?.dailyRemaining }}
              </ElDescriptionsItem>
              <ElDescriptionsItem label="获取剩余">
                {{ detail.quota.pick?.dailyRemaining }}
              </ElDescriptionsItem>
              <ElDescriptionsItem label="投放一次性余额">
                {{ detail.quota.send?.oneTimeRemaining }}
              </ElDescriptionsItem>
              <ElDescriptionsItem label="获取一次性余额">
                {{ detail.quota.pick?.oneTimeRemaining }}
              </ElDescriptionsItem>
            </ElDescriptions>
            <ElTable :data="detail.entitlements || []" class="mt-4">
              <ElTableColumn prop="entitlementType" label="权益类型">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.entitlementType" />
                </template>
</ElTableColumn><ElTableColumn prop="balance" label="余额" /><ElTableColumn
                prop="status"
                label="状态"
              >
                <template #default="{ row }">
                  <AdminEnumTag :value="row.status" />
                </template>
</ElTableColumn><ElTableColumn prop="expiresAt" label="到期时间">
                <template #default="{ row }">
                  <AdminTime :value="row.expiresAt" />
                </template>
              </ElTableColumn>
            </ElTable>
          </ElTabPane>
          <ElTabPane label="会话与设备" name="sessions">
            <ElTable :data="sessions" row-key="sessionId">
              <ElTableColumn prop="sessionId" label="会话 ID" /><ElTableColumn
                prop="platform"
                label="平台"
              >
                <template #default="{ row }">
                  <AdminEnumTag :value="row.platform" />
                </template>
</ElTableColumn><ElTableColumn prop="deviceModel" label="设备" /><ElTableColumn
                prop="lastUsedAt"
                label="最近使用"
              >
                <template #default="{ row }">
                  <AdminTime :value="row.lastUsedAt" />
                </template>
</ElTableColumn><ElTableColumn prop="status" label="状态">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.status" />
                </template>
</ElTableColumn><ElTableColumn v-if="canRevoke" label="操作">
                <template #default="{ row }">
                  <ElButton
                    v-if="row.status === 'active'"
                    link
                    type="danger"
                    @click="revokeOne(row.sessionId)"
                  >
                    撤销
                  </ElButton>
                </template>
              </ElTableColumn>
            </ElTable>
            <ElDivider>设备</ElDivider>
            <ElTable :data="devices" row-key="deviceId">
              <ElTableColumn prop="deviceId" label="设备 ID" /><ElTableColumn
                prop="platform"
                label="平台"
              >
                <template #default="{ row }">
                  <AdminEnumTag :value="row.platform" />
                </template>
</ElTableColumn><ElTableColumn prop="deviceModel" label="型号" /><ElTableColumn
                prop="integrityStatus"
                label="完整性"
              >
                <template #default="{ row }">
                  <AdminEnumTag :value="row.integrityStatus" />
                </template>
</ElTableColumn><ElTableColumn prop="lastActiveAt" label="最近活跃">
                <template #default="{ row }">
                  <AdminTime :value="row.lastActiveAt" />
                </template>
              </ElTableColumn>
            </ElTable>
          </ElTabPane>
          <ElTabPane label="身份绑定" name="bindings">
            <ElTable :data="bindings">
              <ElTableColumn prop="provider" label="方式">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.provider" />
                </template>
</ElTableColumn><ElTableColumn
                prop="displayValue"
                label="展示值"
              /><ElTableColumn prop="status" label="状态">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.status" />
                </template>
</ElTableColumn><ElTableColumn prop="boundAt" label="绑定时间">
                <template #default="{ row }">
                  <AdminTime :value="row.boundAt" />
                </template>
              </ElTableColumn>
</ElTable><ElDivider>绑定冲突</ElDivider><ElTable :data="conflicts">
              <ElTableColumn prop="conflictId" label="记录 ID" /><ElTableColumn
                prop="provider"
                label="方式"
              >
                <template #default="{ row }">
                  <AdminEnumTag :value="row.provider" />
                </template>
</ElTableColumn><ElTableColumn prop="createdAt" label="时间">
                <template #default="{ row }">
                  <AdminTime :value="row.createdAt" />
                </template>
              </ElTableColumn>
            </ElTable>
          </ElTabPane>
          <ElTabPane v-if="canReadOrders" label="订单与账本" name="commerce">
            <ElTabs v-model="commerceKind" @tab-change="switchCommerce">
              <ElTabPane label="订单" name="orders" /><ElTabPane
                label="权益账本"
                name="entitlements"
              /><ElTabPane label="金币账本" name="coins" />
            </ElTabs>
            <ElTable
              v-if="commerceKind === 'orders'"
              v-loading="commerceLoading"
              :data="commerceRows"
              row-key="orderId"
            >
              <ElTableColumn
                prop="orderId"
                label="订单 ID"
                width="100"
              /><ElTableColumn
                prop="orderNo"
                label="订单号"
                min-width="170"
              /><ElTableColumn
                prop="internalCode"
                label="商品"
                min-width="130"
              /><ElTableColumn prop="status" label="状态" width="120">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.status" />
                </template>
</ElTableColumn><ElTableColumn
                prop="amountMinor"
                label="最小货币单位金额"
                width="155"
              /><ElTableColumn
                prop="currency"
                label="币种"
                width="85"
              /><ElTableColumn
                prop="createdAt"
                label="创建时间"
                min-width="165"
              >
                <template #default="{ row }">
                  <AdminTime :value="row.createdAt" />
                </template>
</ElTableColumn><ElTableColumn label="操作" width="80">
                <template #default="{ row }">
                  <ElButton
                    link
                    type="primary"
                    @click="openOrderDetail(row.orderId)"
                  >
                    详情
                  </ElButton>
                </template>
              </ElTableColumn>
            </ElTable>
            <ElTable
              v-else-if="commerceKind === 'entitlements'"
              v-loading="commerceLoading"
              :data="commerceRows"
              row-key="ledgerId"
            >
              <ElTableColumn
                prop="ledgerId"
                label="流水 ID"
                width="100"
              /><ElTableColumn
                prop="entitlementType"
                label="权益类型"
                min-width="150"
              >
                <template #default="{ row }">
                  <AdminEnumTag :value="row.entitlementType" />
                </template>
</ElTableColumn><ElTableColumn prop="operation" label="操作" width="105">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.operation" />
                </template>
</ElTableColumn><ElTableColumn
                prop="changeAmount"
                label="变动"
                width="95"
              /><ElTableColumn
                prop="balanceAfter"
                label="变动后"
                width="95"
              /><ElTableColumn prop="sourceType" label="来源" width="110">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.sourceType" />
                </template>
</ElTableColumn><ElTableColumn prop="createdAt" label="创建时间" min-width="165">
                <template #default="{ row }">
                  <AdminTime :value="row.createdAt" />
                </template>
              </ElTableColumn>
            </ElTable>
            <ElTable
              v-else
              v-loading="commerceLoading"
              :data="commerceRows"
              row-key="ledgerId"
            >
              <ElTableColumn
                prop="ledgerId"
                label="流水 ID"
                width="100"
              /><ElTableColumn prop="operation" label="操作" width="110">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.operation" />
                </template>
</ElTableColumn><ElTableColumn
                prop="amount"
                label="变动"
                width="95"
              /><ElTableColumn
                prop="balanceAfter"
                label="变动后"
                width="95"
              /><ElTableColumn prop="sourceType" label="来源" width="120">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.sourceType" />
                </template>
</ElTableColumn><ElTableColumn
                prop="orderId"
                label="关联订单"
                width="110"
              /><ElTableColumn
                prop="createdAt"
                label="创建时间"
                min-width="165"
              >
                <template #default="{ row }">
                  <AdminTime :value="row.createdAt" />
                </template>
              </ElTableColumn>
            </ElTable>
            <div v-if="commerceCursor" class="admin-pagination">
              <ElButton
                :loading="commerceLoading"
                @click="loadCommerce(commerceCursor || '')"
              >
                加载更多
              </ElButton>
            </div>
          </ElTabPane>
          <ElTabPane
            v-if="canReadActivity"
            label="内容与安全记录"
            name="activity"
          >
            <ElAlert
              title="这里只展示业务元数据；完整漂流瓶内容、举报证据和消息上下文需在对应治理页面填写原因后受控查看。"
              type="info"
              show-icon
              :closable="false"
              class="mb-4"
            />
            <ElTabs v-model="activityKind" @tab-change="switchActivity">
              <ElTabPane
                v-if="canReadBottles"
                label="发布的漂流瓶"
                name="bottles"
              /><ElTabPane
                v-if="canReadConversations"
                label="参与的会话"
                name="conversations"
              /><ElTabPane
                v-if="canReadReports"
                label="发起的举报"
                name="reports"
              /><ElTabPane v-if="canReadRisk" label="风险事件" name="risks" />
            </ElTabs>
            <ElTable
              v-if="activityKind === 'bottles'"
              v-loading="activityLoading"
              :data="activityRows"
              row-key="bottleId"
            >
              <ElTableColumn
                prop="bottleId"
                label="漂流瓶 ID"
                width="120"
              /><ElTableColumn prop="contentType" label="类型" width="105">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.contentType" />
                </template>
</ElTableColumn><ElTableColumn prop="status" label="状态" width="120">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.status" />
                </template>
</ElTableColumn><ElTableColumn prop="reviewStatus" label="审核状态" width="120">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.reviewStatus" />
                </template>
</ElTableColumn><ElTableColumn
                prop="reportCount"
                label="举报数"
                width="90"
              /><ElTableColumn
                prop="createdAt"
                label="创建时间"
                min-width="175"
              >
                <template #default="{ row }">
                  <AdminTime :value="row.createdAt" />
                </template>
              </ElTableColumn>
            </ElTable>
            <ElTable
              v-else-if="activityKind === 'conversations'"
              v-loading="activityLoading"
              :data="activityRows"
              row-key="conversationId"
            >
              <ElTableColumn
                prop="conversationId"
                label="会话 ID"
                width="115"
              /><ElTableColumn prop="type" label="类型" width="110">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.type" />
                </template>
</ElTableColumn><ElTableColumn prop="status" label="状态" width="120">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.status" />
                </template>
</ElTableColumn><ElTableColumn
                prop="memberCount"
                label="成员数"
                width="90"
              /><ElTableColumn
                prop="messageCount"
                label="消息数"
                width="90"
              /><ElTableColumn
                prop="lastMessageAt"
                label="最近消息"
                min-width="175"
              >
                <template #default="{ row }">
                  <AdminTime :value="row.lastMessageAt" />
                </template>
              </ElTableColumn>
            </ElTable>
            <ElTable
              v-else-if="activityKind === 'reports'"
              v-loading="activityLoading"
              :data="activityRows"
              row-key="reportId"
            >
              <ElTableColumn
                prop="reportId"
                label="举报 ID"
                width="105"
              /><ElTableColumn prop="targetType" label="目标类型" width="110">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.targetType" />
                </template>
</ElTableColumn><ElTableColumn
                prop="targetId"
                label="目标 ID"
                min-width="125"
              /><ElTableColumn
                prop="reasonCode"
                label="原因"
                min-width="125"
              /><ElTableColumn prop="priority" label="优先级" width="105">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.priority" />
                </template>
</ElTableColumn><ElTableColumn prop="status" label="状态" width="120">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.status" />
                </template>
</ElTableColumn><ElTableColumn prop="createdAt" label="提交时间" min-width="175">
                <template #default="{ row }">
                  <AdminTime :value="row.createdAt" />
                </template>
              </ElTableColumn>
            </ElTable>
            <ElTable
              v-else
              v-loading="activityLoading"
              :data="activityRows"
              row-key="eventId"
            >
              <ElTableColumn
                prop="eventId"
                label="事件 ID"
                width="105"
              /><ElTableColumn
                prop="eventType"
                label="事件类型"
                min-width="155"
              /><ElTableColumn prop="severity" label="严重程度" width="105">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.severity" />
                </template>
</ElTableColumn><ElTableColumn prop="sourceType" label="来源" width="115">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.sourceType" />
                </template>
</ElTableColumn><ElTableColumn
                prop="reasonCode"
                label="原因"
                min-width="125"
              /><ElTableColumn
                prop="occurredAt"
                label="发生时间"
                min-width="175"
              >
                <template #default="{ row }">
                  <AdminTime :value="row.occurredAt" />
                </template>
              </ElTableColumn>
            </ElTable>
            <div v-if="activityCursor" class="admin-pagination">
              <ElButton
                :loading="activityLoading"
                @click="loadActivity(activityCursor || '')"
              >
                加载更多
              </ElButton>
            </div>
          </ElTabPane>
          <ElTabPane label="状态记录" name="history">
            <ElTable :data="detail.recentStatusLogs">
              <ElTableColumn prop="fromStatus" label="原状态">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.fromStatus" />
                </template>
</ElTableColumn><ElTableColumn prop="toStatus" label="新状态">
                <template #default="{ row }">
                  <AdminEnumTag :value="row.toStatus" />
                </template>
</ElTableColumn><ElTableColumn
                prop="reasonCode"
                label="原因代码"
              /><ElTableColumn prop="createdAt" label="时间">
                <template #default="{ row }">
                  <AdminTime :value="row.createdAt" />
                </template>
              </ElTableColumn>
            </ElTable>
          </ElTabPane>
        </ElTabs>
      </template>
    </ElDrawer>

    <ElDialog
      v-model="orderDetailOpen"
      :title="`订单 #${orderDetail?.order.orderId || ''}`"
      width="70%"
      @closed="orderDetail = null"
    >
      <template v-if="orderDetail">
        <ElDescriptions :column="2" border>
          <ElDescriptionsItem label="订单号">
            {{ orderDetail.order.orderNo }}
</ElDescriptionsItem><ElDescriptionsItem label="状态">
            <AdminEnumTag
              :value="orderDetail.order.status"
            />
</ElDescriptionsItem><ElDescriptionsItem label="商品">
            {{ orderDetail.order.internalCode }}
</ElDescriptionsItem><ElDescriptionsItem label="金额">
            {{ orderDetail.order.amountMinor }}
            {{ orderDetail.order.currency }}（最小货币单位）
          </ElDescriptionsItem>
</ElDescriptions><ElDivider>支付交易</ElDivider><ElTable :data="orderDetail.transactions">
          <ElTableColumn prop="transactionId" label="交易 ID" /><ElTableColumn
            prop="transactionType"
            label="类型"
          >
            <template #default="{ row }">
              <AdminEnumTag :value="row.transactionType" />
            </template>
</ElTableColumn><ElTableColumn prop="status" label="状态">
            <template #default="{ row }">
              <AdminEnumTag :value="row.status" />
            </template>
</ElTableColumn><ElTableColumn prop="verifiedAt" label="验证时间">
            <template #default="{ row }">
              <AdminTime :value="row.verifiedAt" />
            </template>
          </ElTableColumn>
</ElTable><ElDivider>权益流水</ElDivider><ElTable :data="orderDetail.entitlementLedger">
          <ElTableColumn prop="ledgerId" label="流水 ID" /><ElTableColumn
            prop="entitlementType"
            label="权益"
          >
            <template #default="{ row }">
              <AdminEnumTag :value="row.entitlementType" />
            </template>
</ElTableColumn><ElTableColumn prop="changeAmount" label="变动" /><ElTableColumn
            prop="createdAt"
            label="时间"
          >
            <template #default="{ row }">
              <AdminTime :value="row.createdAt" />
            </template>
          </ElTableColumn>
</ElTable><ElDivider>金币流水</ElDivider><ElTable :data="orderDetail.coinLedger">
          <ElTableColumn prop="ledgerId" label="流水 ID" /><ElTableColumn
            prop="amount"
            label="变动"
          /><ElTableColumn prop="createdAt" label="时间">
            <template #default="{ row }">
              <AdminTime :value="row.createdAt" />
            </template>
          </ElTableColumn>
        </ElTable>
      </template>
    </ElDialog>

    <ElDialog
      v-model="actionOpen"
      :title="
        action === 'status'
          ? '调整用户状态'
          : action === 'birth-date'
            ? '更正出生日期'
            : action === 'quota'
              ? '调整一次性额度'
              : '正向权益补发'
      "
      width="520px"
      destroy-on-close
    >
      <ElAlert
        v-if="action === 'birth-date'"
        title="更正会修改用户资料并重新记录最低年龄核验时间；服务端按业务时区校验年龄须在 18 至 120 岁之间。此操作将写入敏感访问审计和资料变更记录。"
        type="warning"
        show-icon
        :closable="false"
        class="mb-4"
      />
      <ElForm label-position="top" @submit.prevent="submitAction">
        <ElFormItem v-if="action === 'status'" label="目标状态">
          <ElSelect v-model="actionForm.status" class="w-full">
            <ElOption label="正常" value="active" /><ElOption
              label="暂停"
              value="suspended"
            /><ElOption label="封禁" value="banned" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem v-if="action === 'birth-date'" label="更正后的出生日期">
          <ElDatePicker
            v-model="actionForm.birthDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择出生日期"
            class="!w-full"
          />
        </ElFormItem>
        <ElFormItem v-if="action === 'quota'" label="额度类型">
          <ElSelect v-model="actionForm.quotaType" class="w-full">
            <ElOption label="投放漂流瓶" value="bottle_send" /><ElOption
              label="获取漂流瓶"
              value="bottle_pick"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem v-if="action === 'entitlement'" label="权益类型">
          <ElInput
            v-model="actionForm.entitlementType"
            placeholder="输入已配置的权益类型代码"
          />
        </ElFormItem>
        <ElFormItem
          v-if="action === 'quota' || action === 'entitlement'"
          :label="
            action === 'quota' ? '调整数量（负数为扣减）' : '补发数量（仅正数）'
          "
        >
          <ElInputNumber
            v-model="actionForm.amount"
            :min="action === 'quota' ? -10000 : 1"
            :max="10000"
          />
        </ElFormItem>
        <ElFormItem label="原因代码">
          <ElInput
            v-model="actionForm.reasonCode"
            maxlength="64"
            show-word-limit
            placeholder="例如 support_correction"
          />
        </ElFormItem>
        <ElFormItem
          v-if="action === 'quota' || action === 'entitlement'"
          label="备注"
        >
          <ElInput v-model="actionForm.note" type="textarea" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="actionOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="submitAction">
          确认
        </ElButton>
      </template>
    </ElDialog>

    <ElDialog
      v-model="deletionOpen"
      title="注销申请复核"
      width="85%"
      destroy-on-close
    >
      <div class="admin-filter">
        <ElInput
          v-model="deletionFilter.userId"
          placeholder="用户 ID"
          clearable
          class="!w-40"
        />
        <ElSelect
          v-model="deletionFilter.status"
          class="!w-40"
          clearable
          placeholder="全部状态"
        >
          <ElOption label="冷静期中" value="pending" /><ElOption
            label="已取消"
            value="cancelled"
          /><ElOption label="已完成" value="completed" />
        </ElSelect>
        <ElButton @click="searchDeletions" type="primary">查询</ElButton>
      </div>
      <ElTable :data="deletionRows" row-key="requestId">
        <ElTableColumn prop="requestId" label="申请 ID" width="100" />
        <ElTableColumn prop="userId" label="用户 ID" width="100" />
        <ElTableColumn prop="nickname" label="昵称" min-width="120" />
        <ElTableColumn prop="reasonCode" label="原因" min-width="140" />
        <ElTableColumn prop="status" label="状态" width="120">
          <template #default="{ row }">
            <AdminEnumTag :value="row.status" />
          </template>
        </ElTableColumn>
        <ElTableColumn prop="requestedAt" label="申请时间" min-width="175">
          <template #default="{ row }">
            <AdminTime :value="row.requestedAt" />
          </template>
        </ElTableColumn>
        <ElTableColumn prop="scheduledFor" label="计划注销时间" min-width="175">
          <template #default="{ row }">
            <AdminTime :value="row.scheduledFor" />
          </template>
        </ElTableColumn>
        <ElTableColumn prop="reviewDecision" label="复核结论" min-width="110">
          <template #default="{ row }">
            <AdminEnumTag :value="row.reviewDecision" />
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="95">
          <template #default="{ row }">
            <ElButton
              v-if="row.status === 'pending' && !row.reviewDecision"
              link
              type="primary"
              @click="openReview(row.requestId)"
            >
              复核
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
      <div class="admin-pagination">
        <ElButton
          :disabled="deletionStack.length === 0"
          @click="previousDeletion"
        >
          上一页
</ElButton><ElButton :disabled="!deletionCursor" @click="nextDeletion">
          下一页
        </ElButton>
      </div>
    </ElDialog>

    <ElDialog
      v-model="reviewOpen"
      :title="`复核注销申请 #${reviewTarget?.requestId || ''}`"
      width="560px"
      destroy-on-close
    >
      <ElAlert
        title="复核不会跳过既有注销冷静期；正式注销由服务端流程执行。"
        type="info"
        show-icon
        :closable="false"
        class="mb-4"
      />
      <ElDescriptions v-if="reviewTarget" :column="1" border class="mb-4">
        <ElDescriptionsItem label="用户 ID">
          {{ reviewTarget.userId }}
</ElDescriptionsItem><ElDescriptionsItem label="申请原因">
          {{ reviewTarget.reasonCode }}
</ElDescriptionsItem><ElDescriptionsItem label="原因补充">
          {{ reviewTarget.reasonText || '—' }}
</ElDescriptionsItem><ElDescriptionsItem label="计划注销">
          <AdminTime :value="reviewTarget.scheduledFor" />
        </ElDescriptionsItem>
      </ElDescriptions>
      <ElForm label-position="top" @submit.prevent="submitReview">
        <ElFormItem label="复核结论">
          <ElRadioGroup v-model="reviewForm.decision">
            <ElRadio value="approve">通过</ElRadio><ElRadio value="reject">驳回</ElRadio>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem label="原因代码">
          <ElInput
            v-model="reviewForm.reasonCode"
            maxlength="64"
            show-word-limit
            placeholder="例如 support_verified"
          />
        </ElFormItem>
        <ElFormItem label="备注">
          <ElInput
            v-model="reviewForm.note"
            type="textarea"
            maxlength="1000"
            show-word-limit
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="reviewOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="submitReview">
          提交复核
        </ElButton>
      </template>
    </ElDialog>
  </AdminPage>
</template>
