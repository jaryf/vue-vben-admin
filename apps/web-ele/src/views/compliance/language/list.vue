<script setup lang="ts">
import type { LanguageRow } from '#/api/languages';

import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';

import {
  ElAlert,
  ElButton,
  ElCard,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
} from 'element-plus';

import {
  createLanguage,
  listLanguages,
  updateLanguage,
  updateLanguageFallback,
} from '#/api/languages';
import AdminEnumTag from '#/components/admin-enum-tag.vue';
import AdminPage from '#/components/admin-page.vue';
import AdminTime from '#/components/admin-time.vue';
import { confirmDialog } from '#/utils/message-box';

const { hasAccessByCodes } = useAccess();
const canUpdate = computed(() => hasAccessByCodes(['language.update']));
const canCreate = computed(() => hasAccessByCodes(['language.create']));
const rows = ref<LanguageRow[]>([]);
const fallbackOptions = ref<LanguageRow[]>([]);
const loading = ref(false);
const saving = ref(false);
const editorOpen = ref(false);
const createOpen = ref(false);
const fallbackOpen = ref(false);
const fallbackEditing = ref<LanguageRow | null>(null);
const fallbackCode = ref('');
const createKey = ref('');
const editing = ref<LanguageRow | null>(null);
const filter = reactive({ code: '', enabled: '' });
const form = reactive({
  enabled: false,
  clientAvailable: false,
  contentAvailable: false,
  moderationAvailable: false,
  aiGenerationAvailable: false,
});
const createForm = reactive({
  code: '',
  nativeName: '',
  displayName: '',
  textDirection: 'ltr' as 'ltr' | 'rtl',
  fallbackLanguageCode: 'en',
  sort: 70,
});
async function load() {
  loading.value = true;
  try {
    rows.value = await listLanguages({
      code: filter.code.trim() || undefined,
      enabled: filter.enabled || undefined,
    });
  } finally {
    loading.value = false;
  }
}
function openEditor(row: LanguageRow) {
  editing.value = row;
  Object.assign(form, {
    enabled: row.enabled,
    clientAvailable: row.clientAvailable,
    contentAvailable: row.contentAvailable,
    moderationAvailable: row.moderationAvailable,
    aiGenerationAvailable: row.aiGenerationAvailable,
  });
  editorOpen.value = true;
}
async function save() {
  if (!editing.value) return;
  if (
    !(await confirmDialog(
      `确定更新 ${editing.value.displayName} 的能力开关吗？`,
      '确认语言配置',
      { type: 'warning' },
    ))
  )
    return;
  saving.value = true;
  try {
    await updateLanguage(editing.value.code, { ...form });
    editorOpen.value = false;
    ElMessage.success('语言能力已更新');
    await load();
  } finally {
    saving.value = false;
  }
}
async function openCreate() {
  Object.assign(createForm, {
    code: '',
    nativeName: '',
    displayName: '',
    textDirection: 'ltr',
    fallbackLanguageCode: 'en',
    sort: 70,
  });
  const languages = await listLanguages({});
  fallbackOptions.value = languages.filter((item) => item.enabled);
  createKey.value = crypto.randomUUID();
  createOpen.value = true;
}
async function saveCreate() {
  const code = createForm.code.trim();
  if (
    !/^[a-z]{2,3}(-[A-Z]{2})?$/.test(code) ||
    !createForm.nativeName.trim() ||
    !createForm.displayName.trim() ||
    !Number.isInteger(createForm.sort) ||
    createForm.sort < 1 ||
    createForm.sort > 1_000_000
  ) {
    ElMessage.error('请填写有效语言代码、名称和唯一排序值');
    return;
  }
  saving.value = true;
  try {
    await createLanguage(
      {
        code,
        nativeName: createForm.nativeName.trim(),
        displayName: createForm.displayName.trim(),
        textDirection: createForm.textDirection,
        fallbackLanguageCode: createForm.fallbackLanguageCode || null,
        sort: createForm.sort,
      },
      createKey.value,
    );
    createOpen.value = false;
    ElMessage.success('语言已登记，所有能力默认关闭');
    await load();
  } finally {
    saving.value = false;
  }
}
async function openFallback(row: LanguageRow) {
  const languages = await listLanguages({});
  fallbackOptions.value = languages.filter(
    (item) => item.enabled && item.code !== row.code,
  );
  fallbackEditing.value = row;
  fallbackCode.value = row.fallbackLanguageCode || '';
  fallbackOpen.value = true;
}
async function saveFallback() {
  if (!fallbackEditing.value) return;
  saving.value = true;
  try {
    await updateLanguageFallback(
      fallbackEditing.value.code,
      fallbackCode.value || null,
    );
    fallbackOpen.value = false;
    ElMessage.success('回退语言已更新');
    await load();
  } finally {
    saving.value = false;
  }
}
onMounted(() => {
  void load();
});
</script>

