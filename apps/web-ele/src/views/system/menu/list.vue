<script setup lang="ts">
import type { AdminMenu } from '#/api/system';

import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';

import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElRadio,
  ElRadioGroup,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTreeSelect,
} from 'element-plus';

import {
  createAdminMenu,
  deleteAdminMenu,
  listAdminMenus,
  updateAdminMenu,
} from '#/api/system';
import AdminEnumTag from '#/components/admin-enum-tag.vue';
import AdminPage from '#/components/admin-page.vue';
import { $t } from '#/locales';
import { confirmDialog } from '#/utils/message-box';

const menuTypeLabels: Record<string, string> = {
  catalog: '目录',
  menu: '页面',
  button: '操作按钮',
  link: '外部链接',
  embedded: '嵌入页面',
};

const { hasAccessByCodes } = useAccess();
const canCreate = computed(() => hasAccessByCodes(['system_menu.create']));
const canUpdate = computed(() => hasAccessByCodes(['system_menu.update']));
const canDelete = computed(() => hasAccessByCodes(['system_menu.delete']));
const rows = ref<AdminMenu[]>([]);
const loading = ref(false);
const saving = ref(false);
const editorOpen = ref(false);
const editingId = ref<null | number>(null);
const existingMeta = ref<Record<string, unknown>>({});
const form = reactive({
  parentId: 0 as null | number,
  name: '',
  path: '',
  component: '',
  type: 'menu',
  icon: '',
  authCode: '',
  status: 1,
  sortOrder: 0,
  title: '',
});

function omitDescendants(nodes: AdminMenu[], forbidden: number): AdminMenu[] {
  return nodes
    .filter((node) => node.id !== forbidden)
    .map((node) => ({
      ...node,
      children: node.children ? omitDescendants(node.children, forbidden) : [],
    }));
}
const parentOptions = computed(() =>
  omitDescendants(rows.value, editingId.value ?? -1),
);

async function load() {
  loading.value = true;
  try {
    rows.value = (await listAdminMenus()) || [];
  } finally {
    loading.value = false;
  }
}

function openEditor(row?: AdminMenu) {
  editingId.value = row?.id ?? null;
  existingMeta.value = row?.meta || {};
  Object.assign(form, {
    parentId: row?.parentId ?? 0,
    name: row?.name ?? '',
    path: row?.path ?? '',
    component: row?.component ?? '',
    type: row?.type ?? 'menu',
    icon: row?.icon ?? '',
    authCode: row?.authCode ?? '',
    status: row?.status ?? 1,
    sortOrder: row?.sortOrder ?? 0,
    title: String(row?.meta?.title ?? ''),
  });
  editorOpen.value = true;
}

async function save() {
  if (form.name.trim().length < 2 || !form.title.trim()) {
    ElMessage.error('请输入菜单标识和显示标题');
    return;
  }
  saving.value = true;
  try {
    const data = {
      parentId: form.parentId ?? 0,
      name: form.name.trim(),
      path: form.path.trim(),
      component: form.component.trim(),
      type: form.type,
      icon: form.icon.trim(),
      authCode: form.authCode.trim(),
      status: form.status,
      sortOrder: form.sortOrder,
      meta: {
        ...existingMeta.value,
        title: form.title.trim(),
        icon: form.icon.trim(),
        order: form.sortOrder,
      },
    };
    await (editingId.value === null
      ? createAdminMenu(data)
      : updateAdminMenu(editingId.value, data));
    editorOpen.value = false;
    ElMessage.success('菜单已保存');
    await load();
  } finally {
    saving.value = false;
  }
}

async function remove(row: AdminMenu) {
  if (
    !(await confirmDialog(`确定删除「${row.name}」吗？`, '删除菜单', {
      type: 'warning',
    }))
  )
    return;
  await deleteAdminMenu(row.id);
  ElMessage.success('菜单已删除');
  await load();
}

onMounted(() => {
  void load();
});
</script>

