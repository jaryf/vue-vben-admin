import type {TableActionProps} from '@vben/common-ui';
import {VbenTableAction as VbenTableActionCore} from '@vben/common-ui';
import type {VxeTableGridOptions} from '@vben/plugins/vxe-table';
import {setupVbenVxeTable, useVbenVxeGrid as useGrid,} from '@vben/plugins/vxe-table';
import type {Recordable} from '@vben/types';

import type {ComponentPropsMap, ComponentType} from './component';

import {defineComponent, h, ref} from 'vue';

import {useAccess} from '@vben/access';
import {IconifyIcon} from '@vben/icons';
import {$te} from '@vben/locales';
import {get, isFunction, isString} from '@vben/utils';

import {objectOmit} from '@vueuse/core';
import {ElButton, ElImage, ElMessage, ElPopconfirm, ElSwitch, ElTag, ElTooltip} from 'element-plus';

import {$t} from '#/locales';

import {useVbenForm} from './form';

function normalizeTagType(type?: string) {
  switch (type) {
    case 'danger':
    case 'destructive':
    case 'error': {
      return 'danger';
    }
    case 'primary':
    case 'processing': {
      return 'primary';
    }
    case 'success':
    case 'warning': {
      return type;
    }
    default: {
      return 'info';
    }
  }
}

setupVbenVxeTable({
  configVxeTable: (vxeUI) => {
    vxeUI.setConfig({
      grid: {
        align: 'center',
        border: true,
        columnConfig: {
          resizable: true,
        },
        minHeight: 180,
        formConfig: {
          // 全局禁用vxe-table的表单配置，使用formOptions
          enabled: false,
        },
        proxyConfig: {
          autoLoad: true,
          response: {
            result: 'items',
            total: 'total',
            list: 'items',
          },
          showActiveMsg: true,
          showResponseMsg: false,
        },
        round: true,
        showOverflow: true,
        size: 'medium',
      } as VxeTableGridOptions,
    });

    vxeUI.renderer.forEach((_item, key) => {
      if (key.startsWith('Cell')) {
        vxeUI.renderer.delete(key);
      }
    });

    // 表格配置项可以用 cellRender: { name: 'CellImage' },
    vxeUI.renderer.add('CellImage', {
      renderTableDefault(renderOpts, params) {
        const { props } = renderOpts;
        const { column, row } = params;
        const src = row[column.field];
        return h(ElImage, { src, previewSrcList: [src], ...props });
      },
    });

    // 表格配置项可以用 cellRender: { name: 'CellLink' },
    vxeUI.renderer.add('CellLink', {
      renderTableDefault(renderOpts) {
        const { props } = renderOpts;
        return h(
          ElButton,
          { size: 'small', link: true },
          { default: () => props?.text },
        );
      },
    });

    // 单元格渲染： Tag
    vxeUI.renderer.add('CellTag', {
      renderTableDefault({ options, props }, { column, row }) {
        const value = get(row, column.field);
        const tagOptions = options ?? [
          { label: $t('common.enabled'), type: 'success', value: 1 },
          { label: $t('common.disabled'), type: 'danger', value: 0 },
        ];
        const tagItem = tagOptions.find((item) => item.value === value);
        const tagProps: Recordable<any> = {
          ...props,
          ...objectOmit(tagItem ?? {}, ['color', 'label', 'value']),
        };
        tagProps.type = normalizeTagType(tagProps.type ?? tagItem?.color);

        return h(ElTag, tagProps, { default: () => tagItem?.label ?? value });
      },
    });

    vxeUI.renderer.add('CellSwitch', {
      renderTableDefault({ attrs, props }, { column, row }) {
        const loadingKey = `__loading_${column.field}`;
        const switchProps = {
          activeText: $t('common.enabled'),
          activeValue: 1,
          inactiveText: $t('common.disabled'),
          inactiveValue: 0,
          inlinePrompt: true,
          ...props,
          loading: row[loadingKey] ?? false,
          modelValue: row[column.field],
          'onUpdate:modelValue': onChange,
        };

        async function onChange(newVal: any) {
          row[loadingKey] = true;
          try {
            const result = await attrs?.beforeChange?.(newVal, row);
            if (result !== false) {
              row[column.field] = newVal;
            }
          } finally {
            row[loadingKey] = false;
          }
        }

        return h(ElSwitch, switchProps);
      },
    });

    /**
     * 注册表格的操作按钮渲染器
     */
    vxeUI.renderer.add('CellOperation', {
      renderTableDefault({ attrs, options, props }, { column, row }) {
        const defaultProps = { link: false, size: 'default', ...props };
        let align: string;
        switch (column.align) {
          case 'center': {
            align = 'center';
            break;
          }
          case 'left': {
            align = 'start';
            break;
          }
          default: {
            align = 'end';
            break;
          }
        }

        const presets: Recordable<Recordable<any>> = {
          delete: {
            danger: true,
            text: $t('common.delete'),
          },
          detail: {
            text: $t('common.detail'),
          },
          edit: {
            text: $t('common.edit'),
          },
        };

        const operations: Array<Recordable<any>> = (
          options || ['edit', 'detail', 'delete']
        )
          .map((opt) => {
            if (isString(opt)) {
              return presets[opt]
                ? { code: opt, ...presets[opt], ...defaultProps }
                : {
                    code: opt,
                    text: $te(`common.${opt}`) ? $t(`common.${opt}`) : opt,
                    ...defaultProps,
                  };
            }
            return { ...defaultProps, ...presets[opt.code], ...opt };
          })
          .map((opt) => {
            const optBtn: Recordable<any> = {};
            Object.keys(opt).forEach((key) => {
              optBtn[key] = isFunction(opt[key]) ? opt[key](row) : opt[key];
            });
            return optBtn;
          })
          .filter((opt) => opt.show !== false);

        function getButtonProps(opt: Recordable<any>) {
          const buttonProps = objectOmit(opt, [
            'code',
            'danger',
            'popConfirm',
            'show',
            'text',
          ]);
          if (opt.danger) {
            buttonProps.type = 'danger';
          }
          return buttonProps;
        }

        function renderBtn(opt: Recordable<any>, listen = true) {
          return h(
            ElButton,
            {
              ...getButtonProps(opt),
              icon: undefined,
              onClick: listen
                ? () =>
                    attrs?.onClick?.({
                      code: opt.code,
                      row,
                    })
                : undefined,
            },
            {
              default: () => {
                const content = [];
                if (opt.icon) {
                  content.push(
                    h(IconifyIcon, { class: 'size-5', icon: opt.icon }),
                  );
                }
                content.push(opt.text);
                return content;
              },
            },
          );
        }

        function renderConfirm(opt: Recordable<any>) {
          return h(
            ElPopconfirm,
            {
              confirmButtonType: opt.danger ? 'danger' : 'primary',
              title: $t('ui.actionMessage.deleteConfirm', [
                row[attrs?.nameField || 'name'],
              ]),
              onConfirm: () => {
                attrs?.onClick?.({
                  code: opt.code,
                  row,
                });
              },
            },
            {
              reference: () => renderBtn({ ...opt }, false),
            },
          );
        }

        const btns = operations.map((opt) =>
          opt.code === 'delete' ? renderConfirm(opt) : renderBtn(opt),
        );
        return h(
          'div',
          {
            class: 'flex table-operations',
            style: { justifyContent: align },
          },
          btns,
        );
      },
    });

    // 添加可复制文本渲染器
    vxeUI.renderer.add('CellCopyText', {
      renderTableDefault(_renderOpts, params) {
        const { column, row } = params;
        const cellValue = row[column.field];
        const disabled = ref(true); // 默认禁用 tooltip

        return h(
          ElTooltip,
          {
            content: cellValue,
            placement: 'top',
            disabled: disabled.value,
          },
          {
            default: () =>
              h(
                'span',
                {
                  class: 'vxe-cell-copy-text',
                  style: {
                    cursor: 'pointer',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'inline-block',
                    maxWidth: '100%',
                  },
                  onClick: async () => {
                    try {
                      await navigator.clipboard.writeText(cellValue || '');
                      ElMessage.success($t('ui.copy.success'));
                    } catch {
                      ElMessage.error($t('ui.copy.failed'));
                    }
                  },
                  onMouseenter: (e: MouseEvent) => {
                    const target = e.currentTarget as HTMLElement;
                    // 判断文本是否溢出
                    disabled.value = target.scrollWidth <= target.clientWidth;
                  },
                },
                cellValue,
              ),
          },
        );
      },
    });

    // 这里可以自行扩展 vxe-table 的全局配置，比如自定义格式化
    // vxeUI.formats.add
  },
  useVbenForm,
});

