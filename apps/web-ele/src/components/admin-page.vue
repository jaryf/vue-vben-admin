<script setup lang="ts">
defineProps<{ description?: string; title: string }>();
</script>

<template>
  <div class="admin-page">
    <header class="admin-page__header">
      <div class="admin-page__intro">
        <h1 class="admin-page__title">{{ title }}</h1>
        <p v-if="description" class="admin-page__description">
          {{ description }}
        </p>
      </div>
      <div v-if="$slots.actions" class="admin-page__actions">
        <slot name="actions"></slot>
      </div>
    </header>
    <div class="admin-page__content">
      <slot></slot>
    </div>
  </div>
</template>
