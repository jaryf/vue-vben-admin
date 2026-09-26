<script setup lang="ts">
import type { DataExportTask } from '#/api/data-exports';
import type { DataExportDataset } from '#/constants/data-export';

import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useTimezoneStore, useUserStore } from '@vben/stores';

import {
  ElAlert,
  ElButton,
  ElCard,
  ElDatePicker,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
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
  approveDataExport,
  createDataExport,
  downloadDataExport,
  getDataExport,
  listDataExports,
  rejectDataExport,
} from '#/api/data-exports';
import AdminEnumTag from '#/components/admin-enum-tag.vue';
import AdminPage from '#/components/admin-page.vue';
import AdminTime from '#/components/admin-time.vue';
import {
  DATA_EXPORT_DATASET_CONFIG,
  DATA_EXPORT_DATASETS,
} from '#/constants/data-export';
import {
  adminDateTimeRangeToUtc,
  utcToAdminDateTime,
} from '#/utils/admin-datetime';
import { promptDialog } from '#/utils/message-box';
import { validateReasonCode } from '#/utils/reason-code';

const { hasAccessByCodes } = useAccess();
const userStore = useUserStore();
const timezoneStore = useTimezoneStore();
const canApprove = computed(() => hasAccessByCodes(['data_export.approve']));
const canDownload = computed(() => hasAccessByCodes(['data_export.download']));
const currentUserId = computed(() => {
  const value = Number(userStore.userInfo?.userId);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
});
const rows = ref<DataExportTask[]>([]);
const nextCursor = ref<null | string>(null);
const cursorStack = ref<string[]>([]);
const loading = ref(false);
const saving = ref(false);
const editorOpen = ref(false);
const detailOpen = ref(false);
const detail = ref<DataExportTask | null>(null);
const status = ref('');
const form = reactive<{
  dataset: DataExportDataset;
  purpose: string;
  range: null | string[];
}>({ dataset: 'audit_logs', range: [], purpose: '' });
const canUseDataset = (dataset: DataExportDataset) =>
  DATA_EXPORT_DATASET_CONFIG[dataset].permissions.every((code) =>
    hasAccessByCodes([code]),
  );
const selectableDatasets = computed(() =>
  DATA_EXPORT_DATASETS.filter((dataset) => canUseDataset(dataset)).map(
    (dataset) => [dataset, DATA_EXPORT_DATASET_CONFIG[dataset].label] as const,
  ),
);
const canRequest = computed(
  () =>
    hasAccessByCodes(['data_export.request']) &&
    selectableDatasets.value.length > 0,
);
const datasetText = (value: DataExportDataset) =>
  DATA_EXPORT_DATASET_CONFIG[value]?.label || value;
const statusText = (value: string) =>
  ({
    pending: '待审批',
    queued: '排队生成',
    ready: '可下载',
    rejected: '已驳回',
    expired: '已过期',
    failed: '生成失败',
  })[value as DataExportTask['status']] || value;
const failureLabels: Record<string, string> = {
  ROW_LIMIT_EXCEEDED: '超过 10,000 行上限',
  GENERATION_FAILED: '生成出错，请联系管理员重新申请',
};
const failureText = (value?: null | string) =>
  failureLabels[value || ''] || value || '—';