export const useVbenVxeGrid = <T extends Record<string, any>>(
  ...rest: Parameters<typeof useGrid<T, ComponentType, ComponentPropsMap>>
) => useGrid<T, ComponentType, ComponentPropsMap>(...rest);

/**
 * 表格操作按钮组件
 *
 * 在适配器内部统一注入权限判断（hasPermission），使用方无需再传入 `:has-permission`。
 * 通过 action 的 `auth` 字段声明权限码，结合 `useAccess().hasAccessByCodes` 判断是否展示。
 * 如需自定义权限逻辑，仍可显式传入 `:has-permission` 覆盖默认行为。
 */
export const VbenTableAction = defineComponent(
  (props: TableActionProps, { attrs, slots }) => {
    const { hasAccessByCodes } = useAccess();
    function hasPermission(auth?: string | string[]) {
      if (!auth) return true;
      return hasAccessByCodes(Array.isArray(auth) ? auth : [auth]);
    }
    return () =>
      h(VbenTableActionCore, { hasPermission, ...props, ...attrs }, slots);
  },
  {
    inheritAttrs: false,
    name: 'VbenTableAction',
  },
);

export type OnActionClickParams<T = Recordable<any>> = {
  code: string;
  row: T;
};
export type OnActionClickFn<T = Recordable<any>> = (
  params: OnActionClickParams<T>,
) => void;
export type * from '@vben/plugins/vxe-table';
