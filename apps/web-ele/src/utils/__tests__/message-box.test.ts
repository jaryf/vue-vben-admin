import { beforeEach, describe, expect, it, vi } from 'vitest';

import { confirmDialog, promptDialog } from '../message-box';

const messageBox = vi.hoisted(() => ({
  confirm: vi.fn(),
  prompt: vi.fn(),
}));

vi.mock('element-plus', () => ({ ElMessageBox: messageBox }));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('confirmDialog', () => {
  it('preserves dialog arguments and returns true after confirmation', async () => {
    const options = { confirmButtonText: '确认', type: 'warning' as const };
    messageBox.confirm.mockResolvedValue('confirm');

    await expect(confirmDialog('确认执行？', '确认', options)).resolves.toBe(
      true,
    );
    expect(messageBox.confirm).toHaveBeenCalledWith(
      '确认执行？',
      '确认',
      options,
    );
  });

  it.each(['cancel', 'close'])(
    'resolves false when dismissed with %s',
    async (action) => {
      messageBox.confirm.mockRejectedValue(action);

      await expect(confirmDialog('确认执行？', '确认')).resolves.toBe(false);
    },
  );

  it('preserves unexpected errors instead of treating them as cancellation', async () => {
    const error = new Error('Dialog failed');
    messageBox.confirm.mockRejectedValue(error);

    await expect(confirmDialog('确认执行？', '确认')).rejects.toBe(error);
  });
});

describe('promptDialog', () => {
  it('preserves the confirmed value and dialog arguments', async () => {
    const result = { value: '  operator reason  ', action: 'confirm' as const };
    const options = {
      inputValue: 'initial',
      inputValidator: vi.fn(() => true),
    };
    messageBox.prompt.mockResolvedValue(result);

    await expect(promptDialog('请输入原因', '确认', options)).resolves.toBe(
      result,
    );
    expect(messageBox.prompt).toHaveBeenCalledWith(
      '请输入原因',
      '确认',
      options,
    );
  });

  it.each(['cancel', 'close'])(
    'resolves null when dismissed with %s',
    async (action) => {
      messageBox.prompt.mockRejectedValue(action);

      await expect(promptDialog('请输入原因', '确认')).resolves.toBeNull();
    },
  );

  it('preserves unexpected errors instead of treating them as cancellation', async () => {
    const error = new Error('cancel');
    messageBox.prompt.mockRejectedValue(error);

    await expect(promptDialog('请输入原因', '确认')).rejects.toBe(error);
  });
});