<template>
  <AdminPage
    title="语言与能力"
    description="管理各语言的客户端、内容、审核和 AI 能力。"
  >
    <template #actions>
      <ElButton v-if="canCreate" type="primary" @click="openCreate">
        登记语言
      </ElButton>
</template><ElCard shadow="never">
      <div class="admin-filter">
        <ElInput
          v-model="filter.code"
          placeholder="语言代码"
          clearable
          class="!w-36"
        /><ElSelect
          v-model="filter.enabled"
          clearable
          placeholder="全部启用状态"
          class="!w-40"
        >
          <ElOption label="启用" value="true" /><ElOption
            label="停用"
            value="false"
          />
</ElSelect><ElButton type="primary" @click="load">查询</ElButton>
      </div>
      <ElTable v-loading="loading" :data="rows" row-key="code">
        <ElTableColumn prop="code" label="代码" width="90" /><ElTableColumn
          prop="displayName"
          label="显示名称"
          min-width="130"
        /><ElTableColumn
          prop="nativeName"
          label="本地名称"
          min-width="130"
        /><!-- @vue-generic {LanguageRow} --><ElTableColumn
          label="启用"
          width="105"
        >
          <template #default="{ row }">
            <AdminEnumTag
              :value="row.enabled"
              :label="row.enabled ? '启用' : '停用'"
              :tone="row.enabled ? 'success' : 'info'"
            />
          </template>
</ElTableColumn><!-- @vue-generic {LanguageRow} --><ElTableColumn
          label="客户端"
          width="105"
        >
          <template #default="{ row }">
            <AdminEnumTag
              :value="row.clientAvailable"
              :label="row.clientAvailable ? '可用' : '不可用'"
              :tone="row.clientAvailable ? 'success' : 'info'"
            />
          </template>
</ElTableColumn><!-- @vue-generic {LanguageRow} --><ElTableColumn
          label="内容"
          width="105"
        >
          <template #default="{ row }">
            <AdminEnumTag
              :value="row.contentAvailable"
              :label="row.contentAvailable ? '可用' : '不可用'"
              :tone="row.contentAvailable ? 'success' : 'info'"
            />
          </template>
</ElTableColumn><!-- @vue-generic {LanguageRow} --><ElTableColumn
          label="审核"
          width="105"
        >
          <template #default="{ row }">
            <AdminEnumTag
              :value="row.moderationAvailable"
              :label="row.moderationAvailable ? '可用' : '不可用'"
              :tone="row.moderationAvailable ? 'success' : 'info'"
            />
          </template>
</ElTableColumn><!-- @vue-generic {LanguageRow} --><ElTableColumn
          label="AI 生成"
          width="105"
        >
          <template #default="{ row }">
            <AdminEnumTag
              :value="row.aiGenerationAvailable"
              :label="row.aiGenerationAvailable ? '可用' : '不可用'"
              :tone="row.aiGenerationAvailable ? 'success' : 'info'"
            />
          </template>
</ElTableColumn><ElTableColumn
          prop="fallbackLanguageCode"
          label="回退语言"
          width="105"
        /><!-- @vue-generic {LanguageRow} --><ElTableColumn
          prop="updatedAt"
          label="更新时间"
          min-width="170"
        >
          <template #default="{ row }">
            <AdminTime :value="row.updatedAt" />
          </template>
