<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';

import { ElMessage, ElMessageBox } from 'element-plus';

import {
  getOrder, listCoinLedger, listEntitlementLedger, listOrders, listPayments, listProducts, listSubscriptions,
  updateProductStatus,
} from '#/api/commerce';
import type { OrderDetail, ProductRow } from '#/api/commerce';

const { hasAccessByCodes } = useAccess();
const canManageProducts = computed(() => hasAccessByCodes(['product.manage']));
const active = ref<'coins' | 'entitlements' | 'orders' | 'payments' | 'products' | 'subscriptions'>('orders');
const emptyFilter = () => ({
  id: '', userId: '', status: '', orderNo: '', productType: '', internalCode: '',
  currency: '', paymentChannel: '', region: '', orderId: '', productId: '',
  channelTransactionId: '', originalTransactionId: '', transactionType: '',
  createdRange: [] as Date[], periodEndsRange: [] as Date[],
});
const filter = reactive(emptyFilter());
const rows = ref<Record<string, any>[]>([]);
const nextCursor = ref<string | null>(null);
const cursorStack = ref<string[]>([]);
const loading = ref(false);
const detail = ref<OrderDetail | null>(null);
const detailOpen = ref(false);
const product = ref<ProductRow | null>(null);
const productOpen = ref(false);

const statusLabels: Record<string, string> = {
  created: '已创建', pending_payment: '待支付', paid: '已支付', fulfilled: '已履约',
  closed: '已关闭', cancelled: '已取消', refunding: '退款处理中', refunded: '已退款',
  revoked: '已撤销', chargeback: '拒付', payment_failed: '支付失败',
  fulfillment_failed: '履约失败', draft: '草稿', published: '已发布', retired: '已退役',
  verified: '已验证', rejected: '已拒绝', active: '生效中', grace_period: '宽限期',
  paused: '暂停', expired: '已过期',
};
const statusText = (status: string) => statusLabels[status] || status;
const statusOptions = computed(() => {
  const choices: Record<string, string[]> = {
    orders: ['created', 'pending_payment', 'paid', 'fulfilled', 'closed', 'cancelled', 'refunding', 'refunded', 'revoked', 'chargeback', 'payment_failed', 'fulfillment_failed'],
    products: ['draft', 'published', 'retired'],
    payments: ['verified', 'rejected', 'refunded', 'revoked'],
    subscriptions: ['active', 'grace_period', 'paused', 'expired', 'revoked'],
  };
  return choices[active.value] || [];
});
const productTypes = [['subscription', '订阅'], ['feature_unlock', '永久权益'], ['coin_pack', '金币包']];
const channels = [['google_play', 'Google Play'], ['app_store', 'App Store']];
const internalCodes = ['subscription_weekly', 'subscription_monthly', 'subscription_yearly', 'lifetime_access', 'coins_1000', 'coins_5000', 'coins_100000'];
const transactionTypes = [['purchase', '购买'], ['renewal', '续订'], ['refund', '退款'], ['revocation', '撤销'], ['chargeback', '拒付'], ['restore', '恢复']];
const columns = computed(() => ({
  orders: [
    ['orderId', '订单 ID', 100], ['orderNo', '订单号', 190], ['userId', '用户 ID', 100],
    ['internalCode', '商品', 155], ['paymentChannel', '支付渠道', 130],
    ['status', '状态', 120], ['createdAt', '创建时间', 175],
  ],
  products: [
    ['productId', '商品 ID', 100], ['internalCode', '内部编码', 175],
    ['productType', '商品类型', 135], ['status', '状态', 110],
    ['currency', '币种', 90], ['billingPeriod', '周期', 95],
  ],
  payments: [
    ['transactionId', '交易 ID', 105], ['orderId', '订单 ID', 100],
    ['paymentChannel', '渠道', 120], ['transactionType', '类型', 110],
    ['status', '状态', 110], ['verifiedAt', '验证时间', 175],
  ],
  subscriptions: [
    ['subscriptionId', '订阅 ID', 105], ['userId', '用户 ID', 100],
    ['internalCode', '商品', 160], ['paymentChannel', '渠道', 120],
    ['status', '状态', 110], ['currentPeriodEndsAt', '当前周期到期', 175],
  ],
  entitlements: [
    ['ledgerId', '流水 ID', 105], ['userId', '用户 ID', 105],
    ['entitlementType', '权益类型', 145], ['operation', '操作', 110],
    ['changeAmount', '变动', 90], ['balanceAfter', '变动后余额', 120],
    ['sourceType', '来源类型', 120], ['sourceId', '来源 ID', 145],
    ['effectiveAt', '生效时间', 175], ['expiresAt', '到期时间', 175],
    ['createdAt', '记录时间', 175],
  ],
  coins: [
    ['ledgerId', '流水 ID', 105], ['userId', '用户 ID', 105],
    ['operation', '操作', 115], ['amount', '变动', 90],
    ['balanceAfter', '变动后余额', 120], ['sourceType', '来源类型', 125],
    ['sourceId', '来源 ID', 155], ['orderId', '订单 ID', 110],
    ['createdAt', '记录时间', 175],
  ],
})[active.value]);

