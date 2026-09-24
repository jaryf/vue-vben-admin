<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useUserStore } from '@vben/stores';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  allAdminRoles, createAdminUser, deleteAdminUser, listAdminDepts,
  listAdminUsers, resetAdminMFA, updateAdminUser,
} from '#/api/system';
import type { AdminDept, AdminRole, AdminUser } from '#/api/system';
import AdminTime from '#/components/admin-time.vue';

const { hasAccessByCodes } = useAccess();
const userStore = useUserStore();
const canCreate = computed(() => hasAccessByCodes(['system_user.create']));
const canUpdate = computed(() => hasAccessByCodes(['system_user.update']));
const canDelete = computed(() => hasAccessByCodes(['system_user.delete']));
const filter = reactive({ username: '', realName: '', status: '' });
const rows = ref<AdminUser[]>([]);
const roles = ref<AdminRole[]>([]);
const depts = ref<AdminDept[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);
const saving = ref(false);
const editorOpen = ref(false);
const editingId = ref<number | null>(null);
const form = reactive({
  username: '', password: '', realName: '', email: '', phone: '',
  deptId: null as null | number, status: 1, remark: '', roleIds: [] as number[],
});
const resetOpen = ref(false);
const resetTarget = ref<AdminUser | null>(null);
const resetForm = reactive({ currentPassword: '', totpCode: '', reason: '' });

