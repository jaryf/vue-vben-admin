<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useTimezoneStore } from '@vben/stores';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  assignReport, getAppeal, getReport, listAppeals, listReports,
  resolveAppeal, resolveReport,
} from '#/api/safety-cases';
import type { AppealCase, AppealDetail, ReportCase, ReportDetail } from '#/api/safety-cases';
import AdminTime from '#/components/admin-time.vue';
import { adminDateTimeRangeToUtc } from '#/utils/admin-datetime';
import { isValidReasonCode, validateReasonCode } from '#/utils/reason-code';

const props = defineProps<{ kind: 'appeal' | 'report' }>();
const { hasAccessByCodes } = useAccess();
const timezoneStore = useTimezoneStore();
const isReport = computed(() => props.kind === 'report');
const canEvidence = computed(() => hasAccessByCodes([isReport.value ? 'report.evidence.read_sensitive' : 'appeal.evidence.read_sensitive']));
const canAssign = computed(() => isReport.value && hasAccessByCodes(['report.assign']));
const canResolve = computed(() => hasAccessByCodes([isReport.value ? 'report.resolve' : 'appeal.resolve']));
const rows = ref<Array<AppealCase | ReportCase>>([]);
const nextCursor = ref<string | null>(null);
const cursorStack = ref<string[]>([]);
const loading = ref(false);
const saving = ref(false);
const detailOpen = ref(false);
const detail = ref<AppealDetail | ReportDetail | null>(null);
const assignOpen = ref(false);
const resolving = ref<AppealCase | ReportCase | null>(null);
const resolveOpen = ref(false);
const filter = reactive({ status: '', priority: '', targetType: '', userId: '', assignedAdminId: '', createdRange: [] as string[] });
const appliedFilter = ref<Record<string, unknown>>({});
const assignment = reactive({ reportId: 0, assignedAdminId: 0, priority: 'normal' });
const resolution = reactive({ decision: '', resolutionCode: '' });
const reportStatuses = ['submitted', 'triaging', 'reviewing', 'resolved_valid', 'resolved_invalid', 'closed_duplicate', 'appealed', 'appeal_resolved'];
const appealStatuses = ['submitted', 'reviewing', 'resolved_approved', 'resolved_rejected', 'closed_duplicate'];
const reportTargets = [['user', '用户'], ['bottle', '漂流瓶'], ['message', '消息'], ['conversation', '会话'], ['virtual_identity', '虚拟身份']];
const appealTargets = [['bottle_review', '漂流瓶审核']];
const priorities = [['low', '低'], ['normal', '普通'], ['high', '高'], ['urgent', '紧急']];
const statusLabels: Record<string, string> = {
  submitted: '已提交', triaging: '分诊中', reviewing: '处理中',
  resolved_valid: '举报属实', resolved_invalid: '举报不成立', closed_duplicate: '重复案件',
  appealed: '已申诉', appeal_resolved: '申诉已结',
  resolved_approved: '申诉通过', resolved_rejected: '申诉驳回',
};
const statusText = (value: string) => statusLabels[value] || value;

async function load(cursor = '') {
  loading.value = true;
  try {
    const params = { ...appliedFilter.value, cursor: cursor || undefined, limit: 20 };
    const result = isReport.value ? await listReports(params) : await listAppeals(params);
    rows.value = result.items || [];
    nextCursor.value = result.nextCursor;
  } finally { loading.value = false; }
}
function search() {
  let createdRange: [string, string] | undefined;
  try {
    createdRange = adminDateTimeRangeToUtc(
      filter.createdRange,
      timezoneStore.timezone,
    );
  } catch (error) {
    ElMessage.warning(error instanceof Error ? error.message : '提交时间范围无效');
    return;
  }
  appliedFilter.value = {
    status: filter.status || undefined,
    priority: isReport.value ? filter.priority || undefined : undefined,
    targetType: filter.targetType || undefined,
    [isReport.value ? 'reporterUserId' : 'appellantUserId']: filter.userId || undefined,
    assignedAdminId: filter.assignedAdminId || undefined,
    createdFrom: createdRange?.[0],
    createdUntil: createdRange?.[1],
  };
  cursorStack.value = [];
  void load();
}
function next() { if (!nextCursor.value) return; cursorStack.value.push(nextCursor.value); void load(nextCursor.value); }
function previous() { cursorStack.value.pop(); void load(cursorStack.value.at(-1) || ''); }

