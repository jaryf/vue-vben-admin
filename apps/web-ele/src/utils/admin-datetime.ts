import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import timezonePlugin from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezonePlugin);

const ADMIN_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const AMBIGUOUS_TIME_SCAN_STEP_MS = 15 * 60 * 1000;
const AMBIGUOUS_TIME_SCAN_RANGE_MS = 24 * 60 * 60 * 1000;

function assertTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    throw new Error('当前选中的时区无效，请重新选择');
  }
}

function hasAlternativeInstant(
  instantMs: number,
  normalized: string,
  timezone: string,
) {
  for (
    let offsetMs = -AMBIGUOUS_TIME_SCAN_RANGE_MS;
    offsetMs <= AMBIGUOUS_TIME_SCAN_RANGE_MS;
    offsetMs += AMBIGUOUS_TIME_SCAN_STEP_MS
  ) {
    if (offsetMs === 0) continue;
    if (
      dayjs(instantMs + offsetMs).tz(timezone).format(ADMIN_DATETIME_FORMAT) ===
      normalized
    ) {
      return true;
    }
  }
  return false;
}

function parseAdminDateTime(value: string, timezone: string) {
  const normalized = value.trim();
  assertTimezone(timezone);
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
    throw new Error('请输入完整的日期和时间');
  }
  const parsed = dayjs.tz(normalized, ADMIN_DATETIME_FORMAT, timezone);
  // DST 跳变期间不存在的本地时间会被 dayjs 自动平移，必须拒绝这种隐式转换。
  if (!parsed.isValid() || parsed.format(ADMIN_DATETIME_FORMAT) !== normalized) {
    throw new Error(`该时刻在时区 ${timezone} 中不存在`);
  }
  // DST 回拨可能让同一个墙上时间对应两个 UTC 时刻；当前输入没有偏移量，禁止静默选取其中一个。
  if (hasAlternativeInstant(parsed.valueOf(), normalized, timezone)) {
    throw new Error(`该时刻在时区 ${timezone} 中重复，请选择其他时刻`);
  }
  return parsed;
}

function adminDateTimeToUtc(value: null | string | undefined, timezone: string) {
  if (!value?.trim()) return undefined;
  return parseAdminDateTime(value, timezone)
    .utc()
    .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
}

function utcToAdminDateTime(
  value: Date | number | string,
  timezone: string,
) {
  assertTimezone(timezone);
  const parsed = dayjs(value);
  if (!parsed.isValid()) throw new Error('无法解析日期时间');
  return parsed.tz(timezone).format(ADMIN_DATETIME_FORMAT);
}

function adminDateTimeRangeToUtc(
  range: null | string[] | undefined,
  timezone: string,
): [string, string] | undefined {
  if (!range || range.length !== 2 || !range[0] || !range[1]) return undefined;
  const from = parseAdminDateTime(range[0], timezone);
  const until = parseAdminDateTime(range[1], timezone);
  if (!until.isAfter(from)) throw new Error('结束时间必须晚于开始时间');
  return [
    from.utc().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
    until.utc().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
  ];
}

export {
  ADMIN_DATETIME_FORMAT,
  adminDateTimeRangeToUtc,
  adminDateTimeToUtc,
  utcToAdminDateTime,
};
