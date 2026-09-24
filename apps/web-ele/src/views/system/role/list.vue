<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  createAdminRole, deleteAdminRole, listAdminMenus, listAdminRoles, updateAdminRole,
} from '#/api/system';
import type { AdminMenu, AdminRole } from '#/api/system';

const { hasAccessByCodes } = useAccess();
const canCreate = computed(() => hasAccessByCodes(['system_role.create']));
const canUpdate = computed(() => hasAccessByCodes(['system_role.update']));
const canDelete = computed(() => hasAccessByCodes(['system_role.delete']));
const filter = reactive({ name: '', code: '', status: '' });
const rows = ref<AdminRole[]>([]);
const menus = ref<AdminMenu[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);
const saving = ref(false);
const editorOpen = ref(false);
const editingId = ref<number | null>(null);
const treeRef = ref<{ getCheckedKeys: () => number[]; setCheckedKeys: (ids: number[]) => void } | null>(null);
const form = reactive({ name: '', code: '', status: 1, remark: '' });

async function load() {
  loading.value = true;
  try {
    const result = await listAdminRoles({
      page: page.value, pageSize: pageSize.value,
      name: filter.name.trim() || undefined,
      code: filter.code.trim() || undefined,
      status: filter.status || undefined,
    });
    rows.value = result.items || [];
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

function search() { page.value = 1; void load(); }

async function openEditor(row?: AdminRole) {
  editingId.value = row?.id ?? null;
  Object.assign(form, {
    name: row?.name ?? '', code: row?.code ?? '', status: row?.status ?? 1,
    remark: row?.remark ?? '',
  });
  menus.value = await listAdminMenus();
  editorOpen.value = true;
  await nextTick();
  treeRef.value?.setCheckedKeys(row?.menuIds || []);
}

async function save() {
  if (form.name.trim().length < 2 || form.code.trim().length < 2) {
    ElMessage.error('角色名称和编码至少 2 个字符');
    return;
  }
  saving.value = true;
  try {
    const data = {
      name: form.name.trim(), status: form.status, remark: form.remark.trim(),
      menuIds: treeRef.value?.getCheckedKeys() || [],
    };
    if (editingId.value === null) {
      await createAdminRole({ ...data, code: form.code.trim() });
    } else {
      await updateAdminRole(editingId.value, data);
    }
    editorOpen.value = false;
    ElMessage.success('角色已保存');
    await load();
  } finally {
    saving.value = false;
  }
}

async function remove(row: AdminRole) {
  await ElMessageBox.confirm(`确定删除角色「${row.name}」吗？`, '删除角色', { type: 'warning' });
  await deleteAdminRole(row.id);
  ElMessage.success('角色已删除');
  await load();
}

onMounted(() => { void load(); });
</script>

<template>
  <div class="p-5">
    <ElCard shadow="never">
      <template #header><div class="flex items-center justify-between"><span>角色管理</span><ElButton v-if="canCreate" type="primary" @click="openEditor()">新增角色</ElButton></div></template>
      <div class="mb-4 flex flex-wrap gap-3">
        <ElInput v-model="filter.name" placeholder="角色名称" clearable class="!w-44" @keyup.enter="search" />
        <ElInput v-model="filter.code" placeholder="角色编码" clearable class="!w-44" @keyup.enter="search" />
        <ElSelect v-model="filter.status" placeholder="全部状态" clearable class="!w-36"><ElOption label="正常" value="1" /><ElOption label="停用" value="2" /></ElSelect>
        <ElButton @click="search">查询</ElButton>
      </div>
      <ElTable v-loading="loading" :data="rows" row-key="id" class="w-full">
        <ElTableColumn prop="name" label="角色名称" min-width="150" />
        <ElTableColumn prop="code" label="角色编码" min-width="150" />
        <ElTableColumn label="状态" width="90"><template #default="{ row }"><ElTag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '正常' : '停用' }}</ElTag></template></ElTableColumn>
        <ElTableColumn prop="remark" label="备注" min-width="160" show-overflow-tooltip />
        <ElTableColumn prop="createdAt" label="创建时间" min-width="175" />
        <ElTableColumn v-if="canUpdate || canDelete" label="操作" width="145" fixed="right"><template #default="{ row }"><ElButton v-if="canUpdate" link type="primary" @click="openEditor(row)">编辑</ElButton><ElButton v-if="canDelete" link type="danger" @click="remove(row)">删除</ElButton></template></ElTableColumn>
      </ElTable>
      <div class="mt-4 flex justify-end"><ElPagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[20, 50, 100]" layout="total, sizes, prev, pager, next" @change="load" /></div>
    </ElCard>

    <ElDialog v-model="editorOpen" :title="editingId === null ? '新增角色' : '编辑角色'" width="680px" destroy-on-close>
      <ElForm label-width="90px" @submit.prevent="save">
        <ElFormItem label="角色名称"><ElInput v-model="form.name" maxlength="50" /></ElFormItem>
        <ElFormItem label="角色编码"><ElInput v-model="form.code" :disabled="editingId !== null" maxlength="50" /></ElFormItem>
        <ElFormItem label="状态"><ElRadioGroup v-model="form.status"><ElRadio :value="1">正常</ElRadio><ElRadio :value="2">停用</ElRadio></ElRadioGroup></ElFormItem>
        <ElFormItem label="备注"><ElInput v-model="form.remark" type="textarea" /></ElFormItem>
        <ElFormItem label="菜单与权限">
          <div class="max-h-80 w-full overflow-auto rounded border p-3">
            <ElTree ref="treeRef" :data="menus" node-key="id" show-checkbox check-strictly default-expand-all :props="{ children: 'children', label: 'name' }">
              <template #default="{ data }"><span>{{ data.name }}<span v-if="data.authCode" class="ml-2 text-xs text-gray-400">{{ data.authCode }}</span></span></template>
            </ElTree>
          </div>
        </ElFormItem>
      </ElForm>
      <template #footer><ElButton @click="editorOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="save">保存</ElButton></template>
    </ElDialog>
  </div>
</template>
