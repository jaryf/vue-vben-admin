<script lang="ts" setup>
import { Fallback } from '@vben/common-ui';

defineOptions({ name: 'Fallback404Demo' });
</script>

<template>
  <Fallback
    class="driftly-fallback"
    home-path="/workspace"
    title="页面未找到"
    description="页面可能已移动，或访问地址有误。"
    status="404"
  />
</template>
