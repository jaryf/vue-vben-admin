<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  getConversation, getExtendedMessageContext, getMessageContext, getMessageMediaPreview, listConversations, listMessages, removeMessage,
} from '#/api/conversations';
import type { ConversationDetail, ConversationRow, MessageContext, MessageRow } from '#/api/conversations';
import AdminTime from '#/components/admin-time.vue';

const { hasAccessByCodes } = useAccess();
const canRemove = computed(() => hasAccessByCodes(['message.remove']));
const canExtended = computed(() => hasAccessByCodes(['message.read_context']) && hasAccessByCodes(['message.read_context_extended']));
const canPreview = computed(() => hasAccessByCodes(['message.read_context']) && hasAccessByCodes(['message.media.preview']));
const rows = ref<ConversationRow[]>([]);
const nextCursor = ref<string | null>(null);
const cursorStack = ref<string[]>([]);
const loading = ref(false);
const detailOpen = ref(false);
const detail = ref<ConversationDetail | null>(null);
const messages = ref<MessageRow[]>([]);
const messageNextCursor = ref<string | null>(null);
const messageReason = ref('');
const messageContext = ref<MessageContext | null>(null);
const contextOpen = ref(false);
const previewOpen = ref(false);
const previewBusy = ref(false);
const previewURL = ref('');
const previewMessageId = ref('');
const previewType = ref('');
let previewExpiryTimer: null | number = null;
const filter = reactive({ conversationId: '', memberUserId: '', type: '', status: '', sourceBottleId: '' });
const messageFilter = reactive({ messageId: '', conversationId: '', senderMemberType: '', senderMemberId: '', messageType: '', status: '', moderationStatus: '', createdRange: [] as Date[] });
const searchedMessages = ref<MessageRow[]>([]);
const searchedNextCursor = ref<string | null>(null);
const searchedCursorStack = ref<string[]>([]);
const searchedReason = ref('');
const searchedQuery = ref<Record<string, unknown>>({});
const searchingMessages = ref(false);
const messageStatuses = [['created', '已创建'], ['pending_review', '待审核'], ['approved', '已通过'], ['sent', '已发送'], ['delivered', '已送达'], ['read', '已读'], ['rejected', '已拒绝'], ['send_failed', '发送失败'], ['recalled', '已撤回'], ['admin_removed', '管理员已下架']];
const moderationStatuses = [['pending', '待审核'], ['approved', '已通过'], ['rejected', '已拒绝'], ['manual_review', '人工复核']];
const messageStatusText = (value: string) => messageStatuses.find(([code]) => code === value)?.[1] || value;
const moderationStatusText = (value: string) => moderationStatuses.find(([code]) => code === value)?.[1] || value;
const stableCode = (value: string) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value);

