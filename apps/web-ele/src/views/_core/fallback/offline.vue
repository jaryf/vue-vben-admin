<script lang="ts" setup>
import { Fallback } from '@vben/common-ui';

defineOptions({ name: 'FallbackOfflineDemo' });
</script>

<template>
  <Fallback
    class="driftly-fallback"
    home-path="/workspace"
    title="网络连接已断开"
    description="请检查网络连接，然后刷新页面。"
    status="offline"
  />
</template>
