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

/**
 * 将业务侧或旧适配层传入的标签类型统一映射到 Element Plus 支持的类型。
 *
 * 背景：
 * - 旧页面或跨组件配置里可能沿用 `destructive`、`error`、`processing` 等命名。
 * - Element Plus 的 `ElTag` 只识别固定的 type 值，这里集中转换，避免每个表格列重复处理。
 */
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
    /**
     * vxe-table 全局 Grid 默认配置。
     *
     * 这里定义的是 `apps/web-ele` 下所有通过 `useVbenVxeGrid` 创建的表格默认行为。
     * 具体页面仍然可以在自己的 grid 配置中覆盖这些默认项。
     */
    vxeUI.setConfig({
      grid: {
        // 默认居中显示单元格内容；个别列可通过 column.align 覆盖。
        align: 'center',
        // 使用带边框表格，和后台管理类页面的密集信息展示风格保持一致。
        border: true,
        columnConfig: {
          // 允许用户拖动调整列宽。
          resizable: true,
        },
        // 给空数据或加载前状态保留最小高度，减少页面跳动。
        minHeight: 180,
        formConfig: {
          // 全局禁用vxe-table的表单配置，使用formOptions
          enabled: false,
        },
        proxyConfig: {
          // 表格初始化后自动请求数据。
          autoLoad: true,
          /**
           * 统一分页响应字段。
           *
           * 默认接口响应需要提供：
           * - `items`：当前页数据列表
           * - `total`：总条数
           *
           * 如果某个页面接口返回的是树数据或其他结构，需要在页面内单独覆盖 proxy response。
           */
          response: {
            result: 'items',
            total: 'total',
            list: 'items',
          },
          // 请求过程中显示 vxe-table 内置的激活状态提示。
          showActiveMsg: true,
          // 不使用 vxe-table 的接口返回消息提示，避免和业务侧消息提示重复。
          showResponseMsg: false,
        },
        // 表格外观使用圆角。
        round: true,
        // 单元格内容超出时由 vxe-table 控制省略和悬浮展示。
        showOverflow: true,
        // Element Plus / vxe-table 默认尺寸使用 medium，和本应用表单控件密度保持一致。
        size: 'medium',
      } as VxeTableGridOptions,
    });

    /**
     * 清理上游或其他适配层中已经注册过的 Cell 渲染器。
     *
     * `web-ele` 使用 Element Plus 组件实现这些 `Cell*` 渲染器；如果保留旧实现，
     * 同名渲染器可能指向其他 UI 框架组件，导致运行时渲染不一致。
     */
    vxeUI.renderer.forEach((_item, key) => {
      if (key.startsWith('Cell')) {
        vxeUI.renderer.delete(key);
      }
    });

    /**
     * 图片单元格渲染器。
     *
     * 表格配置示例：`cellRender: { name: 'CellImage' }`。
     * 当前单元格字段值会作为图片地址，并同时加入预览列表，实现点击预览。
     */
    vxeUI.renderer.add('CellImage', {
      renderTableDefault(renderOpts, params) {
        const { props } = renderOpts;
        const { column, row } = params;
        // 按列字段名从行数据里取图片地址。
        const src = row[column.field];
        // props 透传给 ElImage，便于页面配置 fit、style、previewTeleport 等属性。
        return h(ElImage, { src, previewSrcList: [src], ...props });
      },
    });

    /**
     * 链接样式按钮单元格渲染器。
     *
     * 表格配置示例：`cellRender: { name: 'CellLink', props: { text: '...' } }`。
     * 这里只负责渲染链接外观，点击事件等行为由调用方继续通过 props / attrs 扩展。
     */
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

    /**
     * 标签单元格渲染器。
     *
     * 默认将 `1` 渲染为启用、`0` 渲染为禁用。
     * 页面可以通过 `cellRender.options` 传入自定义枚举：
     * `{ label, value, type, color }`。
     */
    vxeUI.renderer.add('CellTag', {
      renderTableDefault({ options, props }, { column, row }) {
        // 使用 get 支持 `a.b.c` 这类嵌套字段路径。
        const value = get(row, column.field);
        // 未配置 options 时，按常见启用/禁用状态兜底。
        const tagOptions = options ?? [
          { label: $t('common.enabled'), type: 'success', value: 1 },
          { label: $t('common.disabled'), type: 'danger', value: 0 },
        ];
        // 按当前单元格值找到对应枚举项。
        const tagItem = tagOptions.find((item) => item.value === value);
        /**
         * 合并标签属性。
         *
         * `label`、`value` 是业务枚举字段，不能直接传给 ElTag。
         * `color` 只作为兼容字段参与 type 归一化，不直接传入。
         */
        const tagProps: Recordable<any> = {
          ...props,
          ...objectOmit(tagItem ?? {}, ['color', 'label', 'value']),
        };
        // 兼容旧字段 color 和旧类型命名，最终只给 ElTag 传它能识别的 type。
        tagProps.type = normalizeTagType(tagProps.type ?? tagItem?.color);

        // 找不到枚举项时直接展示原始值，避免空白单元格影响排查数据问题。
        return h(ElTag, tagProps, { default: () => tagItem?.label ?? value });
      },
    });

    /**
     * 开关单元格渲染器。
     *
     * 用于列表内直接切换启用/禁用等二值状态。
     * 调用方可以通过 `attrs.beforeChange(newVal, row)` 做接口提交或二次确认；
     * 返回 `false` 时不会把新值写回当前行。
     */
    vxeUI.renderer.add('CellSwitch', {
      renderTableDefault({ attrs, props }, { column, row }) {
        // 每个字段使用独立 loading 标记，避免同一行多个开关互相影响。
        const loadingKey = `__loading_${column.field}`;
        const switchProps = {
          // 默认使用应用内通用启用/禁用文案和值。
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

        /**
         * 处理开关值变更。
         *
         * 先把当前单元格置为 loading，再执行外部 beforeChange。
         * 外部逻辑成功或未显式返回 false 时，才更新 row[column.field]。
         */
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
     * 操作列按钮渲染器。
     *
     * 表格配置示例：`cellRender: { name: 'CellOperation', options: [...] }`。
     * 默认渲染 `edit`、`detail`、`delete` 三个操作；页面也可以传字符串或对象来自定义。
     */
    vxeUI.renderer.add('CellOperation', {
      renderTableDefault({ attrs, options, props }, { column, row }) {
        // 所有按钮的默认属性，页面传入的 props 会覆盖前面的默认值。
        const defaultProps = { link: true, size: 'default', ...props };
        let align: string;
        // 将表格列的 align 转换为 flex 的 justify-content 值。
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

        /**
         * 内置操作预设。
         *
         * 字符串配置命中这些 code 时，会自动补齐默认文本和危险状态。
         */
        const presets: Recordable<Recordable<any>> = {
          detail: {
            icon: 'lucide:eye',
            text: $t('common.detail'),
            type: 'primary',
          },
          delete: {
            icon: 'lucide:trash-2',
            text: $t('common.delete'),
            type: 'danger',
          },
          edit: {
            icon: 'lucide:edit',
            text: $t('common.edit'),
            type: 'warning',
          },
        };

        /**
         * 规范化操作项。
         *
         * 支持两种写法：
         * - 字符串：`'edit'`
         * - 对象：`{ code: 'edit', text: '...' }`
         *
         * 操作项上的函数属性会在这里以当前 row 为入参执行，便于按行控制文本、显隐、禁用等。
         */
        const operations: Array<Recordable<any>> = (
          options || ['detail', 'edit', 'delete']
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

        /**
         * 提取可传给 ElButton 的属性。
         *
         * `code`、`icon`、`popConfirm`、`show`、`text` 是本渲染器内部字段；
         * `danger` 会转换为 Element Plus 的 `type="danger"`。
         */
        function getButtonProps(opt: Recordable<any>) {
          const buttonProps = objectOmit(opt, [
            'code',
            'danger',
            'icon',
            'popConfirm',
            'show',
            'text',
          ]);
          if (opt.danger) {
            buttonProps.type = 'danger';
          }
          return buttonProps;
        }

        /**
         * 渲染单个操作按钮。
         *
         * listen 为 false 时只渲染按钮外观，不绑定点击事件；
         * 这用于 Popconfirm 的 reference，避免用户点击时绕过确认框。
         */
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
                // 操作项配置 icon 时，在按钮文字前渲染图标。
                if (opt.icon) {
                  content.push(
                    h(IconifyIcon, { class: 'size-4', icon: opt.icon }),
                  );
                }
                content.push(opt.text);
                return content;
              },
            },
          );
        }

        /**
         * 渲染删除确认框。
         *
         * 当前逻辑只对 code 为 `delete` 的操作自动包裹确认框。
         * 标题中的名称字段默认读取 row.name，也可通过 attrs.nameField 指定。
         */
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

        // delete 操作使用确认框，其余操作直接渲染按钮。
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

    /**
     * 可复制文本单元格渲染器。
     *
     * 单元格内容点击后写入剪贴板，并根据复制结果显示成功或失败提示。
     * 文本没有发生省略时禁用 Tooltip，只有内容溢出时才显示完整文本悬浮提示。
     */
    vxeUI.renderer.add('CellCopyText', {
      renderTableDefault(_renderOpts, params) {
        const { column, row } = params;
        // 当前列字段对应的原始展示值。
        const cellValue = row[column.field];
        // 默认禁用 tooltip；鼠标移入时根据实际宽度判断是否开启。
        const disabled = ref(true);

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
                      // Clipboard API 需要安全上下文；失败时走 catch 给出统一错误提示。
                      await navigator.clipboard.writeText(cellValue || '');
                      ElMessage.success($t('ui.copy.success'));
                    } catch {
                      ElMessage.error($t('ui.copy.failed'));
                    }
                  },
                  onMouseenter: (e: MouseEvent) => {
                    const target = e.currentTarget as HTMLElement;
                    // scrollWidth 大于 clientWidth 代表文本被省略，此时开启 Tooltip。
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
    // 未声明 auth 的按钮默认可见；声明后统一走 access 模块校验。
    function hasPermission(auth?: string | string[]) {
      if (!auth) return true;
      // useAccess().hasAccessByCodes 接收权限码数组，单个字符串在这里统一转成数组。
      return hasAccessByCodes(Array.isArray(auth) ? auth : [auth]);
    }
    return () =>
      // 显式传入的 attrs 放在最后，允许页面覆盖默认注入的 hasPermission。
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