async function reason(prompt: string) {
  const { value } = await ElMessageBox.prompt(prompt, '审计原因', {
    inputValidator: (text) => stableCode(text.trim()) || '请输入 1–64 位稳定原因代码',
  });
  return value.trim();
}
async function load(cursor = '') {
  loading.value = true;
  try {
    const result = await listConversations({
      conversationId: filter.conversationId || undefined, memberUserId: filter.memberUserId || undefined,
      type: filter.type || undefined, status: filter.status || undefined,
      sourceBottleId: filter.sourceBottleId || undefined, cursor: cursor || undefined, limit: 20,
    });
    rows.value = result.items || []; nextCursor.value = result.nextCursor;
  } finally { loading.value = false; }
}
function search() { cursorStack.value = []; void load(); }
function next() { if (!nextCursor.value) return; cursorStack.value.push(nextCursor.value); void load(nextCursor.value); }
function previous() { cursorStack.value.pop(); void load(cursorStack.value.at(-1) || ''); }
async function openDetail(row: ConversationRow) {
  const reasonCode = await reason(`查看会话 #${row.conversationId} 的参与者和消息元数据，请填写原因`);
  detail.value = await getConversation(row.conversationId, reasonCode);
  detailOpen.value = true;
  messages.value = []; messageNextCursor.value = null; messageReason.value = '';
}
async function loadMessages(cursor = '') {
  if (!detail.value || !messageReason.value) return;
  const result = await listMessages({ conversationId: detail.value.conversation.conversationId, reasonCode: messageReason.value, cursor: cursor || undefined, limit: 20 });
  messages.value = cursor ? [...messages.value, ...(result.items || [])] : result.items || [];
  messageNextCursor.value = result.nextCursor;
}
async function openMessages() {
  if (!detail.value) return;
  messageReason.value = await reason(`浏览会话 #${detail.value.conversation.conversationId} 的消息元数据，请填写原因`);
  await loadMessages();
}
async function loadSearchedMessages(cursor = '') {
  if (!searchedReason.value) return;
  searchingMessages.value = true;
  try {
    const result = await listMessages({ ...searchedQuery.value, reasonCode: searchedReason.value, cursor: cursor || undefined, limit: 20 });
    searchedMessages.value = result.items || [];
    searchedNextCursor.value = result.nextCursor;
  } finally { searchingMessages.value = false; }
}
async function searchAllMessages() {
  if (messageFilter.messageId.trim() && !/^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/.test(messageFilter.messageId.trim())) { ElMessage.warning('请输入有效的消息 UUID'); return; }
  if ([messageFilter.conversationId, messageFilter.senderMemberId].some((value) => value.trim() && !/^[1-9]\d*$/.test(value.trim()))) { ElMessage.warning('会话和发送者 ID 必须为正整数'); return; }
  if (messageFilter.createdRange?.length === 2 && messageFilter.createdRange[0]!.getTime() >= messageFilter.createdRange[1]!.getTime()) { ElMessage.warning('结束时间必须晚于开始时间'); return; }
  searchedReason.value = await reason('跨会话检索消息元数据，请填写审计原因');
  searchedQuery.value = {
    messageId: messageFilter.messageId.trim() || undefined,
    conversationId: messageFilter.conversationId.trim() || undefined,
    senderMemberType: messageFilter.senderMemberType || undefined,
    senderMemberId: messageFilter.senderMemberId.trim() || undefined,
    messageType: messageFilter.messageType || undefined,
    status: messageFilter.status || undefined,
    moderationStatus: messageFilter.moderationStatus || undefined,
    createdFrom: messageFilter.createdRange?.[0]?.toISOString(),
    createdUntil: messageFilter.createdRange?.[1]?.toISOString(),
  };
  searchedCursorStack.value = [];
  searchedMessages.value = [];
  searchedNextCursor.value = null;
  await loadSearchedMessages();
}
function nextSearchedMessages() {
  if (!searchedNextCursor.value) return;
  searchedCursorStack.value.push(searchedNextCursor.value);
  void loadSearchedMessages(searchedNextCursor.value);
}
function previousSearchedMessages() {
  searchedCursorStack.value.pop();
  void loadSearchedMessages(searchedCursorStack.value.at(-1) || '');
}
async function openContext(row: MessageRow) {
  const reasonCode = await reason(`查看消息 ${row.messageId} 的上下文，请填写原因`);
  messageContext.value = await getMessageContext(row.messageId, reasonCode);
  contextOpen.value = true;
}
async function expandContext() {
  if (!messageContext.value || !canExtended.value) return;
  const messageId = messageContext.value.targetMessage.messageId;
  const reasonCode = await reason(`扩大查看消息 ${messageId} 前后各 50 条元数据，请填写审计原因`);
  messageContext.value = await getExtendedMessageContext(messageId, reasonCode);
}
const previewable = (row: MessageRow) =>
  canPreview.value && !!row.mediaAssetId && ['image', 'voice'].includes(row.messageType);
