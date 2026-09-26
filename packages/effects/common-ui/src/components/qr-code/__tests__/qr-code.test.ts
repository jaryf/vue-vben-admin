import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import QrCode from '../qr-code.vue';

const { toDataURL } = vi.hoisted(() => ({
  toDataURL: vi.fn(),
}));

vi.mock('qrcode', () => ({
  default: { toDataURL },
}));

function pendingImage() {
  let resolve!: (value: string) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<string>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

enableAutoUnmount(afterEach);

beforeEach(() => {
  toDataURL.mockReset();
});

describe('qr-code.vue', () => {
  it('keeps the latest image when an older generation finishes afterward', async () => {
    const previous = pendingImage();
    const current = pendingImage();
    toDataURL
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(current.promise);
    const wrapper = mount(QrCode, { props: { value: 'previous-value' } });

    await wrapper.setProps({ value: 'current-value' });
    current.resolve('data:image/png;base64,current');
    await flushPromises();
    expect(wrapper.get('img').attributes('src')).toBe(
      'data:image/png;base64,current',
    );

    previous.resolve('data:image/png;base64,previous');
    await flushPromises();
    expect(wrapper.get('img').attributes('src')).toBe(
      'data:image/png;base64,current',
    );
    expect(toDataURL).toHaveBeenNthCalledWith(
      2,
      'current-value',
      expect.any(Object),
    );
  });

  it('stays hidden after clearing the value while generation is pending', async () => {
    const previous = pendingImage();
    const current = pendingImage();
    toDataURL
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(current.promise);
    const wrapper = mount(QrCode, { props: { value: 'previous-value' } });

    await wrapper.setProps({ value: '' });
    previous.resolve('data:image/png;base64,previous');
    await flushPromises();
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.text()).toBe('');
    expect(toDataURL).toHaveBeenCalledTimes(1);

    await wrapper.setProps({ value: 'current-value' });
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('[role="status"]').exists()).toBe(true);
    current.resolve('data:image/png;base64,current');
    await flushPromises();
    expect(wrapper.get('img').attributes('src')).toBe(
      'data:image/png;base64,current',
    );
  });

  it('shows a fallback on failure and recovers when a new value succeeds', async () => {
    const failed = pendingImage();
    const recovered = pendingImage();
    toDataURL
      .mockReturnValueOnce(failed.promise)
      .mockReturnValueOnce(recovered.promise);
    const wrapper = mount(QrCode, { props: { value: 'invalid-value' } });

    failed.reject(new Error('QR generation failed'));
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('手动输入');
    expect(wrapper.find('img').exists()).toBe(false);

    await wrapper.setProps({ value: 'valid-value' });
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.find('[role="status"]').exists()).toBe(true);
    recovered.resolve('data:image/png;base64,recovered');
    await flushPromises();
    expect(wrapper.get('img').attributes('src')).toBe(
      'data:image/png;base64,recovered',
    );
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });
});
