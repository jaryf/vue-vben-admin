<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  getConversation, getExtendedMessageContext, getMessageContext, listConversations, listMessages, removeMessage,
} from '#/api/conversations';
import type { ConversationDetail, ConversationRow, MessageContext, MessageRow } from '#/api/conversations';

const { hasAccessByCodes } = useAccess();
const canRemove = computed(() => hasAccessByCodes(['message.remove']));
const canExtended = computed(() => hasAccessByCodes(['message.read_context']) && hasAccessByCodes(['message.read_context_extended']));
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
const filter = reactive({ conversationId: '', memberUserId: '', type: '', status: '', sourceBottleId: '' });
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
async function remove(row: MessageRow) {
  const reasonCode = await reason(`下架消息 ${row.messageId}，请填写处理原因`);
  await ElMessageBox.confirm('确定下架这条消息吗？', '确认下架', { type: 'warning' });
  await removeMessage(row.messageId, reasonCode);
  ElMessage.success('消息已下架');
  if (messageReason.value) await loadMessages();
  if (messageContext.value?.targetMessage.messageId === row.messageId) contextOpen.value = false;
}
onMounted(() => { void load(); });
</script>

<template>
  <div class="p-5"><ElCard shadow="never"><template #header>会话与消息</template>
    <ElAlert title="当前服务端仅提供会话、参与者和消息元数据，不返回消息正文。IM 正文能力尚未接通。敏感上下文查看需填写原因并留审计。" type="info" show-icon :closable="false" class="mb-4" />
    <div class="mb-4 flex flex-wrap gap-3"><ElInput v-model="filter.conversationId" placeholder="会话 ID" clearable class="!w-32" /><ElInput v-model="filter.memberUserId" placeholder="参与用户 ID" clearable class="!w-36" /><ElInput v-model="filter.sourceBottleId" placeholder="来源漂流瓶 ID" clearable class="!w-40" /><ElInput v-model="filter.type" placeholder="会话类型" clearable class="!w-32" /><ElInput v-model="filter.status" placeholder="状态代码" clearable class="!w-32" /><ElButton @click="search">查询</ElButton></div>
    <ElTable v-loading="loading" :data="rows" row-key="conversationId"><ElTableColumn prop="conversationId" label="会话 ID" width="110" /><ElTableColumn prop="type" label="类型" width="120" /><ElTableColumn prop="status" label="状态" width="110" /><ElTableColumn prop="sourceBottleId" label="来源漂流瓶" width="125" /><ElTableColumn prop="memberCount" label="参与者" width="90" /><ElTableColumn prop="messageCount" label="消息数" width="90" /><ElTableColumn prop="reportCount" label="举报数" width="90" /><ElTableColumn prop="lastMessageAt" label="最近消息" min-width="175" /><ElTableColumn label="操作" width="95"><template #default="{ row }"><ElButton link type="primary" @click="openDetail(row)">详情</ElButton></template></ElTableColumn></ElTable>
    <div class="mt-4 flex justify-end gap-2"><ElButton :disabled="cursorStack.length === 0" @click="previous">上一页</ElButton><ElButton :disabled="!nextCursor" @click="next">下一页</ElButton></div>
  </ElCard>
  <ElDrawer v-model="detailOpen" :title="`会话 #${detail?.conversation.conversationId || ''}`" size="72%" @closed="detail = null">
    <template v-if="detail"><ElDescriptions :column="2" border><ElDescriptionsItem label="类型">{{ detail.conversation.type }}</ElDescriptionsItem><ElDescriptionsItem label="状态">{{ detail.conversation.status }}</ElDescriptionsItem><ElDescriptionsItem label="消息总数">{{ detail.conversation.messageCount }}</ElDescriptionsItem><ElDescriptionsItem label="消息正文">不可用</ElDescriptionsItem></ElDescriptions><ElDivider>参与者</ElDivider><ElTable :data="detail.members"><ElTableColumn prop="memberType" label="类型" /><ElTableColumn prop="memberId" label="成员 ID" /><ElTableColumn label="显示名称"><template #default="{ row }">{{ row.identity?.displayName || '—' }}</template></ElTableColumn><ElTableColumn prop="role" label="角色" /><ElTableColumn prop="status" label="状态" /></ElTable><ElDivider>消息元数据</ElDivider><ElButton type="primary" class="mb-4" @click="openMessages">填写原因并查看</ElButton><ElTable :data="messages"><ElTableColumn prop="sequenceNo" label="序号" width="75" /><ElTableColumn prop="messageId" label="消息 ID" min-width="230" /><ElTableColumn prop="senderMemberId" label="发送者" width="90" /><ElTableColumn prop="messageType" label="类型" width="90" /><ElTableColumn prop="status" label="状态" width="105" /><ElTableColumn prop="moderationStatus" label="审核状态" width="110" /><ElTableColumn prop="createdAt" label="时间" min-width="175" /><ElTableColumn label="操作" width="130"><template #default="{ row }"><ElButton link type="primary" @click="openContext(row)">上下文</ElButton><ElButton v-if="canRemove && row.status !== 'admin_removed'" link type="danger" @click="remove(row)">下架</ElButton></template></ElTableColumn></ElTable><div class="mt-3 text-right"><ElButton v-if="messageNextCursor" @click="loadMessages(messageNextCursor)">加载更多</ElButton></div></template>
  </ElDrawer>
  <ElDrawer v-model="contextOpen" title="消息上下文" size="55%" @closed="messageContext = null"><template v-if="messageContext"><ElAlert title="仅展示同一会话的消息元数据，正文尚不可用。" type="warning" :closable="false" class="mb-4" /><div class="mb-4 flex items-center justify-between"><span>当前范围：目标消息前后各 {{ messageContext.windowBefore }} 条</span><ElButton v-if="canExtended && messageContext.windowBefore === 10" type="primary" @click="expandContext">填写原因并扩大至各 50 条</ElButton></div><ElDivider>前文</ElDivider><ElTable :data="messageContext.before" max-height="300"><ElTableColumn prop="sequenceNo" label="序号" width="80" /><ElTableColumn prop="messageId" label="消息 ID" /><ElTableColumn prop="messageType" label="类型" width="100" /></ElTable><ElDivider>目标消息</ElDivider><ElDescriptions :column="1" border><ElDescriptionsItem label="消息 ID">{{ messageContext.targetMessage.messageId }}</ElDescriptionsItem><ElDescriptionsItem label="发送者">{{ messageContext.targetMessage.senderMemberType }} #{{ messageContext.targetMessage.senderMemberId }}</ElDescriptionsItem><ElDescriptionsItem label="状态">{{ messageContext.targetMessage.status }}</ElDescriptionsItem><ElDescriptionsItem label="审核状态">{{ messageContext.targetMessage.moderationStatus }}</ElDescriptionsItem></ElDescriptions><ElDivider>后文</ElDivider><ElTable :data="messageContext.after" max-height="300"><ElTableColumn prop="sequenceNo" label="序号" width="80" /><ElTableColumn prop="messageId" label="消息 ID" /><ElTableColumn prop="messageType" label="类型" width="100" /></ElTable></template></ElDrawer></div>
</template>
