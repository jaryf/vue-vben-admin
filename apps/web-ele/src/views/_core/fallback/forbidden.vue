<script lang="ts" setup>
import { Fallback } from '@vben/common-ui';

defineOptions({ name: 'Fallback403Demo' });
</script>

<template>
  <Fallback
    class="driftly-fallback"
    home-path="/workspace"
    title="暂无访问权限"
    description="当前账号无法访问此页面，请联系管理员确认权限。"
    status="403"
  />
</template>
