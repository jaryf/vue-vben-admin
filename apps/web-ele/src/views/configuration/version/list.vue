<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useUserStore } from '@vben/stores';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  approveConfigVersion, createConfigVersion, editConfigVersion, getConfigVersion,
  listConfigVersions, publishConfigVersion, rejectConfigVersion,
  rollbackConfigVersion, submitConfigVersion,
} from '#/api/config-versions';
import type { ConfigVersion } from '#/api/config-versions';

const { hasAccessByCodes } = useAccess();
const userStore = useUserStore();
const canWrite = computed(() => hasAccessByCodes(['config_version.write']));
const canApprove = computed(() => hasAccessByCodes(['config_version.approve']));
const canPublish = computed(() => hasAccessByCodes(['config_version.publish']));
const flags = [
  ['emailPasswordLogin', '邮箱密码登录'], ['googleLogin', 'Google 登录'], ['appleLogin', 'Apple 登录'],
  ['textBottle', '文字漂流瓶'], ['voiceBottle', '语音漂流瓶'], ['report', '举报'],
  ['block', '拉黑'], ['inAppNotification', '站内通知'], ['adultContent', '成人内容'],
  ['chatVideo', '视频聊天'], ['aiContentDistribution', 'AI 内容投放'], ['aiReply', 'AI 回复'],
  ['vipPurchasePayment', 'VIP 购买支付'],
] as const;
type FlagName = typeof flags[number][0];
const rows = ref<ConfigVersion[]>([]);
const nextCursor = ref<null | string>(null);
const cursorStack = ref<string[]>([]);
const loading = ref(false);
const saving = ref(false);
const editorOpen = ref(false);
const detailOpen = ref(false);
const detail = ref<ConfigVersion | null>(null);
const editingId = ref<null | number>(null);
const createKey = ref('');
const status = ref('');
const scope = ref('');
const form = reactive({ scope: 'feature_flags' as ConfigVersion['scope'], version: '', blockedTerms: '', maxPercent: 0, rolloutPercent: 0, languageOverrides: '', states: {} as Record<FlagName, 'false' | 'inherit' | 'true'> });
const statusText = (value: string) => ({ draft: '草稿', reviewing: '待审批', approved: '已批准', published: '已发布', retired: '已退役' })[value as ConfigVersion['status']] || value;
const scopeText = (value: string) => ({ feature_flags: '功能开关', moderation_rules: '附加审核规则', ai_distribution: 'AI 投放比例' })[value as ConfigVersion['scope']] || value;
const configuredFlags = (row: ConfigVersion) => 'flags' in row.payload ? row.payload.flags : {};
const configuredTerms = (row: ConfigVersion) => 'blockedTerms' in row.payload ? row.payload.blockedTerms : [];
const configuredAI = (row: ConfigVersion) => 'maxPercent' in row.payload ? row.payload : null;
const currentUserId = computed(() => userStore.userInfo?.userId);