async function load(cursor = '') {
  loading.value = true;
  try {
    const result = await listDataExports({
      status: status.value || undefined,
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
function openEditor() {
  form.dataset = selectableDatasets.value[0]?.[0] || 'audit_logs';
  form.range = [
    utcToAdminDateTime(Date.now() - 24 * 3_600_000, timezoneStore.timezone),
    utcToAdminDateTime(Date.now() - 1000, timezoneStore.timezone),
  ];
  form.purpose = '';
  editorOpen.value = true;
}
async function save() {
  if (
    form.range?.length !== 2 ||
    form.purpose.trim().length < 10 ||
    form.purpose.trim().length > 200
  ) {
    ElMessage.error('请填写 10 至 200 字的用途并选择时间范围');
    return;
  }
  let utcRange: [string, string];
  try {
    const parsed = adminDateTimeRangeToUtc(form.range, timezoneStore.timezone);
    if (!parsed) throw new Error('请选择完整的时间范围');
    utcRange = parsed;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '时间范围无效');
    return;
  }
  const [fromAt, toAt] = utcRange;
  if (
    Date.parse(toAt) - Date.parse(fromAt) > 30 * 24 * 3_600_000 ||
    Date.parse(toAt) > Date.now()
  ) {
    ElMessage.error('时间范围不得超过 30 天或包含未来时间');
    return;
  }
  saving.value = true;
  try {
    await createDataExport(
      { dataset: form.dataset, fromAt, toAt, purpose: form.purpose.trim() },
      crypto.randomUUID(),
    );
    editorOpen.value = false;
    ElMessage.success('导出申请已提交，等待其他管理员审批');
    await load();
  } finally {
    saving.value = false;
  }
}
async function openDetail(row: DataExportTask) {
  detail.value = await getDataExport(row.exportId);
  detailOpen.value = true;
}
async function review(row: DataExportTask, approve: boolean) {
  const result = await promptDialog(
    approve ? '可填写审批说明' : '请输入驳回原因',
    approve ? '批准导出' : '驳回导出',
    {
      inputValidator: (text) => {
        if (text.length > 500) return '最多 500 字';
        return !approve && !text.trim() ? '请填写驳回原因' : true;
      },
    },
  );
  if (!result) return;
  const { value } = result;
  await (approve
    ? approveDataExport(row.exportId, value)
    : rejectDataExport(row.exportId, value));
  ElMessage.success('审批结果已保存');
  await load(cursorStack.value.at(-1) || '');
}
async function download(row: DataExportTask) {
  const result = await promptDialog(
    '请输入此次下载的审计原因代码',
    '下载数据导出',
    { inputValidator: validateReasonCode },
  );
  if (!result) return;
  const { value } = result;
  const blob = await downloadDataExport(row.exportId, value.trim());
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = `driftly-${row.dataset}-${row.exportId}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
onMounted(() => {
  void load();
});
</script>

<template>
  <AdminPage
    title="异步数据导出"
    description="按用途申请导出，跟踪审批、生成与下载进度。"
  >
    <template #actions>
      <ElButton v-if="canRequest" type="primary" @click="openEditor">
        申请导出
      </ElButton>
</template><ElCard shadow="never">
      <ElAlert
        class="mb-4"
        type="info"
        show-icon
        :closable="false"
        title="可按权限导出审计、用户、商业化、AI、安全治理、配置版本、法律文档、官网内容与联系数据。会话与消息仅含本地元数据，审核证据只含脱敏文本与媒体 ID。用户完整邮箱、完整资料、设备元数据、漂流瓶内容、举报证据、申诉说明和联系往来正文需要各自的敏感权限。设备导出不含安装标识哈希、IP 哈希和 Push Token。单次最多 30 天、10,000 行；申请人与审批人必须不同。生成后 24 小时过期，下载链接仅可使用一次、最长有效 60 秒。"
      />
      <div class="admin-filter">
        <ElSelect
          v-model="status"
          clearable
          placeholder="全部状态"
          class="!w-36"
        >
          <ElOption label="待审批" value="pending" /><ElOption
            label="排队生成"
            value="queued"
          /><ElOption label="可下载" value="ready" /><ElOption
            label="已驳回"
            value="rejected"
          /><ElOption label="已过期" value="expired" /><ElOption
            label="生成失败"
            value="failed"
          />
</ElSelect><ElButton type="primary" @click="search">查询</ElButton><ElButton @click="load(cursorStack.at(-1) || '')">刷新</ElButton>
      </div>
      <ElTable v-loading="loading" :data="rows" row-key="exportId">
        <ElTableColumn
          prop="exportId"
          label="任务 ID"
          width="95"
        /><!-- @vue-generic {DataExportTask} --><ElTableColumn
          label="数据集"
          min-width="155"
        >
          <template #default="{ row }">
            <AdminEnumTag
              :value="row.dataset"
              :label="datasetText(row.dataset)"
            />
          </template>
</ElTableColumn><!-- @vue-generic {DataExportTask} --><ElTableColumn
          label="状态"
          width="120"
        >
          <template #default="{ row }">
            <AdminEnumTag :value="row.status" :label="statusText(row.status)" />
          </template>
</ElTableColumn><ElTableColumn
          prop="requestedBy"
          label="申请人"
          width="95"
        /><ElTableColumn
          prop="reviewedBy"
          label="审批人"
          width="95"
        /><ElTableColumn
          prop="rowCount"
          label="行数"
          width="85"
        /><!-- @vue-generic {DataExportTask} --><ElTableColumn
          prop="expiresAt"
          label="下载截止"
          min-width="175"
        >
          <template #default="{ row }">
            <AdminTime :value="row.expiresAt" />
          </template>
</ElTableColumn><!-- @vue-generic {DataExportTask} --><ElTableColumn
          label="操作"
          width="210"
          fixed="right"
        >
          <template #default="{ row }">
            <ElButton link type="primary" @click="openDetail(row)">
              详情
</ElButton><ElButton
              v-if="
                canApprove &&
                canUseDataset(row.dataset) &&
                row.status === 'pending' &&
                row.requestedBy !== currentUserId
              "
              link
              type="success"
              @click="review(row, true)"
            >
              批准
</ElButton><ElButton
              v-if="
                canApprove &&
                canUseDataset(row.dataset) &&
                row.status === 'pending' &&
                row.requestedBy !== currentUserId
              "
              link
              type="warning"
              @click="review(row, false)"
            >
              驳回
</ElButton><ElButton
              v-if="
                canDownload &&
                canUseDataset(row.dataset) &&
                row.status === 'ready' &&
                row.requestedBy === currentUserId &&
                row.expiresAt &&
                new Date(row.expiresAt).getTime() > Date.now()
              "
              link
              type="primary"
              @click="download(row)"
            >
              下载
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
      title="导出任务详情"
      size="55%"
      @closed="detail = null"
    >
      <ElDescriptions v-if="detail" :column="1" border>
        <ElDescriptionsItem label="任务 ID">
          {{ detail.exportId }}
</ElDescriptionsItem><ElDescriptionsItem label="数据集">
          <AdminEnumTag
            :value="detail.dataset"
            :label="datasetText(detail.dataset)"
          />
</ElDescriptionsItem><ElDescriptionsItem label="用途">
          {{ detail.purpose }}
</ElDescriptionsItem><ElDescriptionsItem label="时间范围">
          <AdminTime :value="detail.fromAt" /> ～
          <AdminTime :value="detail.toAt" />
</ElDescriptionsItem><ElDescriptionsItem label="状态">
          <AdminEnumTag
            :value="detail.status"
            :label="statusText(detail.status)"
          />
</ElDescriptionsItem><ElDescriptionsItem label="审批意见">
          {{ detail.reviewNote || '—' }}
</ElDescriptionsItem><ElDescriptionsItem label="生成行数">
          {{ detail.rowCount ?? '—' }}
</ElDescriptionsItem><ElDescriptionsItem label="文件 SHA-256">
          {{ detail.fileSha256 || '—' }}
</ElDescriptionsItem><ElDescriptionsItem label="过期时间">
          <AdminTime :value="detail.expiresAt" />
</ElDescriptionsItem><ElDescriptionsItem label="失败原因">
          {{ failureText(detail.failureCode) }}
        </ElDescriptionsItem>
      </ElDescriptions>
    </ElDrawer>
    <ElDialog v-model="editorOpen" title="申请数据导出" width="600px">
      <ElForm label-width="100px">
        <ElFormItem label="数据集">
          <ElSelect v-model="form.dataset">
            <ElOption
              v-for="entry in selectableDatasets"
              :key="entry[0]"
              :label="entry[1]"
              :value="entry[0]"
            />
          </ElSelect>
</ElFormItem><ElFormItem label="时间范围">
          <ElDatePicker
            v-model="form.range"
            type="datetimerange"
            value-format="YYYY-MM-DD HH:mm:ss"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            class="!w-full"
          /><span class="mt-1 text-xs text-gray-500">按 {{ timezoneStore.timezone }} 解析后转为 UTC 提交</span>
</ElFormItem><ElFormItem label="用途">
          <ElInput
            v-model="form.purpose"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="说明业务用途、接收者和必要性"
          />
        </ElFormItem>
</ElForm><template #footer>
        <ElButton @click="editorOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="save">
          提交审批
        </ElButton>
      </template>
    </ElDialog>
  </AdminPage>
</template>
