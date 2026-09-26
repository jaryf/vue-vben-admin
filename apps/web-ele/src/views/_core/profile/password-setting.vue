<script setup lang="ts">
import { reactive, ref } from 'vue';

import { ElButton, ElForm, ElFormItem, ElInput, ElMessage } from 'element-plus';

import { changeAdminPasswordApi } from '#/api/core/user';
import { useAuthStore } from '#/store';

const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});
const busy = ref(false);
const authStore = useAuthStore();

async function save() {
  if (!form.oldPassword || form.newPassword.length < 8) {
    ElMessage.error('请输入当前密码和至少 8 位的新密码');
    return;
  }
  if (form.newPassword !== form.confirmPassword) {
    ElMessage.error('两次输入的新密码不一致');
    return;
  }
  busy.value = true;
  try {
    await changeAdminPasswordApi(form.oldPassword, form.newPassword);
    form.oldPassword = '';
    form.newPassword = '';
    form.confirmPassword = '';
    ElMessage.success('密码已修改，请重新登录');
    await authStore.logout(false);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <ElForm label-position="top" class="max-w-xl" @submit.prevent="save">
    <ElFormItem label="当前密码">
      <ElInput
        v-model="form.oldPassword"
        type="password"
        show-password
        autocomplete="current-password"
      />
    </ElFormItem>
    <ElFormItem label="新密码">
      <ElInput
        v-model="form.newPassword"
        type="password"
        show-password
        autocomplete="new-password"
      />
    </ElFormItem>
    <ElFormItem label="确认新密码">
      <ElInput
        v-model="form.confirmPassword"
        type="password"
        show-password
        autocomplete="new-password"
      />
    </ElFormItem>
    <ElButton type="primary" native-type="submit" :loading="busy">
      修改密码
    </ElButton>
  </ElForm>
</template>
