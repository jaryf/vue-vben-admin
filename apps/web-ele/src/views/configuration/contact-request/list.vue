<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  assignContactRequest, getContactRequest, listContactRequests,
  replyContactRequest, resolveContactRequest,
} from '#/api/contact-requests';
import type { ContactDetail, ContactRow } from '#/api/contact-requests';
import AdminTime from '#/components/admin-time.vue';

const { hasAccessByCodes } = useAccess();
const canAssign = computed(() => hasAccessByCodes(['contact_request.assign']));
const canReply = computed(() => hasAccessByCodes(['contact_request.reply']));
const canResolve = computed(() => hasAccessByCodes(['contact_request.resolve']));
const rows = ref<ContactRow[]>([]);
const nextCursor = ref<string | null>(null);
const cursorStack = ref<string[]>([]);
const loading = ref(false);
const sending = ref(false);
const detailOpen = ref(false);
const detail = ref<ContactDetail | null>(null);
const detailReason = ref('');
const replyOpen = ref(false);
const replyKey = ref('');
const replyForm = reactive({ subject: '', message: '' });
const filter = reactive({ id: '', status: '', senderEmail: '', assignedAdminId: '', requestId: '', language: '', createdRange: [] as Date[] });
const statuses = [['pending', '待处理'], ['notified', '已通知'], ['notification_failed', '通知失败'], ['resolved', '已解决']];
function statusText(value: string) { return statuses.find(([key]) => key === value)?.[1] || value; }
const validReason = (value: string) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value);
async function load(cursor = '') {
  loading.value = true;
  try {
    const result = await listContactRequests({ contactRequestId: filter.id.trim() || undefined, status: filter.status || undefined, senderEmail: filter.senderEmail.trim() || undefined, assignedAdminId: filter.assignedAdminId || undefined, requestId: filter.requestId.trim() || undefined, language: filter.language.trim().toLowerCase() || undefined, createdFrom: filter.createdRange?.[0]?.toISOString(), createdUntil: filter.createdRange?.[1]?.toISOString(), cursor: cursor || undefined, limit: 20 });
    rows.value = result.items || []; nextCursor.value = result.nextCursor;
  } finally { loading.value = false; }
}
function search() {
  if ([filter.id, filter.assignedAdminId].some((value) => value.trim() && !/^[1-9]\d*$/.test(value.trim()))) { ElMessage.warning('请求 ID 和管理员 ID 必须为正整数'); return; }
  if (filter.createdRange?.length === 2 && filter.createdRange[0]!.getTime() >= filter.createdRange[1]!.getTime()) { ElMessage.warning('结束时间必须晚于开始时间'); return; }
  cursorStack.value = []; void load();
}
function next() { if (!nextCursor.value) return; cursorStack.value.push(nextCursor.value); void load(nextCursor.value); }
function previous() { cursorStack.value.pop(); void load(cursorStack.value.at(-1) || ''); }
async function openDetail(row: ContactRow) {
  const { value } = await ElMessageBox.prompt(`查看联系请求 #${row.contactRequestId} 全文，请填写审计原因`, '审计原因', { inputValidator: (text) => validReason(text.trim()) || '请输入有效稳定原因代码' });
  detailReason.value = value.trim();
  detail.value = await getContactRequest(row.contactRequestId, detailReason.value);
  detailOpen.value = true;
}
async function refreshDetail() { if (detail.value) detail.value = await getContactRequest(detail.value.contactRequestId, detailReason.value); }
async function assign() {
  if (!detail.value) return;
  const { value } = await ElMessageBox.prompt('请输入接手管理员 ID', '分派联系请求', { inputValue: String(detail.value.assignedAdminId || ''), inputPattern: /^[1-9]\d*$/, inputErrorMessage: '请输入有效管理员 ID' });
  await assignContactRequest(detail.value.contactRequestId, Number(value));
  ElMessage.success('已分派'); await refreshDetail(); await load(cursorStack.value.at(-1) || '');
}
function openReply() { if (!detail.value) return; Object.assign(replyForm, { subject: `Re: ${detail.value.subject}`, message: '' }); replyKey.value = crypto.randomUUID(); replyOpen.value = true; }
async function reply() {
  if (!detail.value || !replyForm.subject.trim() || !replyForm.message.trim()) { ElMessage.error('请填写主题与回复正文'); return; }
  sending.value = true;
  try {
    detail.value = await replyContactRequest(detail.value.contactRequestId, replyForm.subject.trim(), replyForm.message.trim(), replyKey.value);
    replyOpen.value = false;
    const latest = detail.value.replies.at(-1);
    ElMessage[latest?.deliveryStatus === 'sent' ? 'success' : 'warning'](latest?.deliveryStatus === 'sent' ? '回复已发送' : `回复未送达：${latest?.deliveryErrorCode || '外部邮件服务不可用'}`);
    await load(cursorStack.value.at(-1) || '');
  } finally { sending.value = false; }
}
async function resolve() {
  if (!detail.value) return;
  const { value } = await ElMessageBox.prompt('请输入处理结论', '解决联系请求', { inputValidator: (text) => !!text.trim() || '请填写处理结论' });
  detail.value = await resolveContactRequest(detail.value.contactRequestId, value.trim());
  ElMessage.success('联系请求已解决'); await load(cursorStack.value.at(-1) || '');
}
onMounted(() => { void load(); });
</script>

