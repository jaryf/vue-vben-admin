<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';

import { ElMessage, ElMessageBox } from 'element-plus';

import { createAdminDept, deleteAdminDept, listAdminDepts, updateAdminDept } from '#/api/system';
import type { AdminDept } from '#/api/system';

const { hasAccessByCodes } = useAccess();
const canCreate = computed(() => hasAccessByCodes(['system_department.create']));
const canUpdate = computed(() => hasAccessByCodes(['system_department.update']));
const canDelete = computed(() => hasAccessByCodes(['system_department.delete']));
const rows = ref<AdminDept[]>([]);
const loading = ref(false);
const saving = ref(false);
const editorOpen = ref(false);
const editingId = ref<number | null>(null);
const form = reactive({ parentId: 0 as null | number, name: '', status: 1, remark: '', sortOrder: 0 });

function omitDescendants(nodes: AdminDept[], forbidden: number): AdminDept[] {
  return nodes.filter((node) => node.id !== forbidden).map((node) => ({
    ...node, children: node.children ? omitDescendants(node.children, forbidden) : [],
  }));
}
const parentOptions = computed(() => omitDescendants(rows.value, editingId.value ?? -1));

async function load() {
  loading.value = true;
  try { rows.value = (await listAdminDepts()) || []; }
  finally { loading.value = false; }
}

function openEditor(row?: AdminDept) {
  editingId.value = row?.id ?? null;
  Object.assign(form, {
    parentId: row?.parentId ?? 0, name: row?.name ?? '', status: row?.status ?? 1,
    remark: row?.remark ?? '', sortOrder: row?.sortOrder ?? 0,
  });
  editorOpen.value = true;
}

async function save() {
  if (form.name.trim().length < 2) { ElMessage.error('部门名称至少 2 个字符'); return; }
  saving.value = true;
  try {
    const data = {
      parentId: form.parentId ?? 0, name: form.name.trim(), status: form.status,
      remark: form.remark.trim(), sortOrder: form.sortOrder,
    };
    if (editingId.value === null) await createAdminDept(data);
    else await updateAdminDept(editingId.value, data);
    editorOpen.value = false;
    ElMessage.success('部门已保存');
    await load();
  } finally { saving.value = false; }
}

async function remove(row: AdminDept) {
  await ElMessageBox.confirm(`确定删除部门「${row.name}」吗？`, '删除部门', { type: 'warning' });
  await deleteAdminDept(row.id);
  ElMessage.success('部门已删除');
  await load();
}

onMounted(() => { void load(); });
</script>

<template>
  <div class="p-5">
    <ElCard shadow="never">
      <template #header><div class="flex items-center justify-between"><span>部门管理</span><ElButton v-if="canCreate" type="primary" @click="openEditor()">新增部门</ElButton></div></template>
      <ElTable v-loading="loading" :data="rows" row-key="id" default-expand-all class="w-full">
        <ElTableColumn prop="name" label="部门名称" min-width="260" />
        <ElTableColumn label="状态" width="100"><template #default="{ row }"><ElTag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '正常' : '停用' }}</ElTag></template></ElTableColumn>
        <ElTableColumn prop="sortOrder" label="排序" width="90" />
        <ElTableColumn prop="remark" label="备注" min-width="220" show-overflow-tooltip />
        <ElTableColumn v-if="canUpdate || canDelete" label="操作" width="145" fixed="right"><template #default="{ row }"><ElButton v-if="canUpdate" link type="primary" @click="openEditor(row)">编辑</ElButton><ElButton v-if="canDelete" link type="danger" @click="remove(row)">删除</ElButton></template></ElTableColumn>
      </ElTable>
    </ElCard>

    <ElDialog v-model="editorOpen" :title="editingId === null ? '新增部门' : '编辑部门'" width="560px" destroy-on-close>
      <ElForm label-width="90px" @submit.prevent="save">
        <ElFormItem label="上级部门"><ElTreeSelect v-model="form.parentId" :data="parentOptions" node-key="id" :props="{ label: 'name', children: 'children' }" check-strictly clearable class="w-full" placeholder="不选择表示顶级" /></ElFormItem>
        <ElFormItem label="部门名称"><ElInput v-model="form.name" maxlength="50" /></ElFormItem>
        <ElFormItem label="排序"><ElInputNumber v-model="form.sortOrder" :min="0" /></ElFormItem>
        <ElFormItem label="状态"><ElRadioGroup v-model="form.status"><ElRadio :value="1">正常</ElRadio><ElRadio :value="2">停用</ElRadio></ElRadioGroup></ElFormItem>
        <ElFormItem label="备注"><ElInput v-model="form.remark" type="textarea" /></ElFormItem>
      </ElForm>
      <template #footer><ElButton @click="editorOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="save">保存</ElButton></template>
    </ElDialog>
  </div>
</template>
