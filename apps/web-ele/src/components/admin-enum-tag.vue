<script setup lang="ts">
import type { EnumTone } from '#/utils/enum-presentation';

import { computed } from 'vue';

import { ElTag } from 'element-plus';

import { enumPresentation } from '#/utils/enum-presentation';

const props = defineProps<{
  label?: string;
  tone?: EnumTone;
  value: boolean | null | number | string | undefined;
}>();

const presentation = computed(() => enumPresentation(props.value));
const label = computed(() => props.label || presentation.value.label);
</script>

<template>
  <span v-if="presentation.empty" class="admin-enum-empty" aria-label="未设置">—</span>
  <ElTag
    v-else
    class="admin-enum-tag"
    :type="tone || presentation.tone"
    :title="label === String(value) ? label : `${label} (${value})`"
    effect="light"
    round
    size="small"
    :disable-transitions="true"
  >
    <span class="admin-enum-tag__dot" aria-hidden="true"></span>
    <span class="admin-enum-tag__label">{{ label }}</span>
  </ElTag>
</template>