async function openDetail(row: AppealCase | ReportCase) {
  const { value } = await ElMessageBox.prompt('请输入本次查看的审计原因代码', '敏感证据查看', {
    inputValidator: validateReasonCode,
  });
  detail.value = isReport.value
    ? await getReport((row as ReportCase).reportId, value.trim())
    : await getAppeal((row as AppealCase).appealId, value.trim());
  detailOpen.value = true;
}
function openAssign(row: ReportCase) {
  Object.assign(assignment, { reportId: row.reportId, assignedAdminId: row.assignedAdminId || 0, priority: row.priority || 'normal' });
  assignOpen.value = true;
}
async function saveAssign() {
  if (assignment.assignedAdminId < 1) { ElMessage.error('请输入有效管理员 ID'); return; }
  saving.value = true;
  try {
    await assignReport(assignment.reportId, assignment.assignedAdminId, assignment.priority);
    assignOpen.value = false; ElMessage.success('举报已分派'); await load(cursorStack.value.at(-1) || '');
  } finally { saving.value = false; }
}
function openResolve(row: AppealCase | ReportCase) {
  resolving.value = row;
  Object.assign(resolution, { decision: '', resolutionCode: '' });
  resolveOpen.value = true;
}
async function saveResolve() {
  if (!resolving.value || !resolution.decision || !isValidReasonCode(resolution.resolutionCode)) {
    ElMessage.error('请选择决策并填写有效处理原因代码'); return;
  }
  saving.value = true;
  try {
    if (isReport.value) await resolveReport((resolving.value as ReportCase).reportId, resolution.decision, resolution.resolutionCode.trim().toLowerCase());
    else await resolveAppeal((resolving.value as AppealCase).appealId, resolution.decision, resolution.resolutionCode.trim().toLowerCase());
    resolveOpen.value = false; ElMessage.success('案件已处理'); await load(cursorStack.value.at(-1) || '');
  } finally { saving.value = false; }
}
function snapshotText(value: unknown) { return typeof value === 'string' ? value : JSON.stringify(value, null, 2); }
onMounted(search);
</script>

