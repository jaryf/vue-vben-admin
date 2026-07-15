import {$t} from '#/locales';

export const SYSTEM_STATUS = {
  NORMAL: 1,
  ABNORMAL: 2,
} as const;

export type SystemStatus = (typeof SYSTEM_STATUS)[keyof typeof SYSTEM_STATUS];

export function getSystemStatusOptions() {
  return [
    {
      label: $t('system.statusNormal'),
      type: 'success',
      value: SYSTEM_STATUS.NORMAL,
    },
    {
      label: $t('system.statusAbnormal'),
      type: 'danger',
      value: SYSTEM_STATUS.ABNORMAL,
    },
  ];
}

export function getSystemStatusLabel(status: number) {
  return (
    getSystemStatusOptions().find((item) => item.value === status)?.label ??
    String(status)
  );
}
