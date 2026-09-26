import type { App } from 'vue';

import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import GenerationBatchPage from '../list.vue';

const api = vi.hoisted(() => ({
  approveGenerationItem: vi.fn(),
  cancelAIReplyTask: vi.fn(),
  cancelGenerationBatch: vi.fn(),
  createGenerationBatch: vi.fn(),
  getAIReplyTask: vi.fn(),
  getGenerationBatch: vi.fn(),
  listAIReplyTasks: vi.fn(),
  listGenerationBatches: vi.fn(),
  listGenerationItems: vi.fn(),
  publishGenerationItems: vi.fn(),
  rejectGenerationItem: vi.fn(),
  retryAIReplyTask: vi.fn(),
  startGenerationBatch: vi.fn(),
  updateGenerationItem: vi.fn(),
}));

vi.mock('#/api/ai', () => api);
vi.mock('#/components/admin-time.vue', () => ({
  default: { props: ['value'], template: '<span>{{ value }}</span>' },
}));

const batchPage = {
  items: [
    {
      batchId: 1,
      categoryId: 1,
      languageCode: 'en',
      targetCount: 2,
      modelConfigVersion: 'previous-batch-model',
      status: 'completed',
      createdAt: '',
    },
  ],
  nextCursor: 'previous-batch-cursor',
};
const itemPage = {
  items: [
    {
      itemId: 2,
      batchId: 1,
      aiRoleId: 1,
      text: 'Current generated item',
      status: 'published',
      contentRevision: 1,
    },
  ],
  nextCursor: null,
};
let app: App | undefined;
let host: HTMLDivElement;
let renderErrors: unknown[];

function mountPage() {
  app = createApp(GenerationBatchPage);
  app.directive('loading', {});
  app.config.errorHandler = (error) => renderErrors.push(error);
  app.mount(host);
}

async function selectTab(label: string) {
  const tab = [...host.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (element) => element.textContent?.trim() === label,
  );
  if (!tab) throw new Error(`Tab not found: ${label}`);
  tab.click();
  await nextTick();
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listGenerationBatches.mockResolvedValue(batchPage);
  api.listGenerationItems.mockResolvedValue(itemPage);
  api.listAIReplyTasks.mockResolvedValue({ items: [], nextCursor: null });
  renderErrors = [];
  host = document.createElement('div');
  document.body.append(host);
});

afterEach(() => {
  app?.unmount();
  host.remove();
  if (renderErrors.length > 0) {
    throw new AggregateError(renderErrors, 'Unexpected page render errors');
  }
});

describe('aI generation tabs', () => {
  it('loads the newly selected tab after Element Plus updates its model', async () => {
    mountPage();
    await vi.waitFor(() =>
      expect(host.textContent).toContain('previous-batch-model'),
    );

    await selectTab('生成内容');
    await vi.waitFor(() =>
      expect(host.textContent).toContain('Current generated item'),
    );
    expect(api.listGenerationBatches).toHaveBeenCalledTimes(1);
    expect(api.listGenerationItems).toHaveBeenCalledTimes(1);

    await selectTab('回复任务');
    await vi.waitFor(() =>
      expect(api.listAIReplyTasks).toHaveBeenCalledTimes(1),
    );
    expect(api.listGenerationItems).toHaveBeenCalledTimes(1);
  });

  it('preserves the batch filter and loads once when opening a batch content row', async () => {
    mountPage();
    await vi.waitFor(() =>
      expect(host.textContent).toContain('previous-batch-model'),
    );
    const contentButton = [
      ...host.querySelectorAll<HTMLButtonElement>('button'),
    ].find((button) => button.textContent?.trim() === '内容');
    if (!contentButton) throw new Error('Batch content button not found');

    contentButton.click();
    await vi.waitFor(() =>
      expect(host.textContent).toContain('Current generated item'),
    );
    await nextTick();

    expect(api.listGenerationItems).toHaveBeenCalledTimes(1);
    expect(api.listGenerationItems).toHaveBeenCalledWith(
      expect.objectContaining({ batchId: '1' }),
    );
    expect(
      host.querySelector<HTMLInputElement>('input[placeholder="批次 ID"]')
        ?.value,
    ).toBe('1');
    const selectedTab = host.querySelector(
      '[role="tab"][aria-selected="true"]',
    );
    expect(selectedTab?.textContent?.trim()).toBe('生成内容');
  });

  it('ignores a previous tab response that arrives after the current tab', async () => {
    let resolveBatch!: (page: typeof batchPage) => void;
    api.listGenerationBatches.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBatch = resolve;
      }),
    );
    mountPage();

    await selectTab('生成内容');
    await vi.waitFor(() =>
      expect(host.textContent).toContain('Current generated item'),
    );
    resolveBatch(batchPage);
    await Promise.resolve();
    await nextTick();

    expect(host.textContent).toContain('Current generated item');
    expect(host.textContent).not.toContain('previous-batch-model');
    const nextButton = [
      ...host.querySelectorAll<HTMLButtonElement>('button'),
    ].find((button) => button.textContent?.trim() === '下一页');
    expect(nextButton?.disabled).toBe(true);
  });
});
