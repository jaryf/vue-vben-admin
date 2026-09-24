<script setup lang="ts">
import { computed } from 'vue';

import { useTimezoneStore } from '@vben/stores';

const props = defineProps<{ value?: Date | null | number | string }>();
const timezoneStore = useTimezoneStore();

const instant = computed(() => {
  if (props.value === null || props.value === undefined || props.value === '') {
    return null;
  }
  const parsed = props.value instanceof Date ? props.value : new Date(props.value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
});
const timezone = computed(() => timezoneStore.timezone || 'Asia/Kolkata');
const displayTimezone = computed(() => {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone.value });
    return timezone.value;
  } catch {
    return 'UTC';
  }
});
const utcTime = computed(() => instant.value?.toISOString() || '');
const localTime = computed(() => {
  if (!instant.value) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: displayTimezone.value,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant.value);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
});
</script>

<template>
  <time v-if="instant" class="cursor-help underline decoration-dotted underline-offset-2" :datetime="utcTime" :title="`显示时区：${displayTimezone}；UTC：${utcTime}`">{{ localTime }}</time>
  <span v-else>—</span>
</template>