<template>
  <div class="p-5"><ElCard shadow="never"><template #header>官网联系请求</template>
    <ElAlert title="邮件通知与回复依赖外部邮件服务。发送失败时保留真实投递状态和错误码，不视为已送达。全文查看需填写审计原因。" type="info" show-icon :closable="false" class="mb-4" />
    <div class="mb-4 flex flex-wrap gap-3"><ElInput v-model="filter.id" placeholder="请求 ID" clearable class="!w-32" /><ElSelect v-model="filter.status" clearable placeholder="全部状态" class="!w-36"><ElOption v-for="[value, label] in statuses" :key="value" :label="label" :value="value" /></ElSelect><ElInput v-model="filter.senderEmail" placeholder="发件邮箱" clearable class="!w-48" /><ElInput v-model="filter.assignedAdminId" placeholder="分派管理员 ID" clearable class="!w-40" /><ElInput v-model="filter.requestId" placeholder="公共请求 ID" clearable class="!w-44" /><ElInput v-model="filter.language" placeholder="语言代码" clearable class="!w-36" /><ElDatePicker v-model="filter.createdRange" type="datetimerange" range-separator="至" start-placeholder="提交开始" end-placeholder="提交结束" class="!w-[390px]" /><ElButton @click="search">查询</ElButton></div>
    <ElTable v-loading="loading" :data="rows" row-key="contactRequestId"><ElTableColumn prop="contactRequestId" label="请求 ID" width="100" /><ElTableColumn prop="senderName" label="姓名" width="125" /><ElTableColumn prop="senderEmail" label="邮箱" min-width="190" /><ElTableColumn prop="subject" label="主题" min-width="180" /><ElTableColumn prop="messagePreview" label="消息预览" min-width="220" show-overflow-tooltip /><ElTableColumn label="状态" width="110"><template #default="{ row }">{{ statusText(row.status) }}</template></ElTableColumn><ElTableColumn prop="notificationErrorCode" label="通知错误" min-width="135" /><ElTableColumn prop="createdAt" label="提交时间" min-width="175"><template #default="{ row }"><AdminTime :value="row.createdAt" /></template></ElTableColumn><ElTableColumn label="操作" width="90"><template #default="{ row }"><ElButton link type="primary" @click="openDetail(row)">详情</ElButton></template></ElTableColumn></ElTable>
    <div class="mt-4 flex justify-end gap-2"><ElButton :disabled="cursorStack.length === 0" @click="previous">上一页</ElButton><ElButton :disabled="!nextCursor" @click="next">下一页</ElButton></div>
  </ElCard><ElDrawer v-model="detailOpen" :title="`联系请求 #${detail?.contactRequestId || ''}`" size="65%" @closed="detail = null"><template v-if="detail"><ElDescriptions :column="2" border><ElDescriptionsItem label="姓名">{{ detail.senderName }}</ElDescriptionsItem><ElDescriptionsItem label="邮箱">{{ detail.senderEmail }}</ElDescriptionsItem><ElDescriptionsItem label="主题">{{ detail.subject }}</ElDescriptionsItem><ElDescriptionsItem label="状态">{{ statusText(detail.status) }}</ElDescriptionsItem><ElDescriptionsItem label="分派管理员">{{ detail.assignedAdminId ?? '未分派' }}</ElDescriptionsItem><ElDescriptionsItem label="公共请求 ID">{{ detail.publicRequestId }}</ElDescriptionsItem></ElDescriptions><ElDivider>来信全文</ElDivider><pre class="whitespace-pre-wrap break-all">{{ detail.message }}</pre><div class="mt-4 flex gap-2"><ElButton v-if="canAssign && detail.status !== 'resolved'" @click="assign">分派</ElButton><ElButton v-if="canReply && detail.status !== 'resolved'" type="primary" @click="openReply">回复</ElButton><ElButton v-if="canResolve && detail.status !== 'resolved'" type="success" @click="resolve">标记已解决</ElButton></div><ElDivider>回复记录</ElDivider><ElTable :data="detail.replies"><ElTableColumn prop="replyId" label="回复 ID" width="90" /><ElTableColumn prop="subject" label="主题" min-width="160" /><ElTableColumn prop="message" label="内容" min-width="220" show-overflow-tooltip /><ElTableColumn prop="deliveryStatus" label="投递状态" width="100" /><ElTableColumn prop="deliveryErrorCode" label="错误码" min-width="145" /><ElTableColumn prop="sentAt" label="发送时间" min-width="165"><template #default="{ row }"><AdminTime :value="row.sentAt" /></template></ElTableColumn></ElTable></template></ElDrawer>
  <ElDialog v-model="replyOpen" title="回复联系请求" width="650px"><ElForm label-width="80px"><ElFormItem label="主题"><ElInput v-model="replyForm.subject" /></ElFormItem><ElFormItem label="正文"><ElInput v-model="replyForm.message" type="textarea" :rows="8" /></ElFormItem></ElForm><template #footer><ElButton @click="replyOpen = false">取消</ElButton><ElButton type="primary" :loading="sending" @click="reply">发送回复</ElButton></template></ElDialog></div>
</template>