async function load() {
  loading.value = true;
  try {
    const result = await listAdminUsers({
      page: page.value, pageSize: pageSize.value,
      username: filter.username.trim() || undefined,
      realName: filter.realName.trim() || undefined,
      status: filter.status || undefined,
    });
    rows.value = result.items || [];
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

function search() { page.value = 1; void load(); }

async function loadOptions() {
  if (!canCreate.value && !canUpdate.value) return;
  const [roleList, deptList] = await Promise.all([allAdminRoles(), listAdminDepts()]);
  roles.value = roleList || [];
  depts.value = deptList || [];
}

function openEditor(row?: AdminUser) {
  editingId.value = row?.id ?? null;
  Object.assign(form, {
    username: row?.username ?? '', password: '', realName: row?.realName ?? '',
    email: row?.email ?? '', phone: row?.phone ?? '', deptId: row?.deptId ?? null,
    status: row?.status ?? 1, remark: row?.remark ?? '', roleIds: [...(row?.roleIds ?? [])],
  });
  editorOpen.value = true;
}

async function save() {
  if (!form.username.trim() || (editingId.value === null && form.password.length < 8)) {
    ElMessage.error('请输入用户名；新管理员密码至少 8 位');
    return;
  }
  saving.value = true;
  try {
    const data = {
      realName: form.realName.trim(), email: form.email.trim(), phone: form.phone.trim(),
      deptId: form.deptId, status: form.status, remark: form.remark.trim(), roleIds: form.roleIds,
    };
    if (editingId.value === null) {
      await createAdminUser({ ...data, username: form.username.trim(), password: form.password });
    } else {
      await updateAdminUser(editingId.value, data);
    }
    editorOpen.value = false;
    form.password = '';
    ElMessage.success('管理员已保存');
    await load();
  } finally {
    saving.value = false;
  }
}

async function remove(row: AdminUser) {
  await ElMessageBox.confirm(`确定删除管理员「${row.username}」吗？`, '删除管理员', { type: 'warning' });
  await deleteAdminUser(row.id);
  ElMessage.success('管理员已删除');
  await load();
}

function openReset(row: AdminUser) {
  resetTarget.value = row;
  Object.assign(resetForm, { currentPassword: '', totpCode: '', reason: '' });
  resetOpen.value = true;
}

async function submitReset() {
  if (!resetTarget.value || !resetForm.currentPassword || !/^\d{6}$/.test(resetForm.totpCode) || resetForm.reason.trim().length < 8) {
    ElMessage.error('请输入当前密码、六位动态验证码和至少 8 字的原因');
    return;
  }
  saving.value = true;
  try {
    await resetAdminMFA(resetTarget.value.id, { ...resetForm, reason: resetForm.reason.trim() });
    resetOpen.value = false;
    ElMessage.success('双因素认证已重置，目标管理员会话已撤销');
    await load();
  } finally {
    saving.value = false;
  }
}

onMounted(() => { void load(); void loadOptions(); });
</script>

<template>
  <div class="p-5">
    <ElCard shadow="never">
      <template #header><div class="flex items-center justify-between"><span>管理员管理</span><ElButton v-if="canCreate" type="primary" @click="openEditor()">新增管理员</ElButton></div></template>
      <div class="mb-4 flex flex-wrap gap-3">
        <ElInput v-model="filter.username" placeholder="用户名" clearable class="!w-44" @keyup.enter="search" />
        <ElInput v-model="filter.realName" placeholder="姓名" clearable class="!w-44" @keyup.enter="search" />
        <ElSelect v-model="filter.status" placeholder="全部状态" clearable class="!w-36"><ElOption label="正常" value="1" /><ElOption label="停用" value="2" /></ElSelect>
        <ElButton @click="search">查询</ElButton>
      </div>
      <ElTable v-loading="loading" :data="rows" row-key="id" class="w-full">
        <ElTableColumn prop="username" label="用户名" min-width="140" />
        <ElTableColumn prop="realName" label="姓名" min-width="120" />
        <ElTableColumn prop="deptName" label="部门" min-width="120" />
        <ElTableColumn label="角色" min-width="160"><template #default="{ row }">{{ row.roles?.join('、') || '未分配' }}</template></ElTableColumn>
        <ElTableColumn label="状态" width="90"><template #default="{ row }"><ElTag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '正常' : '停用' }}</ElTag></template></ElTableColumn>
        <ElTableColumn label="双因素" width="100"><template #default="{ row }">{{ row.mfaEnabled ? '已启用' : '未启用' }}</template></ElTableColumn>
        <ElTableColumn prop="createdAt" label="创建时间" min-width="170"><template #default="{ row }"><AdminTime :value="row.createdAt" /></template></ElTableColumn>
        <ElTableColumn v-if="canUpdate || canDelete" label="操作" width="245" fixed="right">
          <template #default="{ row }">
            <ElButton v-if="canUpdate" link type="primary" @click="openEditor(row)">编辑</ElButton>
            <ElButton v-if="canUpdate && row.id !== userStore.userInfo?.userId" link type="warning" @click="openReset(row)">重置双因素</ElButton>
            <ElButton v-if="canDelete && row.id !== userStore.userInfo?.userId" link type="danger" @click="remove(row)">删除</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
      <div class="mt-4 flex justify-end"><ElPagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[20, 50, 100]" layout="total, sizes, prev, pager, next" @change="load" /></div>
    </ElCard>

    <ElDialog v-model="editorOpen" :title="editingId === null ? '新增管理员' : '编辑管理员'" width="620px" destroy-on-close>
      <ElForm label-width="100px" @submit.prevent="save">
        <ElFormItem label="用户名"><ElInput v-model="form.username" :disabled="editingId !== null" maxlength="50" /></ElFormItem>
        <ElFormItem v-if="editingId === null" label="初始密码"><ElInput v-model="form.password" type="password" show-password autocomplete="new-password" /></ElFormItem>
        <ElFormItem label="姓名"><ElInput v-model="form.realName" maxlength="50" /></ElFormItem>
        <ElFormItem label="邮箱"><ElInput v-model="form.email" /></ElFormItem>
        <ElFormItem label="联系电话"><ElInput v-model="form.phone" maxlength="20" /></ElFormItem>
        <ElFormItem label="部门"><ElTreeSelect v-model="form.deptId" :data="depts" node-key="id" :props="{ label: 'name', children: 'children' }" check-strictly clearable class="w-full" /></ElFormItem>
        <ElFormItem label="角色"><ElSelect v-model="form.roleIds" multiple class="w-full"><ElOption v-for="role in roles" :key="role.id" :label="role.name" :value="role.id" /></ElSelect></ElFormItem>
        <ElFormItem label="状态"><ElRadioGroup v-model="form.status"><ElRadio :value="1">正常</ElRadio><ElRadio :value="2">停用</ElRadio></ElRadioGroup></ElFormItem>
        <ElFormItem label="备注"><ElInput v-model="form.remark" type="textarea" /></ElFormItem>
      </ElForm>
      <template #footer><ElButton @click="editorOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="save">保存</ElButton></template>
    </ElDialog>

    <ElDialog v-model="resetOpen" :title="`重置 ${resetTarget?.username || ''} 的双因素认证`" width="520px" destroy-on-close>
      <ElAlert title="此操作会撤销目标管理员的当前会话，并记录审计。" type="warning" show-icon :closable="false" class="mb-5" />
      <ElForm label-position="top" @submit.prevent="submitReset">
        <ElFormItem label="你的当前密码"><ElInput v-model="resetForm.currentPassword" type="password" show-password /></ElFormItem>
        <ElFormItem label="你的动态验证码"><ElInput v-model="resetForm.totpCode" maxlength="6" inputmode="numeric" /></ElFormItem>
        <ElFormItem label="操作原因"><ElInput v-model="resetForm.reason" type="textarea" maxlength="500" show-word-limit /></ElFormItem>
      </ElForm>
      <template #footer><ElButton @click="resetOpen = false">取消</ElButton><ElButton type="danger" :loading="saving" @click="submitReset">确认重置</ElButton></template>
    </ElDialog>
  </div>
</template>
