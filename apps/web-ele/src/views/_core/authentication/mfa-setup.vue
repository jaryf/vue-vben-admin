<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { QrCode } from '@vben/common-ui';
import { useAccessStore } from '@vben/stores';

import { ElAlert, ElButton, ElInput, ElMessage } from 'element-plus';

import {
  enableMFAApi,
  getAccessCodesApi,
  getMFAStatusApi,
  setupMFAApi,
} from '#/api/core/auth';
import { useAuthStore } from '#/store';

const router = useRouter();
const accessStore = useAccessStore();
const authStore = useAuthStore();
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
    const status = await getMFAStatusApi();
    if (status.enabled) {
      accessStore.setAccessCodes(await getAccessCodesApi());
      await router.replace('/workspace');
    }
  } catch {
    ElMessage.error('无法完成双因素认证状态检查，请重试');
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
    const result = await enableMFAApi(currentPassword.value, totpCode.value);
    recoveryCodes.value = result.recoveryCodes;
    secret.value = '';
    otpAuthUri.value = '';
    currentPassword.value = '';
    totpCode.value = '';
  } finally {
    busy.value = false;
  }
}

async function finish() {
  accessStore.setAccessCodes(await getAccessCodesApi());
  recoveryCodes.value = [];
  await router.replace('/workspace');
}

async function logout() {
  await authStore.logout(false);
}
</script>

<template>
  <div class="driftly-auth-card mx-auto w-full max-w-xl">
    <div class="driftly-auth-brand">
      <span aria-hidden="true">D</span> DRIFTLY · SECURITY
    </div>
    <div class="mb-3 flex items-center justify-between">
      <h1 class="text-2xl font-semibold">设置双因素认证</h1>
      <ElButton link type="primary" @click="logout">退出登录</ElButton>
    </div>
    <p class="mb-6 text-sm text-gray-500">
      管理员必须绑定验证器后才能使用总管理后台。
    </p>
    <ol class="driftly-auth-steps" aria-label="绑定进度">
      <li
        :class="{ active: !secret && !recoveryCodes.length }"
        :aria-current="!secret && !recoveryCodes.length ? 'step' : undefined"
      >
        <span>1</span>验证密码
      </li>
      <li
        :class="{ active: !!secret }"
        :aria-current="secret ? 'step' : undefined"
      >
        <span>2</span>扫码绑定
      </li>
      <li
        :class="{ active: !!recoveryCodes.length }"
        :aria-current="recoveryCodes.length ? 'step' : undefined"
      >
        <span>3</span>保存恢复码
      </li>
    </ol>
    <template v-if="recoveryCodes.length">
      <ElAlert
        class="mb-5"
        title="请立即离线保存恢复码；关闭后将无法再次查看"
        type="warning"
        show-icon
        :closable="false"
      />
      <div class="mb-6 grid grid-cols-2 gap-2 rounded border p-4 font-mono">
        <span v-for="code in recoveryCodes" :key="code">{{ code }}</span>
      </div>
      <ElButton type="primary" @click="finish">我已保存，进入后台</ElButton>
    </template>
    <template v-else>
      <label class="mb-1 block text-sm" for="setup-password">当前密码</label>
      <ElInput
        id="setup-password"
        v-model="currentPassword"
        class="mb-5"
        type="password"
        show-password
        autocomplete="current-password"
      />
      <ElButton v-if="!secret" type="primary" :loading="busy" @click="setup">
        开始绑定
      </ElButton>
      <template v-else>
        <p class="mb-4 text-sm">
          打开验证器应用，扫描下方二维码，然后输入应用中显示的六位动态验证码。
        </p>
        <figure
          class="mb-5 flex flex-col items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800"
        >
          <QrCode
            v-if="otpAuthUri"
            :value="otpAuthUri"
            alt="管理员双因素认证绑定二维码"
          />
          <figcaption class="text-sm text-gray-500">
            使用验证器扫描此二维码
          </figcaption>
        </figure>
        <details
          class="mb-5 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
        >
          <summary class="cursor-pointer text-sm">
            无法扫码？手动输入密钥
          </summary>
          <label class="mb-1 mt-3 block text-sm" for="setup-secret">
            绑定密钥
          </label>
          <ElInput id="setup-secret" :model-value="secret" readonly />
          <p class="mt-2 text-xs text-gray-500">
            在验证器中选择基于时间的账号，粘贴此密钥。
          </p>
        </details>
        <label class="mb-1 block text-sm" for="setup-code">动态验证码</label>
        <ElInput
          id="setup-code"
          v-model="totpCode"
          class="mb-5"
          maxlength="6"
          inputmode="numeric"
          autocomplete="one-time-code"
        />
        <ElButton type="primary" :loading="busy" @click="enable">
          验证并启用
        </ElButton>
      </template>
    </template>
  </div>
</template>
