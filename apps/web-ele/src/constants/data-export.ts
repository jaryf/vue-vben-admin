const DATA_EXPORT_DATASET_CONFIG = {
  audit_logs: { label: '审计日志元数据', permissions: ['audit_log.read'] },
  finance_reviews: { label: '财务异常元数据', permissions: ['finance_review.read'] },
  orders: { label: '订单', permissions: ['order.read'] },
  payment_transactions: { label: '支付交易', permissions: ['order.read'] },
  subscriptions: { label: '订阅', permissions: ['order.read'] },
  entitlement_ledger: { label: '权益账本', permissions: ['order.read'] },
  coin_ledger: { label: '金币账本', permissions: ['order.read'] },
  bottles: {
    label: '漂流瓶业务字段与内容',
    permissions: ['bottle.read', 'bottle.content.read_sensitive'],
  },
  risk_events: { label: '风险事件', permissions: ['risk_event.read'] },
  reports: { label: '举报记录', permissions: ['report.read'] },
  report_evidence: {
    label: '举报证据',
    permissions: ['report.read', 'report.evidence.read_sensitive'],
  },
  users: { label: 'App 用户资料', permissions: ['account_user.read'] },
  user_emails: {
    label: '用户完整邮箱（敏感）',
    permissions: ['account_user.read', 'account_user.email.export_sensitive'],
  },
  user_profiles: {
    label: '用户完整资料（敏感）',
    permissions: ['account_user.read', 'account_user.profile.export_sensitive'],
  },
  user_devices: {
    label: '用户设备元数据（敏感）',
    permissions: ['account_user.read', 'account_user.device.export_sensitive'],
  },
  appeals: {
    label: '申诉说明与证据引用（敏感）',
    permissions: ['appeal.read', 'appeal.evidence.read_sensitive'],
  },
  penalties: { label: '用户处罚记录', permissions: ['penalty.read'] },
  conversations: { label: '会话元数据', permissions: ['message.read_context'] },
  conversation_members: {
    label: '会话成员与匿名身份',
    permissions: ['message.read_context'],
  },
  messages: { label: '消息元数据', permissions: ['message.read_context'] },
  content_reviews: { label: '审核记录', permissions: ['moderation.review'] },
  review_evidence: { label: '脱敏审核证据', permissions: ['moderation.review'] },
  ai_roles: { label: 'AI 角色配置', permissions: ['ai_role.manage'] },
  ai_generation_batches: {
    label: 'AI 生成批次',
    permissions: ['ai_content.publish'],
  },
  ai_generation_items: { label: 'AI 生成项', permissions: ['ai_content.publish'] },
  ai_reply_tasks: { label: 'AI 回复任务', permissions: ['ai_content.publish'] },
  contact_requests: {
    label: '官网联系请求（敏感）',
    permissions: ['contact_request.read', 'contact_request.export_sensitive'],
  },
  contact_replies: {
    label: '官网联系回复（敏感）',
    permissions: ['contact_request.read', 'contact_request.export_sensitive'],
  },
  website_content_versions: {
    label: '官网页面与帮助文章版本',
    permissions: ['website_content.read'],
  },
  legal_document_versions: {
    label: '法律文档版本与多语言正文',
    permissions: ['legal_document.read'],
  },
  config_versions: {
    label: '配置版本与审批记录',
    permissions: ['config_version.read'],
  },
} as const;

type DataExportDataset = keyof typeof DATA_EXPORT_DATASET_CONFIG;

const DATA_EXPORT_DATASETS = Object.keys(
  DATA_EXPORT_DATASET_CONFIG,
) as DataExportDataset[];

export {
  DATA_EXPORT_DATASET_CONFIG,
  DATA_EXPORT_DATASETS,
  type DataExportDataset,
};
