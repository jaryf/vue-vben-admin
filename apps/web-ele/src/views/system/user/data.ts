import type {DescriptionsItemType} from '@vben/common-ui';

import type {VbenFormSchema} from '#/adapter/form';
import type {VxeTableGridColumns} from '#/adapter/vxe-table';
import type {SystemUserApi} from '#/api';
import {getDeptList} from '#/api';

import {h} from 'vue';

import {ElTag} from 'element-plus';
import {$t} from '#/locales';

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.user.name'),
      rules: 'required',
    },
    {
      component: 'ApiTreeSelect',
      componentProps: {
        api: getDeptList,
        class: 'w-full',
        clearable: true,
        labelField: 'name',
        valueField: 'id',
        childrenField: 'children',
      },
      fieldName: 'deptId',
      label: $t('system.user.dept'),
      rules: 'required',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        isButton: true,
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('system.user.status'),
    },
    {
      component: 'Textarea',
      fieldName: 'remark',
      label: $t('system.user.remark'),
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.user.name'),
    },
    {
      component: 'Select',
      componentProps: {
        clearable: true,
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
      },
      fieldName: 'status',
      label: $t('system.user.status'),
    },
  ];
}

/**
 * 用户详情描述列表项
 * @param row 用户数据
 */
export function useDescriptionItems(
  row?: SystemUserApi.SystemUser,
): DescriptionsItemType[] {
  const enabled = row?.status === 1;
  return [
    { label: $t('system.user.name'), content: row?.name },
    { label: $t('system.user.id'), content: row?.id },
    { label: $t('system.user.dept'), content: row?.deptId },
    {
      label: $t('system.user.status'),
      content: () =>
        h(
          ElTag,
          {
            type: enabled ? 'success' : 'danger',
          },
          {
            default: () =>
              enabled ? $t('common.enabled') : $t('common.disabled'),
          },
        ),
    },
    { label: $t('system.user.createTime'), content: row?.createTime },
    { label: $t('system.user.remark'), content: row?.remark },
  ];
}

export function useColumns<T = SystemUserApi.SystemUser>(
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns {
  return [
    {
      cellRender: {
        name: 'CellCopyText',
      },
      field: 'username',
      title: $t('system.user.name'),
      width: 200,
    },
    {
      field: 'id',
      title: $t('system.user.id'),
      width: 200,
    },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: $t('system.user.status'),
      width: 100,
    },
    {
      cellRender: {
        name: 'CellCopyText',
      },
      field: 'remark',
      minWidth: 100,
      title: $t('system.user.remark'),
    },
    {
      field: 'createdAt',
      title: $t('system.user.createTime'),
      width: 160,
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('system.user.operation'),
      width: 260,
    },
  ];
}
