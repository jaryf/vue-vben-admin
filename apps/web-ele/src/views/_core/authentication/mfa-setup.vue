<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useAccessStore } from '@vben/stores';

import { ElMessage } from 'element-plus';

import { enableMFAApi, getMFAStatusApi, setupMFAApi } from '#/api/core/auth';

const router = useRouter();
const accessStore = useAccessStore();
const currentPassword = ref('');
const totpCode = ref('');
const secret = ref('');
const otpAuthUri = ref('');
const recoveryCodes = ref<string[]>([]);
const busy = ref(false);

onMounted(async () => {
  if (!accessStore.accessToken) {
    await router.replace('/auth/login');
    return;
  }
  try {
    if ((await getMFAStatusApi()).enabled) await router.replace('/workspace');
  } catch {
    ElMessage.error('无法读取双因素认证状态，请重试');
  }
});

async function setup() {
  if (!currentPassword.value) return;
  busy.value = true;
  try {
    const result = await setupMFAApi(currentPassword.value);
    secret.value = result.secret;
    otpAuthUri.value = result.otpAuthUri;
  } finally {
    busy.value = false;
  }
}

async function enable() {
  if (!/^\d{6}$/.test(totpCode.value)) {
    ElMessage.error('请输入六位动态验证码');
    return;
  }
  busy.value = true;
  try {
    recoveryCodes.value = (await enableMFAApi(currentPassword.value, totpCode.value)).recoveryCodes;
    secret.value = '';
    otpAuthUri.value = '';
    currentPassword.value = '';
    totpCode.value = '';
  } finally {
    busy.value = false;
  }
}

async function finish() {
  recoveryCodes.value = [];
  await router.replace('/workspace');
}
</script>

<template>
  <div class="mx-auto w-full max-w-xl rounded-xl bg-white p-8 shadow-lg dark:bg-gray-900">
    <h1 class="mb-3 text-2xl font-semibold">设置双因素认证</h1>
    <p class="mb-6 text-sm text-gray-500">管理员必须绑定验证器后才能使用总管理后台。</p>
    <template v-if="recoveryCodes.length">
      <ElAlert class="mb-5" title="请立即离线保存恢复码；关闭后将无法再次查看" type="warning" show-icon :closable="false" />
      <div class="mb-6 grid grid-cols-2 gap-2 rounded border p-4 font-mono">
        <span v-for="code in recoveryCodes" :key="code">{{ code }}</span>
      </div>
      <ElButton type="primary" @click="finish">我已保存，进入后台</ElButton>
    </template>
    <template v-else>
      <label class="mb-1 block text-sm" for="setup-password">当前密码</label>
      <ElInput id="setup-password" v-model="currentPassword" class="mb-5" type="password" show-password autocomplete="current-password" />
      <ElButton v-if="!secret" type="primary" :loading="busy" @click="setup">开始绑定</ElButton>
      <template v-else>
        <p class="mb-3 text-sm">将下方密钥添加到验证器应用，然后输入六位动态验证码。</p>
        <ElInput :model-value="secret" class="mb-3" readonly />
        <ElInput :model-value="otpAuthUri" class="mb-5" readonly />
        <label class="mb-1 block text-sm" for="setup-code">动态验证码</label>
        <ElInput id="setup-code" v-model="totpCode" class="mb-5" maxlength="6" inputmode="numeric" autocomplete="one-time-code" />
        <ElButton type="primary" :loading="busy" @click="enable">验证并启用</ElButton>
      </template>
    </template>
  </div>
</template>
