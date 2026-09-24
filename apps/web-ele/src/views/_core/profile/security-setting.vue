<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { ElMessage } from 'element-plus';

import { getMFAStatusApi, listCurrentAdminSecurityEventsApi, regenerateRecoveryCodesApi } from '#/api/core/auth';
import type { AdminSecurityEvent } from '#/api/core/auth';
import AdminTime from '#/components/admin-time.vue';

const router = useRouter();
const enabled = ref<boolean | null>(null);
const remaining = ref(0);
const form = reactive({ currentPassword: '', totpCode: '' });
const recoveryCodes = ref<string[]>([]);
const busy = ref(false);
const events = ref<AdminSecurityEvent[]>([]);
const eventsLoading = ref(false);
const nextCursor = ref<null | string>(null);
const cursorStack = ref<string[]>([]);
const eventLabels: Record<string, string> = {
  login: '登录', login_mfa_required: '登录待双因素验证', logout: '退出登录',
  mfa_setup: '开始绑定双因素', mfa_enable: '启用双因素',
  mfa_disable: '停用双因素', recovery_codes_rotate: '重置恢复码',
  password_change: '修改密码', mfa_reset: '管理员重置双因素',
};

async function loadEvents(cursor = '') {
  eventsLoading.value = true;
  try {
    const result = await listCurrentAdminSecurityEventsApi(cursor || undefined);
    events.value = result.items || [];
    nextCursor.value = result.nextCursor;
  } finally { eventsLoading.value = false; }
}
function nextEvents() {
  if (!nextCursor.value) return;
  cursorStack.value.push(nextCursor.value);
  void loadEvents(nextCursor.value);
}
function previousEvents() {
  cursorStack.value.pop();
  void loadEvents(cursorStack.value.at(-1) || '');
}

onMounted(async () => {
  const status = await getMFAStatusApi();
  enabled.value = status.enabled;
  remaining.value = status.recoveryCodesRemaining;
  if (status.enabled) await loadEvents();
});

async function regenerate() {
  if (!form.currentPassword || !/^\d{6}$/.test(form.totpCode)) {
    ElMessage.error('请输入当前密码和六位动态验证码');
    return;
  }
  busy.value = true;
  try {
    recoveryCodes.value = (await regenerateRecoveryCodesApi(form.currentPassword, form.totpCode)).recoveryCodes;
    remaining.value = recoveryCodes.value.length;
    form.currentPassword = '';
    form.totpCode = '';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="max-w-4xl">
    <ElAlert v-if="enabled === false" title="尚未启用双因素认证" type="error" show-icon :closable="false" />
    <ElAlert v-else-if="enabled === true" :title="`双因素认证已启用；剩余 ${remaining} 个恢复码`" type="success" show-icon :closable="false" />
    <ElButton v-if="enabled === false" class="mt-5" type="primary" @click="router.push('/auth/mfa-setup')">立即绑定</ElButton>
    <template v-if="enabled === true">
      <p class="my-5 text-sm text-gray-500">重新生成恢复码会立即使旧恢复码失效。</p>
      <ElForm label-position="top" @submit.prevent="regenerate">
        <ElFormItem label="当前密码"><ElInput v-model="form.currentPassword" type="password" show-password autocomplete="current-password" /></ElFormItem>
        <ElFormItem label="动态验证码"><ElInput v-model="form.totpCode" maxlength="6" inputmode="numeric" autocomplete="one-time-code" /></ElFormItem>
        <ElButton type="primary" native-type="submit" :loading="busy">重新生成恢复码</ElButton>
      </ElForm>
      <ElAlert v-if="recoveryCodes.length" class="mt-5" title="请立即离线保存新恢复码；离开页面后无法再次查看" type="warning" show-icon :closable="false" />
      <div v-if="recoveryCodes.length" class="mt-3 grid grid-cols-2 gap-2 font-mono">
        <span v-for="code in recoveryCodes" :key="code">{{ code }}</span>
      </div>
    </template>
    <ElDivider v-if="enabled">最近安全事件</ElDivider>
    <ElAlert v-if="enabled" title="展示与当前管理员相关的登录、密码及双因素操作；不保存或展示密码、验证码、恢复码和令牌。" type="info" :closable="false" class="mb-4" />
    <ElTable v-if="enabled" v-loading="eventsLoading" :data="events" row-key="eventId">
      <ElTableColumn label="事件" min-width="170"><template #default="{ row }">{{ eventLabels[row.eventType] || row.eventType }}</template></ElTableColumn>
      <ElTableColumn label="结果" width="100"><template #default="{ row }">{{ row.success ? '成功' : row.eventType === 'login_mfa_required' ? '待验证' : '未完成' }}</template></ElTableColumn>
      <ElTableColumn prop="ip" label="来源 IP" min-width="145" />
      <ElTableColumn prop="occurredAt" label="发生时间" min-width="190"><template #default="{ row }"><AdminTime :value="row.occurredAt" /></template></ElTableColumn>
    </ElTable>
    <div v-if="enabled" class="mt-4 flex justify-end gap-2"><ElButton :disabled="cursorStack.length === 0" @click="previousEvents">上一页</ElButton><ElButton :disabled="!nextCursor" @click="nextEvents">下一页</ElButton></div>
  </div>
</template>
