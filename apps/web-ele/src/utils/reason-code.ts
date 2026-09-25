const REASON_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const REASON_CODE_ERROR =
  '请输入 1–64 位稳定原因代码，仅可包含字母、数字、点、下划线和横线';

function isValidReasonCode(value: string) {
  return REASON_CODE_PATTERN.test(value.trim());
}

function validateReasonCode(value: string): string | true {
  return isValidReasonCode(value) || REASON_CODE_ERROR;
}

export {
  isValidReasonCode,
  REASON_CODE_ERROR,
  REASON_CODE_PATTERN,
  validateReasonCode,
};