async function load(cursor = '') {
  loading.value = true;
  try {
    const result = await listConfigVersions({ scope: scope.value || undefined, status: status.value || undefined, cursor: cursor || undefined, limit: 20 });
    rows.value = result.items || [];
    nextCursor.value = result.nextCursor;
  } finally { loading.value = false; }
}
function search() { cursorStack.value = []; void load(); }
function next() { if (!nextCursor.value) return; cursorStack.value.push(nextCursor.value); void load(nextCursor.value); }
function previous() { cursorStack.value.pop(); void load(cursorStack.value.at(-1) || ''); }
async function openDetail(row: ConfigVersion) { detail.value = await getConfigVersion(row.versionId); detailOpen.value = true; }
async function openEditor(row?: ConfigVersion) {
  const current = row ? await getConfigVersion(row.versionId) : null;
  editingId.value = current?.versionId ?? null;
  createKey.value = crypto.randomUUID();
  form.scope = current?.scope ?? 'feature_flags';
  form.version = current?.version ?? '';
  form.blockedTerms = current ? configuredTerms(current).join('\n') : '';
  const ai = current ? configuredAI(current) : null;
  form.maxPercent = ai?.maxPercent ?? 0;
  form.rolloutPercent = ai?.rolloutPercent ?? 0;
  form.languageOverrides = ai?.languageOverrides ? Object.entries(ai.languageOverrides).map(([code, percent]) => `${code}=${percent}`).join('\n') : '';
  for (const [name] of flags) {
    const value = current ? configuredFlags(current)[name] : undefined;
    form.states[name] = value === undefined ? 'inherit' : String(value) as 'false' | 'true';
  }
  editorOpen.value = true;
}
async function save() {
  const version = form.version.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(version)) { ElMessage.error('请填写有效版本号'); return; }
  let payload: ConfigVersion['payload'];
  if (form.scope === 'feature_flags') {
    const selected: Record<string, boolean> = {};
    for (const [name] of flags) if (form.states[name] !== 'inherit') selected[name] = form.states[name] === 'true';
    if (Object.keys(selected).length === 0) { ElMessage.error('至少配置一项能力'); return; }
    payload = { flags: selected };
  } else if (form.scope === 'moderation_rules') {
    const terms = form.blockedTerms.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (terms.length < 1 || terms.length > 100 || terms.some((value) => [...value].length < 2 || [...value].length > 64 || /[\x00-\x1F]/.test(value)) || new Set(terms.map((value) => value.toLocaleLowerCase())).size !== terms.length) { ElMessage.error('请填写 1 至 100 条不重复的拦截词，每条 2 至 64 字'); return; }
    payload = { blockedTerms: terms };
  } else {
    if (!Number.isInteger(form.maxPercent) || form.maxPercent < 0 || form.maxPercent > 20 || !Number.isInteger(form.rolloutPercent) || form.rolloutPercent < 0 || form.rolloutPercent > 100) { ElMessage.error('AI 上限必须为 0～20%，灰度比例必须为 0～100%'); return; }
    const languageOverrides: Record<string, number> = {};
    for (const line of form.languageOverrides.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)) {
      const parts = line.split('=');
      const code = parts[0]?.trim();
      const percent = Number(parts[1]);
      if (parts.length !== 2 || !code || !/^[a-z][a-z0-9-]{1,15}$/.test(code) || !Number.isInteger(percent) || percent < 0 || percent > 20 || code in languageOverrides) { ElMessage.error('语言覆盖请每行填写「语言代码=0～20」且不要重复'); return; }
      languageOverrides[code] = percent;
    }
    payload = { maxPercent: form.maxPercent, rolloutPercent: form.rolloutPercent, languageOverrides };
  }
  saving.value = true;
  try {
    const data = { scope: form.scope, version, payload };
    if (editingId.value === null) await createConfigVersion(data, createKey.value);
    else await editConfigVersion(editingId.value, data);
    editorOpen.value = false; ElMessage.success('草稿已保存'); await load(cursorStack.value.at(-1) || '');
  } finally { saving.value = false; }
}
async function action(row: ConfigVersion, kind: 'approve' | 'publish' | 'reject' | 'rollback' | 'submit') {
  if (kind === 'rollback') {
    const result = await ElMessageBox.prompt('输入新的回滚版本号。创建后仍需由其他管理员审批并发布。', `回滚 ${row.version}`, { inputPattern: /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/, inputErrorMessage: '版本号格式无效' });
    await rollbackConfigVersion(row.versionId, result.value, crypto.randomUUID());
  } else if (kind === 'approve' || kind === 'reject') {
    const result = await ElMessageBox.prompt(kind === 'reject' ? '请输入驳回原因' : '可填写审批说明', kind === 'reject' ? '驳回配置' : '批准配置', { inputValidator: (value) => value.length > 500 ? '说明最多 500 字' : kind === 'reject' && !value.trim() ? '请填写驳回原因' : true });
    if (kind === 'approve') await approveConfigVersion(row.versionId, result.value);
    else await rejectConfigVersion(row.versionId, result.value);
  } else {
    await ElMessageBox.confirm(`确定${kind === 'submit' ? '提交审批' : '发布'}版本 ${row.version} 吗？`, '确认配置操作', { type: 'warning' });
    if (kind === 'submit') await submitConfigVersion(row.versionId);
    else await publishConfigVersion(row.versionId);
  }
  ElMessage.success('配置状态已更新'); await load(cursorStack.value.at(-1) || '');
}
onMounted(() => { void load(); });
</script>