<template>
  <div class="p-5">
    <ElCard shadow="never">
      <template #header>{{ isReport ? '举报管理' : '申诉管理' }}</template>
      <ElAlert title="证据查看需要单次填写原因，服务端会记录管理员、案件与审计原因。" type="info" show-icon :closable="false" class="mb-4" />
      <div class="mb-4 flex flex-wrap gap-3">
        <ElSelect v-model="filter.status" clearable placeholder="全部状态" class="!w-40"><ElOption v-for="status in isReport ? reportStatuses : appealStatuses" :key="status" :label="statusText(status)" :value="status" /></ElSelect>
        <ElSelect v-model="filter.targetType" clearable placeholder="全部目标" class="!w-36"><ElOption v-for="[value, label] in isReport ? reportTargets : appealTargets" :key="value" :label="label" :value="value" /></ElSelect>
        <ElSelect v-if="isReport" v-model="filter.priority" clearable placeholder="全部优先级" class="!w-36"><ElOption v-for="[value, label] in priorities" :key="value" :label="label" :value="value" /></ElSelect>
        <ElInput v-model="filter.userId" :placeholder="isReport ? '举报人 ID' : '申诉人 ID'" clearable class="!w-36" />
        <ElInput v-model="filter.assignedAdminId" placeholder="分派管理员 ID" clearable class="!w-40" />
        <ElDatePicker v-model="filter.createdRange" type="datetimerange" value-format="YYYY-MM-DD HH:mm:ss" range-separator="至" start-placeholder="提交开始" end-placeholder="提交结束" class="!w-[390px]" />
        <ElButton @click="search">查询</ElButton>
      </div>
      <ElTable v-loading="loading" :data="rows" :row-key="isReport ? 'reportId' : 'appealId'">
        <ElTableColumn :prop="isReport ? 'reportId' : 'appealId'" label="案件 ID" width="105" />
        <ElTableColumn :prop="isReport ? 'reporterUserId' : 'appellantUserId'" :label="isReport ? '举报人 ID' : '申诉人 ID'" width="105" />
        <ElTableColumn prop="targetType" label="目标类型" width="130" /><ElTableColumn prop="targetId" label="目标 ID" min-width="140" />
        <ElTableColumn v-if="isReport" prop="reasonCode" label="举报原因" min-width="145" />
        <ElTableColumn label="状态" width="130"><template #default="{ row }">{{ statusText(row.status) }}</template></ElTableColumn>
        <ElTableColumn v-if="isReport" prop="priority" label="优先级" width="100" />
        <ElTableColumn prop="assignedAdminId" label="分派管理员" width="120" /><ElTableColumn prop="createdAt" label="提交时间" min-width="175"><template #default="{ row }"><AdminTime :value="row.createdAt" /></template></ElTableColumn>
        <ElTableColumn label="操作" width="200" fixed="right"><template #default="{ row }"><ElButton v-if="canEvidence" link type="primary" @click="openDetail(row)">证据</ElButton><ElButton v-if="canAssign" link type="primary" @click="openAssign(row)">分派</ElButton><ElButton v-if="canResolve && ['submitted', 'triaging', 'reviewing'].includes(row.status)" link type="success" @click="openResolve(row)">处理</ElButton></template></ElTableColumn>
      </ElTable>
      <div class="mt-4 flex justify-end gap-2"><ElButton :disabled="cursorStack.length === 0" @click="previous">上一页</ElButton><ElButton :disabled="!nextCursor" @click="next">下一页</ElButton></div>
    </ElCard>
    <ElDrawer v-model="detailOpen" :title="isReport ? '举报证据' : '申诉证据'" size="60%" @closed="detail = null">
      <template v-if="detail"><ElDescriptions :column="1" border><ElDescriptionsItem label="案件 ID">{{ 'report' in detail ? detail.report.reportId : detail.appeal.appealId }}</ElDescriptionsItem><ElDescriptionsItem label="状态">{{ statusText('report' in detail ? detail.report.status : detail.appeal.status) }}</ElDescriptionsItem><ElDescriptionsItem label="描述">{{ 'report' in detail ? detail.report.description || '—' : detail.description || '—' }}</ElDescriptionsItem></ElDescriptions><template v-if="'report' in detail"><ElDivider>保留中的证据快照</ElDivider><ElTable :data="detail.evidence"><ElTableColumn prop="evidenceId" label="证据 ID" width="100" /><ElTableColumn prop="evidenceType" label="类型" width="120" /><ElTableColumn label="快照" min-width="260"><template #default="{ row }"><pre class="whitespace-pre-wrap break-all">{{ snapshotText(row.snapshot) }}</pre></template></ElTableColumn><ElTableColumn prop="retentionUntil" label="保留至" width="170"><template #default="{ row }"><AdminTime :value="row.retentionUntil" /></template></ElTableColumn></ElTable></template><template v-else><ElDivider>证据媒体 ID</ElDivider><div>{{ detail.evidenceMediaIds.join('、') || '无' }}</div></template></template>
    </ElDrawer>
    <ElDialog v-model="assignOpen" title="分派举报" width="500px"><ElForm label-width="120px"><ElFormItem label="管理员 ID"><ElInputNumber v-model="assignment.assignedAdminId" :min="1" /></ElFormItem><ElFormItem label="优先级"><ElSelect v-model="assignment.priority"><ElOption label="低" value="low" /><ElOption label="普通" value="normal" /><ElOption label="高" value="high" /><ElOption label="紧急" value="urgent" /></ElSelect></ElFormItem></ElForm><template #footer><ElButton @click="assignOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="saveAssign">分派</ElButton></template></ElDialog>
    <ElDialog v-model="resolveOpen" :title="isReport ? '处理举报' : '处理申诉'" width="500px"><ElForm label-width="120px"><ElFormItem label="处理决策"><ElSelect v-model="resolution.decision" placeholder="请选择"><template v-if="isReport"><ElOption label="属实" value="valid" /><ElOption label="不成立" value="invalid" /><ElOption label="重复案件" value="duplicate" /></template><template v-else><ElOption label="通过" value="approve" /><ElOption label="驳回" value="reject" /><ElOption label="重复案件" value="duplicate" /></template></ElSelect></ElFormItem><ElFormItem label="原因代码"><ElInput v-model="resolution.resolutionCode" maxlength="64" show-word-limit placeholder="稳定原因代码，1–64 位" /></ElFormItem></ElForm><template #footer><ElButton @click="resolveOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="saveResolve">确认处理</ElButton></template></ElDialog>
  </div>
</template>