function clearPreview() {
  if (previewExpiryTimer !== null) window.clearTimeout(previewExpiryTimer);
  previewExpiryTimer = null;
  if (previewURL.value) URL.revokeObjectURL(previewURL.value);
  previewURL.value = '';
  previewMessageId.value = '';
  previewType.value = '';
}
async function openPreview(row: MessageRow) {
  if (!previewable(row) || previewBusy.value) return;
  const reasonCode = await reason(`预览消息 ${row.messageId} 的媒体，请填写审计原因`);
  previewBusy.value = true;
  try {
    const blob = await getMessageMediaPreview(row.messageId, reasonCode);
    if (!(blob instanceof Blob) ||
      !(row.messageType === 'image' ? blob.type.startsWith('image/') : blob.type.startsWith('audio/'))) {
      ElMessage.error('服务端未返回可预览的媒体');
      return;
    }
    clearPreview();
    previewURL.value = URL.createObjectURL(blob);
    previewMessageId.value = row.messageId;
    previewType.value = row.messageType;
    previewOpen.value = true;
    previewExpiryTimer = window.setTimeout(() => {
      previewOpen.value = false;
      clearPreview();
      ElMessage.info('预览已到期，请重新填写原因后查看');
    }, 5 * 60 * 1000);
  } finally { previewBusy.value = false; }
}
async function remove(row: MessageRow) {
  const reasonCode = await reason(`下架消息 ${row.messageId}，请填写处理原因`);
  await ElMessageBox.confirm('确定下架这条消息吗？', '确认下架', { type: 'warning' });
  await removeMessage(row.messageId, reasonCode);
  ElMessage.success('消息已下架');
  if (messageReason.value) await loadMessages();
  if (searchedReason.value) await loadSearchedMessages(searchedCursorStack.value.at(-1) || '');
  if (messageContext.value?.targetMessage.messageId === row.messageId) contextOpen.value = false;
}
onMounted(() => { void load(); });
onBeforeUnmount(clearPreview);
</script>

