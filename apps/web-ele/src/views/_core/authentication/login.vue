<script setup lang="ts">
import { reactive, ref } from 'vue';

import { ElMessage } from 'element-plus';

import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();
const form = reactive({ username: '', password: '', totpCode: '', recoveryCode: '' });
const secondFactorRequired = ref(false);
const useRecoveryCode = ref(false);
const errorText = ref('');

async function submit() {
  errorText.value = '';
  if (!form.username.trim() || !form.password) {
    errorText.value = '请输入管理员用户名和密码';
    return;
  }
  if (secondFactorRequired.value && !(useRecoveryCode.value ? form.recoveryCode : form.totpCode)) {
    errorText.value = useRecoveryCode.value ? '请输入恢复码' : '请输入六位动态验证码';
    return;
  }
  try {
    const result = await authStore.authLogin({
      username: form.username.trim(),
      password: form.password,
      ...(secondFactorRequired.value
        ? useRecoveryCode.value
          ? { recoveryCode: form.recoveryCode.trim() }
          : { totpCode: form.totpCode.trim() }
        : {}),
    });
    if (result.mfaRequired) {
      secondFactorRequired.value = true;
    } else if (result.userInfo) {
      form.password = '';
      form.totpCode = '';
      form.recoveryCode = '';
      ElMessage.success('登录成功');
    }
  } catch {
    errorText.value = secondFactorRequired.value ? '验证失败，请检查动态验证码或恢复码' : '登录失败，请检查用户名和密码';
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-md rounded-xl bg-white p-8 shadow-lg dark:bg-gray-900">
    <div class="mb-8 text-center">
      <h1 class="text-2xl font-semibold">Driftly 总管理后台</h1>
      <p class="mt-2 text-sm text-gray-500">使用独立管理员账号登录</p>
    </div>
    <ElAlert v-if="errorText" class="mb-5" :title="errorText" type="error" show-icon :closable="false" />
    <form @submit.prevent="submit">
      <template v-if="!secondFactorRequired">
        <label class="mb-1 block text-sm" for="admin-username">管理员用户名</label>
        <ElInput id="admin-username" v-model="form.username" class="mb-5" autocomplete="username" />
        <label class="mb-1 block text-sm" for="admin-password">密码</label>
        <ElInput id="admin-password" v-model="form.password" class="mb-5" type="password" show-password autocomplete="current-password" />
      </template>
      <template v-else>
        <p class="mb-5 text-sm text-gray-600 dark:text-gray-300">请完成管理员双因素验证</p>
        <label class="mb-1 block text-sm" for="admin-second-factor">{{ useRecoveryCode ? '一次性恢复码' : '六位动态验证码' }}</label>
        <ElInput
          v-if="useRecoveryCode"
          id="admin-second-factor"
          v-model="form.recoveryCode"
          class="mb-4"
          autocomplete="one-time-code"
        />
        <ElInput
          v-else
          id="admin-second-factor"
          v-model="form.totpCode"
          class="mb-4"
          maxlength="6"
          inputmode="numeric"
          autocomplete="one-time-code"
        />
        <ElButton class="mb-5" text type="primary" @click="useRecoveryCode = !useRecoveryCode">
          {{ useRecoveryCode ? '使用动态验证码' : '使用恢复码' }}
        </ElButton>
      </template>
      <ElButton class="w-full" size="large" type="primary" native-type="submit" :loading="authStore.loginLoading">
        {{ secondFactorRequired ? '验证并登录' : '登录' }}
      </ElButton>
    </form>
  </div>
</template>
