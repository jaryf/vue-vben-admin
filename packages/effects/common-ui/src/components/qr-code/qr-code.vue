<script setup lang="ts">
import { ref, watch } from 'vue';

import QRCode from 'qrcode';

const props = withDefaults(defineProps<{ alt?: string; value: string }>(), {
  alt: '二维码',
});

const imageUrl = ref('');
const failed = ref(false);

watch(
  () => props.value,
  async (value, _previousValue, onCleanup) => {
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });
    imageUrl.value = '';
    failed.value = false;
    if (!value) return;

    try {
      const result = await QRCode.toDataURL(value, {
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M',
        margin: 4,
        width: 240,
      });
      if (!cancelled) imageUrl.value = result;
    } catch {
      if (!cancelled) failed.value = true;
    }
  },
  { immediate: true },
);
</script>

<template>
  <div
    v-if="value"
    class="inline-flex size-60 max-w-full items-center justify-center rounded-lg bg-white text-gray-700"
  >
    <img
      v-if="imageUrl"
      :src="imageUrl"
      :alt="alt"
      width="240"
      height="240"
      class="max-w-full rounded-lg"
    />
    <p v-else-if="failed" role="alert" class="p-4 text-center text-sm">
      二维码生成失败，请使用手动输入方式。
    </p>
    <p v-else role="status" class="text-sm">正在生成二维码…</p>
  </div>
</template>