<template>
  <div class="p-5"><ElCard shadow="never"><template #header>会话与消息</template>
    <ElAlert title="当前服务端提供会话、参与者和消息元数据，以及受控图片与语音预览；不返回消息正文。IM 正文能力尚未接通。敏感查看需填写原因并留审计。" type="info" show-icon :closable="false" class="mb-4" />
    <div class="mb-4 flex flex-wrap gap-3"><ElInput v-model="filter.conversationId" placeholder="会话 ID" clearable class="!w-32" /><ElInput v-model="filter.memberUserId" placeholder="参与用户 ID" clearable class="!w-36" /><ElInput v-model="filter.sourceBottleId" placeholder="来源漂流瓶 ID" clearable class="!w-40" /><ElInput v-model="filter.type" placeholder="会话类型" clearable class="!w-32" /><ElInput v-model="filter.status" placeholder="状态代码" clearable class="!w-32" /><ElButton @click="search">查询</ElButton></div>
    <ElTable v-loading="loading" :data="rows" row-key="conversationId"><ElTableColumn prop="conversationId" label="会话 ID" width="110" /><ElTableColumn prop="type" label="类型" width="120" /><ElTableColumn prop="status" label="状态" width="110" /><ElTableColumn prop="sourceBottleId" label="来源漂流瓶" width="125" /><ElTableColumn prop="memberCount" label="参与者" width="90" /><ElTableColumn prop="messageCount" label="消息数" width="90" /><ElTableColumn prop="reportCount" label="举报数" width="90" /><ElTableColumn prop="lastMessageAt" label="最近消息" min-width="175"><template #default="{ row }"><AdminTime :value="row.lastMessageAt" /></template></ElTableColumn><ElTableColumn label="操作" width="95"><template #default="{ row }"><ElButton link type="primary" @click="openDetail(row)">详情</ElButton></template></ElTableColumn></ElTable>
    <div class="mt-4 flex justify-end gap-2"><ElButton :disabled="cursorStack.length === 0" @click="previous">上一页</ElButton><ElButton :disabled="!nextCursor" @click="next">下一页</ElButton></div>
  </ElCard>
  <ElCard class="mt-5" shadow="never">
    <template #header>跨会话消息元数据检索</template>
    <ElAlert class="mb-4" type="info" show-icon :closable="false" title="检索前需填写审计原因；每页读取均记录敏感访问。结果只包含本地消息元数据；有权限者可另行填写原因预览图片或语音。IM 正文不可用。" />
    <div class="mb-4 flex flex-wrap gap-3">
      <ElInput v-model="messageFilter.messageId" placeholder="消息 UUID" clearable class="!w-64" />
      <ElInput v-model="messageFilter.conversationId" placeholder="会话 ID" clearable class="!w-32" />
      <ElSelect v-model="messageFilter.senderMemberType" clearable placeholder="发送者类型" class="!w-36"><ElOption label="App 用户" value="user" /><ElOption label="AI 角色" value="ai_role" /></ElSelect>
      <ElInput v-model="messageFilter.senderMemberId" placeholder="发送者 ID" clearable class="!w-32" />
      <ElSelect v-model="messageFilter.messageType" clearable placeholder="消息类型" class="!w-36"><ElOption label="文字" value="text" /><ElOption label="图片" value="image" /><ElOption label="语音" value="voice" /><ElOption label="视频" value="video" /><ElOption label="自定义" value="custom" /></ElSelect>
      <ElSelect v-model="messageFilter.status" clearable placeholder="发送状态" class="!w-40"><ElOption v-for="[value, label] in messageStatuses" :key="value" :value="value" :label="label" /></ElSelect>
      <ElSelect v-model="messageFilter.moderationStatus" clearable placeholder="审核状态" class="!w-36"><ElOption v-for="[value, label] in moderationStatuses" :key="value" :value="value" :label="label" /></ElSelect>
      <ElDatePicker v-model="messageFilter.createdRange" type="datetimerange" range-separator="至" start-placeholder="创建开始" end-placeholder="创建结束" class="!w-[390px]" />
      <ElButton type="primary" :loading="searchingMessages" @click="searchAllMessages">填写原因并查询</ElButton>
    </div>
    <ElTable v-loading="searchingMessages" :data="searchedMessages" row-key="messageId">
      <ElTableColumn prop="messageId" label="消息 ID" min-width="245" />
      <ElTableColumn prop="conversationId" label="会话 ID" width="105" />
      <ElTableColumn prop="sequenceNo" label="序号" width="75" />
      <ElTableColumn label="发送者" min-width="130"><template #default="{ row }">{{ row.senderMemberType }} #{{ row.senderMemberId }}</template></ElTableColumn>
      <ElTableColumn prop="messageType" label="类型" width="95" />
      <ElTableColumn label="发送状态" width="110"><template #default="{ row }">{{ messageStatusText(row.status) }}</template></ElTableColumn>
      <ElTableColumn label="审核状态" width="110"><template #default="{ row }">{{ moderationStatusText(row.moderationStatus) }}</template></ElTableColumn>
      <ElTableColumn prop="mediaAssetId" label="媒体资产 ID" width="110" />
      <ElTableColumn prop="createdAt" label="创建时间" min-width="175"><template #default="{ row }"><AdminTime :value="row.createdAt" /></template></ElTableColumn>
      <ElTableColumn label="操作" width="190" fixed="right"><template #default="{ row }"><ElButton link type="primary" @click="openContext(row)">上下文</ElButton><ElButton v-if="previewable(row)" link type="primary" :disabled="previewBusy" @click="openPreview(row)">预览</ElButton><ElButton v-if="canRemove && row.status !== 'admin_removed'" link type="danger" @click="remove(row)">下架</ElButton></template></ElTableColumn>
    </ElTable>
    <div class="mt-4 flex justify-end gap-2"><ElButton :disabled="searchedCursorStack.length === 0" @click="previousSearchedMessages">上一页</ElButton><ElButton :disabled="!searchedNextCursor" @click="nextSearchedMessages">下一页</ElButton></div>
  </ElCard>
  <ElDrawer v-model="detailOpen" :title="`会话 #${detail?.conversation.conversationId || ''}`" size="72%" @closed="detail = null">
    <template v-if="detail"><ElDescriptions :column="2" border><ElDescriptionsItem label="类型">{{ detail.conversation.type }}</ElDescriptionsItem><ElDescriptionsItem label="状态">{{ detail.conversation.status }}</ElDescriptionsItem><ElDescriptionsItem label="消息总数">{{ detail.conversation.messageCount }}</ElDescriptionsItem><ElDescriptionsItem label="消息正文">不可用</ElDescriptionsItem></ElDescriptions><ElDivider>参与者</ElDivider><ElTable :data="detail.members"><ElTableColumn prop="memberType" label="类型" /><ElTableColumn prop="memberId" label="成员 ID" /><ElTableColumn label="显示名称"><template #default="{ row }">{{ row.identity?.displayName || '—' }}</template></ElTableColumn><ElTableColumn prop="role" label="角色" /><ElTableColumn prop="status" label="状态" /></ElTable><ElDivider>消息元数据</ElDivider><ElButton type="primary" class="mb-4" @click="openMessages">填写原因并查看</ElButton><ElTable :data="messages"><ElTableColumn prop="sequenceNo" label="序号" width="75" /><ElTableColumn prop="messageId" label="消息 ID" min-width="230" /><ElTableColumn prop="senderMemberId" label="发送者" width="90" /><ElTableColumn prop="messageType" label="类型" width="90" /><ElTableColumn prop="status" label="状态" width="105" /><ElTableColumn prop="moderationStatus" label="审核状态" width="110" /><ElTableColumn prop="createdAt" label="时间" min-width="175"><template #default="{ row }"><AdminTime :value="row.createdAt" /></template></ElTableColumn><ElTableColumn label="操作" width="190"><template #default="{ row }"><ElButton link type="primary" @click="openContext(row)">上下文</ElButton><ElButton v-if="previewable(row)" link type="primary" :disabled="previewBusy" @click="openPreview(row)">预览</ElButton><ElButton v-if="canRemove && row.status !== 'admin_removed'" link type="danger" @click="remove(row)">下架</ElButton></template></ElTableColumn></ElTable><div class="mt-3 text-right"><ElButton v-if="messageNextCursor" @click="loadMessages(messageNextCursor)">加载更多</ElButton></div></template>
  </ElDrawer>
  <ElDrawer v-model="contextOpen" title="消息上下文" size="55%" @closed="messageContext = null"><template v-if="messageContext"><ElAlert title="仅展示同一会话的消息元数据，正文尚不可用。" type="warning" :closable="false" class="mb-4" /><div class="mb-4 flex items-center justify-between"><span>当前范围：目标消息前后各 {{ messageContext.windowBefore }} 条</span><ElButton v-if="canExtended && messageContext.windowBefore === 10" type="primary" @click="expandContext">填写原因并扩大至各 50 条</ElButton></div><ElDivider>前文</ElDivider><ElTable :data="messageContext.before" max-height="300"><ElTableColumn prop="sequenceNo" label="序号" width="80" /><ElTableColumn prop="messageId" label="消息 ID" /><ElTableColumn prop="messageType" label="类型" width="100" /></ElTable><ElDivider>目标消息</ElDivider><ElDescriptions :column="1" border><ElDescriptionsItem label="消息 ID">{{ messageContext.targetMessage.messageId }}</ElDescriptionsItem><ElDescriptionsItem label="发送者">{{ messageContext.targetMessage.senderMemberType }} #{{ messageContext.targetMessage.senderMemberId }}</ElDescriptionsItem><ElDescriptionsItem label="状态">{{ messageContext.targetMessage.status }}</ElDescriptionsItem><ElDescriptionsItem label="审核状态">{{ messageContext.targetMessage.moderationStatus }}</ElDescriptionsItem></ElDescriptions><ElDivider>后文</ElDivider><ElTable :data="messageContext.after" max-height="300"><ElTableColumn prop="sequenceNo" label="序号" width="80" /><ElTableColumn prop="messageId" label="消息 ID" /><ElTableColumn prop="messageType" label="类型" width="100" /></ElTable></template></ElDrawer>
  <ElDrawer v-model="previewOpen" :title="`受控媒体预览 · ${previewMessageId}`" size="55%" @closed="clearPreview">
    <ElAlert title="仅供受控查看，有效期 5 分钟；本页不提供下载。每次预览均单独记录审计。" type="warning" :closable="false" class="mb-4" />
    <img v-if="previewType === 'image' && previewURL" :src="previewURL" alt="受控消息图片" class="mx-auto max-h-[70vh] max-w-full object-contain" />
    <audio v-if="previewType === 'voice' && previewURL" :src="previewURL" controls controlsList="nodownload noplaybackrate" class="w-full">浏览器不支持音频预览</audio>
  </ElDrawer>
  </div>
</template>