async function load(cursor = '') {
  loading.value = true;
  try {
    if ((active.value === 'entitlements' || active.value === 'coins') && !/^[1-9]\d*$/.test(filter.userId.trim())) {
      rows.value = [];
      nextCursor.value = null;
      return;
    }
    const params: Record<string, unknown> = { limit: 20, cursor: cursor || undefined };
    if (active.value !== 'entitlements' && active.value !== 'coins') {
      Object.assign(params, {
        createdFrom: filter.createdRange?.[0]?.toISOString(),
        createdUntil: filter.createdRange?.[1]?.toISOString(),
      });
    }
    if (active.value === 'orders') {
      Object.assign(params, { orderId: filter.id.trim() || undefined, userId: filter.userId.trim() || undefined, orderNo: filter.orderNo.trim() || undefined, status: filter.status || undefined, productType: filter.productType || undefined, paymentChannel: filter.paymentChannel || undefined });
    } else if (active.value === 'products') {
      Object.assign(params, { productId: filter.id.trim() || undefined, productType: filter.productType || undefined, internalCode: filter.internalCode || undefined, status: filter.status || undefined, currency: filter.currency.trim().toUpperCase() || undefined, paymentChannel: filter.paymentChannel || undefined, region: filter.region.trim().toUpperCase() || undefined });
    } else if (active.value === 'payments') {
      Object.assign(params, { transactionId: filter.id.trim() || undefined, orderId: filter.orderId.trim() || undefined, userId: filter.userId.trim() || undefined, paymentChannel: filter.paymentChannel || undefined, channelTransactionId: filter.channelTransactionId.trim() || undefined, originalTransactionId: filter.originalTransactionId.trim() || undefined, transactionType: filter.transactionType || undefined, status: filter.status || undefined });
    } else if (active.value === 'subscriptions') {
      Object.assign(params, { subscriptionId: filter.id.trim() || undefined, userId: filter.userId.trim() || undefined, productId: filter.productId.trim() || undefined, paymentChannel: filter.paymentChannel || undefined, originalTransactionId: filter.originalTransactionId.trim() || undefined, status: filter.status || undefined, periodEndsFrom: filter.periodEndsRange?.[0]?.toISOString(), periodEndsUntil: filter.periodEndsRange?.[1]?.toISOString() });
    } else {
      Object.assign(params, { userId: filter.userId.trim() });
    }
    const result = active.value === 'orders' ? await listOrders(params)
      : active.value === 'products' ? await listProducts(params)
      : active.value === 'payments' ? await listPayments(params)
      : active.value === 'subscriptions' ? await listSubscriptions(params)
      : active.value === 'entitlements' ? await listEntitlementLedger(params)
      : await listCoinLedger(params);
    rows.value = result.items || [];
    nextCursor.value = result.nextCursor;
  } finally { loading.value = false; }
}

function search() {
  if ((active.value === 'entitlements' || active.value === 'coins') && !/^[1-9]\d*$/.test(filter.userId.trim())) {
    ElMessage.warning('请输入有效的 App 用户 ID 后查询账本');
    return;
  }
  const ids = [filter.id, filter.userId, filter.orderId, filter.productId].filter(Boolean);
  if (ids.some((value) => !/^[1-9]\d*$/.test(value.trim()))) { ElMessage.warning('ID 必须为正整数'); return; }
  if ((filter.createdRange?.length === 2 && filter.createdRange[0]!.getTime() >= filter.createdRange[1]!.getTime()) || (filter.periodEndsRange?.length === 2 && filter.periodEndsRange[0]!.getTime() >= filter.periodEndsRange[1]!.getTime())) { ElMessage.warning('结束时间必须晚于开始时间'); return; }
  cursorStack.value = []; void load();
}
function switchTab() {
  Object.assign(filter, emptyFilter());
  cursorStack.value = [];
  void load();
}
function next() { if (!nextCursor.value) return; cursorStack.value.push(nextCursor.value); void load(nextCursor.value); }
function previous() { cursorStack.value.pop(); void load(cursorStack.value.at(-1) || ''); }

async function openRow(row: Record<string, any>) {
  if (active.value === 'orders') {
    detail.value = await getOrder(row.orderId);
    detailOpen.value = true;
  } else if (active.value === 'products') {
    product.value = row as ProductRow;
    productOpen.value = true;
  }
}

