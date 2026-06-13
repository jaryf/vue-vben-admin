<script lang="ts" setup>
import type {OnActionClickParams, VxeTableGridOptions,} from '#/adapter/vxe-table';
import {useVbenVxeGrid} from '#/adapter/vxe-table';

import {Page, useVbenDrawer} from '@vben/common-ui';
import {IconifyIcon, Plus} from '@vben/icons';
import {$t} from '@vben/locales';

import {ElBadge, ElButton, ElMessage} from 'element-plus';
import {deleteMenu, getMenuList, SystemMenuApi} from '#/api/system/menu';

import {useColumns} from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        query: async (_params) => {
          return await getMenuList();
        },
      },
      response: {
        list: '',
        result: '',
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      zoom: true,
    },
    treeConfig: {
      parentField: 'pid',
      rowField: 'id',
      transform: false,
    },
  } as VxeTableGridOptions,
});

function onActionClick({
  code,
  row,
}: OnActionClickParams<SystemMenuApi.SystemMenu>) {
  switch (code) {
    case 'append': {
      onAppend(row);
      break;
    }
    case 'delete': {
      onDelete(row);
      break;
    }
    case 'edit': {
      onEdit(row);
      break;
    }
    default: {
      break;
    }
  }
}

function onRefresh() {
  gridApi.query();
}
function onEdit(row: SystemMenuApi.SystemMenu) {
  formDrawerApi.setData(row).open();
}
function onCreate() {
  formDrawerApi.setData({}).open();
}
function onAppend(row: SystemMenuApi.SystemMenu) {
  formDrawerApi.setData({ pid: row.id }).open();
}

function onDelete(row: SystemMenuApi.SystemMenu) {
  const loadingMessage = ElMessage({
    duration: 0,
    message: $t('ui.actionMessage.deleting', [row.name]),
    type: 'info',
  });
  deleteMenu(row.id)
    .then(() => {
      loadingMessage.close();
      ElMessage.success({
        message: $t('ui.actionMessage.deleteSuccess', [row.name]),
      });
      onRefresh();
    })
    .catch(() => {
      loadingMessage.close();
    });
}

function getBadgeType(
  badgeVariants: NonNullable<SystemMenuApi.SystemMenu['meta']>['badgeVariants'],
) {
  switch (badgeVariants) {
    case 'destructive': {
      return 'danger';
    }
    case 'primary':
    case 'success':
    case 'warning': {
      return badgeVariants;
    }
    default: {
      return 'info';
    }
  }
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid>
      <template #toolbar-tools>
        <ElButton type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.menu.name')]) }}
        </ElButton>
      </template>
      <template #title="{ row }">
        <div class="flex w-full items-center gap-1">
          <div class="size-5 shrink-0">
            <IconifyIcon
              v-if="row.type === 'button'"
              class="size-full"
              icon="carbon:security"
            />
            <IconifyIcon
              v-else-if="row.meta?.icon"
              :icon="row.meta?.icon || 'carbon:circle-dash'"
              class="size-full"
            />
          </div>
          <span class="flex-auto">{{ $t(row.meta?.title) }}</span>
          <div class="items-center justify-end"></div>
        </div>
        <ElBadge
          v-if="row.meta?.badgeType"
          :is-dot="row.meta.badgeType === 'dot'"
          :type="getBadgeType(row.meta.badgeVariants)"
          :value="row.meta.badgeType === 'normal' ? row.meta.badge : ''"
          class="menu-badge"
        />
      </template>
    </Grid>
  </Page>
</template>
<style lang="scss" scoped>
.menu-badge {
  top: 50%;
  right: 0;
  transform: translateY(-50%);

  & > :deep(div) {
    padding-top: 0;
    padding-bottom: 0;
  }
}
</style>
