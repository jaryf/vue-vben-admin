<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { ElMessage } from 'element-plus';

import { getMFAStatusApi, regenerateRecoveryCodesApi } from '#/api/core/auth';

const router = useRouter();
const enabled = ref<boolean | null>(null);
const remaining = ref(0);
const form = reactive({ currentPassword: '', totpCode: '' });
const recoveryCodes = ref<string[]>([]);
const busy = ref(false);

onMounted(async () => {
  const status = await getMFAStatusApi();
  enabled.value = status.enabled;
  remaining.value = status.recoveryCodesRemaining;
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
  <div class="max-w-xl">
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
  </div>
</template>