<template>
  <div class="p-5"><ElCard shadow="never"><template #header><div class="flex items-center justify-between"><span>版本化配置与审核规则</span><ElButton v-if="canWrite" type="primary" @click="openEditor()">创建草稿</ElButton></div></template>
    <ElAlert class="mb-4" title="功能开关只覆盖 App 启动接口且不能开启服务端基础配置禁用的能力。附加审核词在同步消息和异步漂流瓶审核中生效。AI 投放默认 0%，按近 24 小时每种语言的实际拾取量限制且单语种最高 20%；发布与回滚均需异人审批。" type="info" show-icon :closable="false" />
    <div class="mb-4 flex gap-3"><ElSelect v-model="scope" clearable placeholder="全部类型" class="!w-40"><ElOption label="功能开关" value="feature_flags" /><ElOption label="附加审核规则" value="moderation_rules" /><ElOption label="AI 投放比例" value="ai_distribution" /></ElSelect><ElSelect v-model="status" clearable placeholder="全部状态" class="!w-36"><ElOption label="草稿" value="draft" /><ElOption label="待审批" value="reviewing" /><ElOption label="已批准" value="approved" /><ElOption label="已发布" value="published" /><ElOption label="已退役" value="retired" /></ElSelect><ElButton @click="search">查询</ElButton></div>
    <ElTable v-loading="loading" :data="rows" row-key="versionId"><ElTableColumn prop="versionId" label="ID" width="85" /><ElTableColumn label="类型" width="120"><template #default="{ row }">{{ scopeText(row.scope) }}</template></ElTableColumn><ElTableColumn prop="version" label="版本" min-width="125" /><ElTableColumn label="状态" width="100"><template #default="{ row }">{{ statusText(row.status) }}</template></ElTableColumn><ElTableColumn prop="requestedBy" label="申请人" width="95" /><ElTableColumn prop="reviewedBy" label="审批人" width="95" /><ElTableColumn prop="rollbackOf" label="回滚来源" width="100" /><ElTableColumn prop="updatedAt" label="更新时间" min-width="185" /><ElTableColumn label="操作" min-width="310" fixed="right"><template #default="{ row }"><ElButton link type="primary" @click="openDetail(row)">详情</ElButton><ElButton v-if="canWrite && row.status === 'draft' && row.requestedBy === currentUserId" link type="primary" @click="openEditor(row)">编辑</ElButton><ElButton v-if="canWrite && row.status === 'draft' && row.requestedBy === currentUserId" link type="success" @click="action(row, 'submit')">提交</ElButton><ElButton v-if="canApprove && row.status === 'reviewing' && row.requestedBy !== currentUserId" link type="success" @click="action(row, 'approve')">批准</ElButton><ElButton v-if="canApprove && row.status === 'reviewing' && row.requestedBy !== currentUserId" link type="warning" @click="action(row, 'reject')">驳回</ElButton><ElButton v-if="canPublish && row.status === 'approved'" link type="success" @click="action(row, 'publish')">发布</ElButton><ElButton v-if="canWrite && ['published', 'retired'].includes(row.status)" link type="warning" @click="action(row, 'rollback')">回滚草稿</ElButton></template></ElTableColumn></ElTable><div class="mt-4 flex justify-end gap-2"><ElButton :disabled="cursorStack.length === 0" @click="previous">上一页</ElButton><ElButton :disabled="!nextCursor" @click="next">下一页</ElButton></div>
  </ElCard><ElDrawer v-model="detailOpen" title="配置版本详情" size="55%" @closed="detail = null"><ElDescriptions v-if="detail" :column="2" border><ElDescriptionsItem label="类型">{{ scopeText(detail.scope) }}</ElDescriptionsItem><ElDescriptionsItem label="版本">{{ detail.version }}</ElDescriptionsItem><ElDescriptionsItem label="状态">{{ statusText(detail.status) }}</ElDescriptionsItem><ElDescriptionsItem label="申请人">{{ detail.requestedBy }}</ElDescriptionsItem><ElDescriptionsItem label="审批人">{{ detail.reviewedBy ?? '—' }}</ElDescriptionsItem><ElDescriptionsItem label="审批说明">{{ detail.reviewNote || '—' }}</ElDescriptionsItem><ElDescriptionsItem label="回滚来源">{{ detail.rollbackOf ?? '—' }}</ElDescriptionsItem></ElDescriptions><ElDivider>{{ detail?.scope === 'feature_flags' ? '能力配置' : detail?.scope === 'moderation_rules' ? '附加拦截词' : 'AI 投放规则' }}</ElDivider><ElDescriptions v-if="detail?.scope === 'feature_flags'" :column="1" border><ElDescriptionsItem v-for="[name, label] in flags" :key="name" :label="label">{{ configuredFlags(detail)[name] === undefined ? '继承基础配置' : configuredFlags(detail)[name] ? '开启' : '关闭' }}</ElDescriptionsItem></ElDescriptions><div v-else-if="detail?.scope === 'moderation_rules'" class="flex flex-wrap gap-2"><ElTag v-for="term in configuredTerms(detail)" :key="term">{{ term }}</ElTag></div><ElDescriptions v-else-if="detail && configuredAI(detail)" :column="1" border><ElDescriptionsItem label="全局最高比例">{{ configuredAI(detail)?.maxPercent }}%</ElDescriptionsItem><ElDescriptionsItem label="用户灰度比例">{{ configuredAI(detail)?.rolloutPercent }}%</ElDescriptionsItem><ElDescriptionsItem label="语言覆盖">{{ JSON.stringify(configuredAI(detail)?.languageOverrides || {}) }}</ElDescriptionsItem></ElDescriptions></ElDrawer>
  <ElDrawer v-model="editorOpen" :title="editingId === null ? '创建配置草稿' : `编辑草稿 #${editingId}`" size="55%"><ElForm label-width="150px"><ElFormItem label="配置类型"><ElSelect v-model="form.scope" :disabled="editingId !== null"><ElOption label="功能开关" value="feature_flags" /><ElOption label="附加审核规则" value="moderation_rules" /><ElOption label="AI 投放比例" value="ai_distribution" /></ElSelect></ElFormItem><ElFormItem label="版本号"><ElInput v-model="form.version" placeholder="例如 2026.09.24-1" /></ElFormItem><template v-if="form.scope === 'feature_flags'"><ElDivider>能力覆盖</ElDivider><ElFormItem v-for="[name, label] in flags" :key="name" :label="label"><ElSelect v-model="form.states[name]"><ElOption label="继承基础配置" value="inherit" /><ElOption label="开启（需基础配置支持）" value="true" /><ElOption label="关闭" value="false" /></ElSelect></ElFormItem></template><ElFormItem v-else-if="form.scope === 'moderation_rules'" label="拦截词"><ElInput v-model="form.blockedTerms" type="textarea" :rows="14" placeholder="每行一个拦截词；不会替换固定安全规则" /></ElFormItem><template v-else><ElFormItem label="最高 AI 比例"><ElInputNumber v-model="form.maxPercent" :min="0" :max="20" /> %</ElFormItem><ElFormItem label="用户灰度比例"><ElInputNumber v-model="form.rolloutPercent" :min="0" :max="100" /> %</ElFormItem><ElFormItem label="语言覆盖"><ElInput v-model="form.languageOverrides" type="textarea" :rows="8" placeholder="每行如 hi=5；未列语言使用全局比例" /></ElFormItem></template></ElForm><template #footer><ElButton @click="editorOpen = false">取消</ElButton><ElButton type="primary" :loading="saving" @click="save">保存草稿</ElButton></template></ElDrawer></div>
</template>