async function changeProductStatus(status: string) {
  if (!product.value || product.value.productType === 'coin_pack') return;
  await ElMessageBox.confirm(`确定将商品状态设置为「${statusText(status)}」吗？`, '修改商品状态', { type: 'warning' });
  product.value = await updateProductStatus(product.value.productId, status);
  ElMessage.success('商品状态已更新');
  await load(cursorStack.value.at(-1) || '');
}

onMounted(() => { void load(); });
</script>

<template>
  <div class="p-5">
    <ElCard shadow="never">
      <template #header>商品与交易</template>
      <ElAlert title="商品售价以 Google Play 或 App Store 当前商店数据为准；金币包购买和消费入口暂未开放，后台不提供主动退款。" type="info" show-icon :closable="false" class="mb-4" />
      <ElTabs v-model="active" @tab-change="switchTab"><ElTabPane label="订单" name="orders" /><ElTabPane label="商品" name="products" /><ElTabPane label="支付交易" name="payments" /><ElTabPane label="订阅" name="subscriptions" /><ElTabPane label="权益账本" name="entitlements" /><ElTabPane label="金币账本" name="coins" /></ElTabs>
      <ElAlert v-if="active === 'entitlements' || active === 'coins'" title="请输入 App 用户 ID 查看完整账本；此处仅供核对，不提供直接修改流水。" type="info" show-icon :closable="false" class="mb-4" />
      <div class="mb-4 flex flex-wrap gap-3">
        <ElInput v-if="active !== 'entitlements' && active !== 'coins'" v-model="filter.id" :placeholder="active === 'orders' ? '订单 ID' : active === 'products' ? '商品 ID' : active === 'payments' ? '交易 ID' : '订阅 ID'" clearable class="!w-36" />
        <ElInput v-if="active !== 'products'" v-model="filter.userId" placeholder="用户 ID" clearable class="!w-36" />
        <ElInput v-if="active === 'orders'" v-model="filter.orderNo" placeholder="订单号" clearable class="!w-48" />
        <ElInput v-if="active === 'payments'" v-model="filter.orderId" placeholder="关联订单 ID" clearable class="!w-40" />
        <ElInput v-if="active === 'subscriptions'" v-model="filter.productId" placeholder="商品 ID" clearable class="!w-36" />
        <ElSelect v-if="active === 'orders' || active === 'products'" v-model="filter.productType" clearable placeholder="商品类型" class="!w-36"><ElOption v-for="[value, label] in productTypes" :key="value" :value="value" :label="label" /></ElSelect>
        <ElSelect v-if="active === 'products'" v-model="filter.internalCode" clearable filterable placeholder="内部编码" class="!w-52"><ElOption v-for="code in internalCodes" :key="code" :value="code" :label="code" /></ElSelect>
        <ElInput v-if="active === 'products'" v-model="filter.currency" placeholder="币种，如 INR" maxlength="3" clearable class="!w-36" />
        <ElInput v-if="active === 'products'" v-model="filter.region" placeholder="地区代码，如 IN" maxlength="16" clearable class="!w-44" />
        <ElSelect v-if="active !== 'entitlements' && active !== 'coins'" v-model="filter.paymentChannel" clearable placeholder="支付渠道" class="!w-40"><ElOption v-for="[value, label] in channels" :key="value" :value="value" :label="label" /></ElSelect>
        <ElInput v-if="active === 'payments'" v-model="filter.channelTransactionId" placeholder="渠道交易号" clearable class="!w-48" />
        <ElInput v-if="active === 'payments' || active === 'subscriptions'" v-model="filter.originalTransactionId" placeholder="原始交易号" clearable class="!w-48" />
        <ElSelect v-if="active === 'payments'" v-model="filter.transactionType" clearable placeholder="交易类型" class="!w-36"><ElOption v-for="[value, label] in transactionTypes" :key="value" :value="value" :label="label" /></ElSelect>
        <ElSelect v-if="statusOptions.length" v-model="filter.status" clearable placeholder="状态" class="!w-40"><ElOption v-for="value in statusOptions" :key="value" :value="value" :label="statusText(value)" /></ElSelect>
        <ElDatePicker v-if="active !== 'entitlements' && active !== 'coins'" v-model="filter.createdRange" type="datetimerange" range-separator="至" start-placeholder="创建开始" end-placeholder="创建结束" class="!w-[390px]" />
        <ElDatePicker v-if="active === 'subscriptions'" v-model="filter.periodEndsRange" type="datetimerange" range-separator="至" start-placeholder="周期到期开始" end-placeholder="周期到期结束" class="!w-[390px]" />
        <ElButton @click="search">查询</ElButton>
      </div>
      <ElTable v-loading="loading" :data="rows">
        <ElTableColumn v-for="column in columns" :key="column[0]" :prop="String(column[0])" :label="String(column[1])" :min-width="Number(column[2])">
          <template #default="{ row }">{{ column[0] === 'status' ? statusText(row.status) : row[String(column[0])] ?? '—' }}</template>
        </ElTableColumn>
        <ElTableColumn v-if="active === 'orders' || active === 'products'" label="操作" width="85" fixed="right"><template #default="{ row }"><ElButton link type="primary" @click="openRow(row)">详情</ElButton></template></ElTableColumn>
      </ElTable>
      <div class="mt-4 flex justify-end gap-2"><ElButton :disabled="cursorStack.length === 0" @click="previous">上一页</ElButton><ElButton :disabled="!nextCursor" @click="next">下一页</ElButton></div>
    </ElCard>

    <ElDrawer v-model="detailOpen" :title="`订单 #${detail?.order.orderId || ''}`" size="70%">
      <template v-if="detail">
        <ElDescriptions :column="2" border><ElDescriptionsItem label="订单号">{{ detail.order.orderNo }}</ElDescriptionsItem><ElDescriptionsItem label="用户 ID">{{ detail.order.userId }}</ElDescriptionsItem><ElDescriptionsItem label="商品">{{ detail.order.internalCode }}</ElDescriptionsItem><ElDescriptionsItem label="状态">{{ statusText(detail.order.status) }}</ElDescriptionsItem><ElDescriptionsItem label="订单记录金额">{{ detail.order.amountMinor }} {{ detail.order.currency }}（最小单位）</ElDescriptionsItem><ElDescriptionsItem label="商店渠道">{{ detail.order.paymentChannel }}</ElDescriptionsItem></ElDescriptions>
        <ElDivider>支付交易</ElDivider><ElTable :data="detail.transactions"><ElTableColumn prop="transactionId" label="交易 ID" /><ElTableColumn prop="transactionType" label="类型" /><ElTableColumn prop="status" label="状态" /><ElTableColumn prop="verifiedAt" label="验证时间" /></ElTable>
        <ElDivider>权益账本</ElDivider><ElTable :data="detail.entitlementLedger"><ElTableColumn prop="ledgerId" label="流水 ID" /><ElTableColumn prop="entitlementType" label="权益" /><ElTableColumn prop="changeAmount" label="变更" /><ElTableColumn prop="balanceAfter" label="余额" /><ElTableColumn prop="createdAt" label="时间" /></ElTable>
        <ElDivider>金币账本</ElDivider><ElTable :data="detail.coinLedger"><ElTableColumn prop="ledgerId" label="流水 ID" /><ElTableColumn prop="operation" label="操作" /><ElTableColumn prop="amount" label="数量" /><ElTableColumn prop="balanceAfter" label="余额" /><ElTableColumn prop="createdAt" label="时间" /></ElTable>
      </template>
    </ElDrawer>
    <ElDrawer v-model="productOpen" :title="`商品 #${product?.productId || ''}`" size="55%">
      <template v-if="product">
        <ElAlert v-if="product.productType === 'coin_pack'" title="金币包购买入口保持关闭" type="warning" show-icon :closable="false" class="mb-4" />
        <ElDescriptions :column="1" border><ElDescriptionsItem label="内部编码">{{ product.internalCode }}</ElDescriptionsItem><ElDescriptionsItem label="类型">{{ product.productType }}</ElDescriptionsItem><ElDescriptionsItem label="状态">{{ statusText(product.status) }}</ElDescriptionsItem><ElDescriptionsItem label="Google Play 商品 ID">{{ product.storeProductIds?.googlePlay || '未配置' }}</ElDescriptionsItem><ElDescriptionsItem label="App Store 商品 ID">{{ product.storeProductIds?.appStore || '未配置' }}</ElDescriptionsItem><ElDescriptionsItem label="可用地区">{{ product.availableRegions?.join('、') }}</ElDescriptionsItem><ElDescriptionsItem label="售价">以商店实时数据为准</ElDescriptionsItem></ElDescriptions>
        <ElDivider>服务端授予权益</ElDivider><ElTable :data="product.entitlements"><ElTableColumn prop="grantType" label="授予类型" /><ElTableColumn prop="entitlementCode" label="权益代码" /><ElTableColumn prop="grantAmount" label="数量" /></ElTable>
        <div v-if="canManageProducts && product.productType !== 'coin_pack'" class="mt-5 flex gap-2"><ElButton v-if="product.status !== 'draft'" @click="changeProductStatus('draft')">设为草稿</ElButton><ElButton v-if="product.status !== 'published'" type="primary" @click="changeProductStatus('published')">发布</ElButton><ElButton v-if="product.status !== 'retired'" @click="changeProductStatus('retired')">退役</ElButton></div>
      </template>
    </ElDrawer>
  </div>
</template>
