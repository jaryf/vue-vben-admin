import { requestClient } from '#/api/request';

import type { CursorPage } from './app-users';

export interface ProductRow {
  productId: number; productType: string; internalCode: string; status: string;
  currency: string; priceMinor: number; billingPeriod: string;
  storeProductIds: { googlePlay: null | string; appStore: null | string };
  availableRegions: string[]; entitlements: Record<string, any>[];
}
export interface OrderRow {
  orderId: number; orderNo: string; userId: number; productId: number;
  internalCode: string; paymentChannel: string; currency: string;
  amountMinor: number; status: string; createdAt: string; paidAt: null | string;
}
export interface OrderDetail {
  order: OrderRow; transactions: Record<string, any>[];
  entitlementLedger: Record<string, any>[]; coinLedger: Record<string, any>[];
}

export const listProducts = (params: Record<string, unknown>) => requestClient.get<CursorPage<ProductRow>>('/products', { params });
export const updateProductStatus = (id: number, status: string) => requestClient.request<ProductRow>(`/products/${id}/status`, { method: 'PATCH', data: { status } });
export const listOrders = (params: Record<string, unknown>) => requestClient.get<CursorPage<OrderRow>>('/orders', { params });
export const getOrder = (id: number) => requestClient.get<OrderDetail>(`/orders/${id}`);
export const listPayments = (params: Record<string, unknown>) => requestClient.get<CursorPage<Record<string, any>>>('/payments', { params });
export const listSubscriptions = (params: Record<string, unknown>) => requestClient.get<CursorPage<Record<string, any>>>('/subscriptions', { params });
export const listEntitlementLedger = (params: Record<string, unknown>) => requestClient.get<CursorPage<Record<string, any>>>('/entitlement-ledger', { params });
export const listCoinLedger = (params: Record<string, unknown>) => requestClient.get<CursorPage<Record<string, any>>>('/coin-ledger', { params });
