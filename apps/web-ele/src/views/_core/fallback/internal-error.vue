<script lang="ts" setup>
import { Fallback } from '@vben/common-ui';

defineOptions({ name: 'Fallback500Demo' });
</script>

<template>
  <Fallback
    class="driftly-fallback"
    home-path="/workspace"
    title="服务暂时不可用"
    description="请稍后刷新页面重试。"
    status="500"
  />
</template>
