<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import { ElButton, ElForm, ElFormItem, ElInput, ElMessage } from 'element-plus';

import { getUserInfoApi, updateAdminProfileApi } from '#/api/core/user';

const userStore = useUserStore();
const form = reactive({
  username: '',
  realName: '',
  email: '',
  phone: '',
  remark: '',
});
const busy = ref(false);

onMounted(async () => {
  const info = await getUserInfoApi();
  form.username = info.username || '';
  form.realName = info.realName || '';
  form.email = info.email || '';
  form.phone = info.phone || '';
  form.remark = info.desc || '';
});

async function save() {
  busy.value = true;
  try {
    await updateAdminProfileApi({
      realName: form.realName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      remark: form.remark.trim(),
    });
    userStore.setUserInfo(await getUserInfoApi());
    ElMessage.success('资料已更新');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <ElForm label-position="top" class="max-w-xl" @submit.prevent="save">
    <ElFormItem label="管理员用户名">
      <ElInput v-model="form.username" disabled />
    </ElFormItem>
    <ElFormItem label="姓名">
      <ElInput v-model="form.realName" maxlength="50" />
    </ElFormItem>
    <ElFormItem label="邮箱">
      <ElInput v-model="form.email" type="email" />
    </ElFormItem>
    <ElFormItem label="联系电话">
      <ElInput v-model="form.phone" maxlength="20" />
    </ElFormItem>
    <ElFormItem label="备注">
      <ElInput v-model="form.remark" type="textarea" />
    </ElFormItem>
    <ElButton type="primary" native-type="submit" :loading="busy">
      保存资料
    </ElButton>
  </ElForm>
</template>
