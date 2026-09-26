import type { MessageBoxInputData } from 'element-plus';

import { ElMessageBox } from 'element-plus';

function isDismissed(error: unknown) {
  return error === 'cancel' || error === 'close';
}

async function confirmDialog(
  ...args: Parameters<typeof ElMessageBox.confirm>
): Promise<boolean> {
  try {
    await ElMessageBox.confirm(...args);
    return true;
  } catch (error) {
    if (isDismissed(error)) return false;
    throw error;
  }
}

async function promptDialog(
  ...args: Parameters<typeof ElMessageBox.prompt>
): Promise<MessageBoxInputData | null> {
  try {
    return await ElMessageBox.prompt(...args);
  } catch (error) {
    if (isDismissed(error)) return null;
    throw error;
  }
}

export { confirmDialog, promptDialog };