</ElTableColumn><!-- @vue-generic {LanguageRow} --><ElTableColumn
          v-if="canUpdate"
          label="操作"
          width="150"
        >
          <template #default="{ row }">
            <ElButton link type="primary" @click="openEditor(row)">
              能力
</ElButton><ElButton link type="primary" @click="openFallback(row)">
              回退
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
</ElCard><ElDialog
      v-model="editorOpen"
      :title="`配置语言 ${editing?.displayName || ''}`"
      width="520px"
    >
      <ElForm label-width="125px">
        <ElFormItem label="启用语言">
          <ElSwitch v-model="form.enabled" />
</ElFormItem><ElFormItem label="客户端可用">
          <ElSwitch v-model="form.clientAvailable" />
</ElFormItem><ElFormItem label="内容可用">
          <ElSwitch v-model="form.contentAvailable" />
</ElFormItem><ElFormItem label="审核可用">
          <ElSwitch v-model="form.moderationAvailable" />
</ElFormItem><ElFormItem label="AI 生成可用">
          <ElSwitch v-model="form.aiGenerationAvailable" />
        </ElFormItem>
</ElForm><template #footer>
        <ElButton @click="editorOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="save">
          保存
        </ElButton>
      </template>
    </ElDialog>
    <ElDialog v-model="createOpen" title="登记新语言" width="540px">
      <ElAlert
        class="mb-4"
        title="新语言默认停用，客户端、内容、审核和 AI 能力均关闭；请在外部服务准备好后再逐项启用。"
        type="info"
        show-icon
        :closable="false"
      /><ElForm label-width="125px">
        <ElFormItem label="语言代码">
          <ElInput
            v-model="createForm.code"
            placeholder="如 gu 或 en-US"
          />
</ElFormItem><ElFormItem label="本地名称">
          <ElInput
            v-model="createForm.nativeName"
            maxlength="80"
          />
</ElFormItem><ElFormItem label="管理名称">
          <ElInput
            v-model="createForm.displayName"
            maxlength="80"
          />
</ElFormItem><ElFormItem label="文字方向">
          <ElSelect v-model="createForm.textDirection">
            <ElOption label="从左到右" value="ltr" /><ElOption
              label="从右到左"
              value="rtl"
            />
          </ElSelect>
</ElFormItem><ElFormItem label="回退语言">
          <ElSelect v-model="createForm.fallbackLanguageCode" clearable>
            <ElOption
              v-for="row in fallbackOptions"
              :key="row.code"
              :label="`${row.displayName} (${row.code})`"
              :value="row.code"
            />
          </ElSelect>
</ElFormItem><ElFormItem label="唯一排序值">
          <ElInputNumber v-model="createForm.sort" :min="1" :max="1000000" />
        </ElFormItem>
</ElForm><template #footer>
        <ElButton @click="createOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="saveCreate">
          登记
        </ElButton>
      </template>
    </ElDialog>
    <ElDialog
      v-model="fallbackOpen"
      :title="`配置 ${fallbackEditing?.code || ''} 回退语言`"
      width="460px"
    >
      <ElAlert
        v-if="fallbackEditing?.code === 'en'"
        class="mb-4"
        type="info"
        title="英语为默认兜底语言，不设置回退。"
        show-icon
        :closable="false"
      /><ElForm label-width="100px">
        <ElFormItem label="回退语言">
          <ElSelect
            v-model="fallbackCode"
            :disabled="fallbackEditing?.code === 'en'"
            clearable
            class="w-full"
            placeholder="默认回退英语"
          >
            <ElOption
              v-for="row in fallbackOptions"
              :key="row.code"
              :label="`${row.displayName} (${row.code})`"
              :value="row.code"
            />
          </ElSelect>
        </ElFormItem>
</ElForm><template #footer>
        <ElButton @click="fallbackOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="saveFallback">
          保存回退
        </ElButton>
      </template>
    </ElDialog>
  </AdminPage>
</template>
