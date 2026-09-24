<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { useElementPlusDesignTokens } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

import { ElConfigProvider, ElMessage } from 'element-plus';

import { elementLocale } from '#/locales';
import { useAuthStore } from '#/store';

defineOptions({ name: 'App' });

useElementPlusDesignTokens();

const idleTimeoutMs = 30 * 60 * 1000;
const activityStorageKey = 'driftly.admin.last-user-activity';
const accessStore = useAccessStore();
const authStore = useAuthStore();
const locking = ref(false);
let lastActivity = Date.now();
let lastPersisted = 0;
let idleTimer: null | number = null;

function readActivity() {
  try {
    const value = Number(sessionStorage.getItem(activityStorageKey));
    if (value > 0 && value <= Date.now()) return value;
    const now = Date.now();
    sessionStorage.setItem(activityStorageKey, String(now));
    return now;
  } catch { return Date.now(); }
}
function persistActivity() {
  if (lastActivity - lastPersisted < 10_000) return;
  try { sessionStorage.setItem(activityStorageKey, String(lastActivity)); } catch { /* Storage may be disabled. */ }
  lastPersisted = lastActivity;
}
function clearTimer() {
  if (idleTimer !== null) window.clearTimeout(idleTimer);
  idleTimer = null;
}
function scheduleCheck() {
  clearTimer();
  if (accessStore.accessToken && !locking.value) {
    idleTimer = window.setTimeout(checkIdle, Math.max(0, idleTimeoutMs - (Date.now() - lastActivity)));
  }
}
async function lockIdleSession() {
  if (locking.value || !accessStore.accessToken) return;
  locking.value = true;
  clearTimer();
  try {
    await authStore.lockIdleSession();
    ElMessage.info('已超过 30 分钟无操作，请重新登录');
    locking.value = false;
  } catch {
    // Keep the screen covered if navigation fails after local session cleanup.
    accessStore.setAccessToken(null);
  }
}
function checkIdle() {
  if (!accessStore.accessToken || locking.value) return;
  if (Date.now() - lastActivity >= idleTimeoutMs) {
    void lockIdleSession();
  } else {
    scheduleCheck();
  }
}
function recordActivity() {
  if (!accessStore.accessToken || locking.value) return;
  const now = Date.now();
  if (now - lastActivity >= idleTimeoutMs) { void lockIdleSession(); return; }
  if (now - lastActivity < 1000) return;
  lastActivity = now;
  persistActivity();
}
function checkOnReturn() {
  if (document.visibilityState === 'visible') checkIdle();
}

watch(() => accessStore.accessToken, (token, previous) => {
  if (!token) {
    clearTimer();
    try { sessionStorage.removeItem(activityStorageKey); } catch { /* Storage may be disabled. */ }
    return;
  }
  if (!previous) {
    lastActivity = readActivity();
    lastPersisted = lastActivity;
    checkIdle();
  }
}, { immediate: true });

onMounted(() => {
  for (const event of ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel']) {
    window.addEventListener(event, recordActivity, { passive: true });
  }
  window.addEventListener('focus', checkIdle);
  window.addEventListener('pageshow', checkIdle);
  document.addEventListener('visibilitychange', checkOnReturn);
});
onBeforeUnmount(() => {
  clearTimer();
  for (const event of ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel']) {
    window.removeEventListener(event, recordActivity);
  }
  window.removeEventListener('focus', checkIdle);
  window.removeEventListener('pageshow', checkIdle);
  document.removeEventListener('visibilitychange', checkOnReturn);
});
</script>

<template>
  <ElConfigProvider :locale="elementLocale">
    <RouterView />
    <div v-if="locking" class="fixed inset-0 z-[99999] flex items-center justify-center bg-white text-center text-base text-gray-700 dark:bg-gray-950 dark:text-gray-200">
      会话已锁定，正在返回登录页…
    </div>
  </ElConfigProvider>
</template>