<template>
  <AdminPage
    title="菜单与权限"
    description="统一管理导航结构、页面入口与操作权限。"
  >
    <template #actions>
      <ElButton :loading="loading" @click="load">刷新</ElButton>
      <ElButton v-if="canCreate" type="primary" @click="openEditor()">
        新增菜单
      </ElButton>
    </template>
    <section class="admin-panel">
      <div class="mb-5">
        <h2 class="text-base font-semibold text-foreground">菜单结构</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          按层级展示菜单、页面和权限按钮。
        </p>
      </div>
      <ElTable
        v-loading="loading"
        :data="rows"
        row-key="id"
        default-expand-all
        class="w-full"
      >
        <ElTableColumn prop="name" label="标识" min-width="175" />
        <ElTableColumn label="标题" min-width="150">
          <template #default="{ row }">
            {{ row.meta?.title ? $t(String(row.meta.title)) : '—' }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="类型" width="110">
          <template #default="{ row }">
            <AdminEnumTag
              :value="row.type"
              :label="menuTypeLabels[row.type] || row.type"
              :tone="row.type === 'catalog' ? 'primary' : 'info'"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn
          prop="path"
          label="路由"
          min-width="180"
          show-overflow-tooltip
        />
        <ElTableColumn
          prop="component"
          label="页面组件"
          min-width="220"
          show-overflow-tooltip
        />
        <ElTableColumn
          prop="authCode"
          label="权限码"
          min-width="180"
          show-overflow-tooltip
        />
        <ElTableColumn label="状态" width="120">
          <template #default="{ row }">
            <AdminEnumTag
              :value="row.status"
              :label="row.status === 1 ? '正常' : '停用'"
              :tone="row.status === 1 ? 'success' : 'info'"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn prop="sortOrder" label="排序" width="80" />
        <!-- @vue-generic {AdminMenu} --><ElTableColumn
          v-if="canUpdate || canDelete"
          label="操作"
          width="145"
          fixed="right"
        >
          <template #default="{ row }">
            <ElButton
              v-if="canUpdate"
              link
              type="primary"
              @click="openEditor(row)"
            >
              编辑
            </ElButton>
            <ElButton v-if="canDelete" link type="danger" @click="remove(row)">
              删除
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </section>

    <ElDialog
      v-model="editorOpen"
      :title="editingId === null ? '新增菜单' : '编辑菜单'"
      width="680px"
      destroy-on-close
    >
      <ElForm
        label-position="top"
        class="admin-dialog-form"
        @submit.prevent="save"
      >
        <ElFormItem label="上级菜单">
          <ElTreeSelect
            v-model="form.parentId"
            :data="parentOptions"
            node-key="id"
            :props="{ label: 'name', children: 'children' }"
            check-strictly
            clearable
            class="w-full"
            placeholder="不选择表示顶级"
          />
        </ElFormItem>
        <ElFormItem label="菜单标识">
          <ElInput v-model="form.name" maxlength="50" />
        </ElFormItem>
        <ElFormItem label="显示标题">
          <ElInput v-model="form.title" maxlength="100" />
        </ElFormItem>
        <ElFormItem label="类型">
          <ElSelect v-model="form.type" class="w-full">
            <ElOption label="目录" value="catalog" /><ElOption
              label="页面"
              value="menu"
            /><ElOption label="按钮" value="button" /><ElOption
              label="外链"
              value="link"
            /><ElOption label="嵌入页" value="embedded" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="路由路径">
          <ElInput
            v-model="form.path"
            maxlength="200"
            placeholder="例如 /system/user"
          />
        </ElFormItem>
        <ElFormItem label="页面组件">
          <ElInput
            v-model="form.component"
            maxlength="200"
            placeholder="例如 /system/user/list"
          />
        </ElFormItem>
        <ElFormItem label="图标">
          <ElInput v-model="form.icon" placeholder="例如 carbon:settings" />
        </ElFormItem>
        <ElFormItem label="权限码">
          <ElInput
            v-model="form.authCode"
            placeholder="例如 system_user.read"
          />
        </ElFormItem>
        <ElFormItem label="排序">
          <ElInputNumber v-model="form.sortOrder" :min="0" />
        </ElFormItem>
        <ElFormItem label="状态">
          <ElRadioGroup v-model="form.status">
            <ElRadio :value="1">正常</ElRadio><ElRadio :value="2">停用</ElRadio>
          </ElRadioGroup>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="editorOpen = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="save">
          保存
        </ElButton>
      </template>
    </ElDialog>
  </AdminPage>
</template>
