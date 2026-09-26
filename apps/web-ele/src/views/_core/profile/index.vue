<script setup lang="ts">
import { ref } from 'vue';

import { useUserStore } from '@vben/stores';

import AdminPage from '#/components/admin-page.vue';

import ProfileBase from './base-setting.vue';
import ProfilePasswordSetting from './password-setting.vue';
import ProfileSecuritySetting from './security-setting.vue';
import ProfileSessionSetting from './session-setting.vue';

const userStore = useUserStore();

const tabsValue = ref<string>('basic');

const tabs = ref([
  {
    label: '基本设置',
    value: 'basic',
  },
  {
    label: '安全设置',
    value: 'security',
  },
  {
    label: '登录会话',
    value: 'session',
  },
  {
    label: '修改密码',
    value: 'password',
  },
]);
</script>
<template>
  <AdminPage
    title="个人中心"
    description="管理个人资料、账号安全与当前登录会话。"
  >
    <div class="profile-layout">
      <aside class="admin-panel profile-sidebar">
        <div class="profile-identity">
          <div class="profile-avatar" aria-hidden="true">
            {{
              (
                userStore.userInfo?.realName ||
                userStore.userInfo?.username ||
                'A'
              )
                .slice(0, 1)
                .toUpperCase()
            }}
          </div>
          <strong>{{
            userStore.userInfo?.realName || userStore.userInfo?.username
          }}</strong>
          <span>{{ userStore.userInfo?.username }}</span>
        </div>
        <nav aria-label="个人设置" class="profile-navigation">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            :aria-pressed="tabsValue === tab.value"
            :class="{ active: tabsValue === tab.value }"
            @click="tabsValue = tab.value"
          >
            {{ tab.label }}<span aria-hidden="true">›</span>
          </button>
        </nav>
      </aside>
      <section
        class="admin-panel profile-content"
        :aria-label="tabs.find((tab) => tab.value === tabsValue)?.label"
      >
        <h2>{{ tabs.find((tab) => tab.value === tabsValue)?.label }}</h2>
        <ProfileBase v-if="tabsValue === 'basic'" />
        <ProfileSecuritySetting v-if="tabsValue === 'security'" />
        <ProfileSessionSetting v-if="tabsValue === 'session'" />
        <ProfilePasswordSetting v-if="tabsValue === 'password'" />
      </section>
    </div>
  </AdminPage>
</template>

<style scoped>
.profile-layout {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  gap: 22px;
  align-items: start;
}

.profile-sidebar {
  padding: 22px 14px;
}

.profile-identity {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  padding: 8px 0 24px;
}

.profile-avatar {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  margin-bottom: 4px;
  font-size: 26px;
  font-weight: 600;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-8);
  border-radius: 20px;
}

.profile-identity strong {
  font-size: 16px;
}

.profile-identity > span {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.profile-navigation {
  display: grid;
  gap: 6px;
}

.profile-navigation button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  color: var(--el-text-color-regular);
  text-align: left;
  cursor: pointer;
  border-radius: 8px;
}

.profile-navigation button:hover {
  background: var(--el-fill-color-light);
}

.profile-navigation button.active {
  font-weight: 600;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.profile-navigation button:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.profile-content {
  min-width: 0;
  min-height: 520px;
}

.profile-content h2 {
  padding-bottom: 18px;
  margin-bottom: 24px;
  font-size: 17px;
  font-weight: 600;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

@media (max-width: 900px) {
  .profile-layout {
    grid-template-columns: 1fr;
  }

  .profile-identity {
    flex-direction: row;
    padding: 0 6px 18px;
  }

  .profile-avatar {
    width: 42px;
    height: 42px;
    margin: 0 6px 0 0;
    font-size: 20px;
    border-radius: 13px;
  }

  .profile-navigation {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 3px;
  }

  .profile-navigation button {
    justify-content: center;
    padding: 10px 4px;
    font-size: 12px;
  }

  .profile-navigation button span {
    display: none;
  }
}
</style>
