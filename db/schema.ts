import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const auditColumns = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
};

export const users = sqliteTable('users', {
  id: text('id').primaryKey(), email: text('email').notNull(), displayName: text('display_name'),
  baseCurrency: text('base_currency').notNull().default('VND'), ...auditColumns,
}, (table) => [uniqueIndex('idx_users_email').on(table.email)]);

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(), name: text('name').notNull(), ownerId: text('owner_id').notNull().references(() => users.id),
  baseCurrency: text('base_currency').notNull().default('VND'), ...auditColumns,
}, (table) => [index('idx_workspaces_owner_id').on(table.ownerId)]);

export const workspaceMembers = sqliteTable('workspace_members', {
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  userId: text('user_id').notNull().references(() => users.id),
  role: text('role', { enum: ['owner', 'editor', 'viewer'] }).notNull(),
  joinedAt: integer('joined_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [uniqueIndex('idx_workspace_members_unique').on(table.workspaceId, table.userId)]);

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  name: text('name').notNull(), institution: text('institution'),
  type: text('type', { enum: ['cash', 'bank', 'ewallet', 'credit_card', 'loan', 'receivable', 'savings'] }).notNull(),
  currency: text('currency').notNull().default('VND'), openingBalanceMinor: integer('opening_balance_minor').notNull().default(0),
  creditLimitMinor: integer('credit_limit_minor'), statementDay: integer('statement_day'), dueDay: integer('due_day'),
  archivedAt: integer('archived_at', { mode: 'timestamp_ms' }), ...auditColumns,
}, (table) => [index('idx_accounts_workspace_id').on(table.workspaceId)]);

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  parentId: text('parent_id'), name: text('name').notNull(), kind: text('kind', { enum: ['income', 'expense'] }).notNull(),
  icon: text('icon'), color: text('color'), ...auditColumns,
}, (table) => [index('idx_categories_workspace_kind').on(table.workspaceId, table.kind)]);

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  kind: text('kind', { enum: ['income', 'expense', 'transfer', 'adjustment', 'debt_payment', 'refund'] }).notNull(),
  status: text('status', { enum: ['draft', 'pending_approval', 'posted', 'rejected', 'voided'] }).notNull(),
  categoryId: text('category_id').references(() => categories.id), merchant: text('merchant'), note: text('note'),
  occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
  source: text('source', { enum: ['manual', 'gmail', 'recurring', 'import'] }).notNull().default('manual'),
  createdBy: text('created_by').references(() => users.id), approvedBy: text('approved_by').references(() => users.id),
  approvedAt: integer('approved_at', { mode: 'timestamp_ms' }), idempotencyKey: text('idempotency_key'), ...auditColumns,
}, (table) => [
  index('idx_transactions_workspace_date').on(table.workspaceId, table.occurredAt),
  index('idx_transactions_workspace_status').on(table.workspaceId, table.status),
  uniqueIndex('idx_transactions_idempotency').on(table.workspaceId, table.idempotencyKey),
]);

export const postings = sqliteTable('postings', {
  id: text('id').primaryKey(), transactionId: text('transaction_id').notNull().references(() => transactions.id),
  accountId: text('account_id').notNull().references(() => accounts.id), amountMinor: integer('amount_minor').notNull(),
  currency: text('currency').notNull(), exchangeRateMicros: integer('exchange_rate_micros'),
  baseAmountMinor: integer('base_amount_minor').notNull(), createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [index('idx_postings_account_id').on(table.accountId), index('idx_postings_transaction_id').on(table.transactionId)]);

export const emailImports = sqliteTable('email_imports', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  provider: text('provider').notNull().default('gmail'), gmailMessageId: text('gmail_message_id').notNull(),
  gmailThreadId: text('gmail_thread_id'), sender: text('sender').notNull(), institution: text('institution'),
  parserVersion: text('parser_version').notNull(), parsedPayload: text('parsed_payload', { mode: 'json' }),
  status: text('status', { enum: ['received', 'parsed', 'needs_review', 'approved', 'ignored', 'failed'] }).notNull(),
  transactionId: text('transaction_id').references(() => transactions.id),
  receivedAt: integer('received_at', { mode: 'timestamp_ms' }).notNull(), ...auditColumns,
}, (table) => [
  uniqueIndex('idx_email_imports_gmail_message').on(table.workspaceId, table.gmailMessageId),
  index('idx_email_imports_status').on(table.workspaceId, table.status),
]);

export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  categoryId: text('category_id').references(() => categories.id), period: text('period', { enum: ['weekly', 'monthly', 'custom'] }).notNull(),
  limitMinor: integer('limit_minor').notNull(), currency: text('currency').notNull().default('VND'),
  startsAt: integer('starts_at', { mode: 'timestamp_ms' }).notNull(), endsAt: integer('ends_at', { mode: 'timestamp_ms' }), ...auditColumns,
}, (table) => [index('idx_budgets_workspace_period').on(table.workspaceId, table.startsAt)]);

export const installmentPlans = sqliteTable('installment_plans', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  liabilityAccountId: text('liability_account_id').notNull().references(() => accounts.id), name: text('name').notNull(),
  principalMinor: integer('principal_minor').notNull(), interestMinor: integer('interest_minor').notNull().default(0),
  feeMinor: integer('fee_minor').notNull().default(0), installmentCount: integer('installment_count').notNull(),
  firstDueAt: integer('first_due_at', { mode: 'timestamp_ms' }).notNull(),
  status: text('status', { enum: ['active', 'paid', 'cancelled'] }).notNull(), ...auditColumns,
}, (table) => [index('idx_installment_plans_account').on(table.liabilityAccountId)]);

export const counterparties = sqliteTable('counterparties', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  name: text('name').notNull(), phone: text('phone'), note: text('note'), ...auditColumns,
}, (table) => [index('idx_counterparties_workspace').on(table.workspaceId)]);

export const debtAgreements = sqliteTable('debt_agreements', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  counterpartyId: text('counterparty_id').notNull().references(() => counterparties.id),
  direction: text('direction', { enum: ['borrowed', 'lent'] }).notNull(),
  principalMinor: integer('principal_minor').notNull(), interestMinor: integer('interest_minor').notNull().default(0),
  currency: text('currency').notNull().default('VND'), startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
  dueAt: integer('due_at', { mode: 'timestamp_ms' }), status: text('status', { enum: ['active', 'paid', 'overdue', 'cancelled'] }).notNull(),
  note: text('note'), ...auditColumns,
}, (table) => [index('idx_debt_agreements_workspace_status').on(table.workspaceId, table.status), index('idx_debt_agreements_counterparty').on(table.counterpartyId)]);

export const debtPayments = sqliteTable('debt_payments', {
  id: text('id').primaryKey(), debtAgreementId: text('debt_agreement_id').notNull().references(() => debtAgreements.id),
  transactionId: text('transaction_id').references(() => transactions.id), amountMinor: integer('amount_minor').notNull(),
  paidAt: integer('paid_at', { mode: 'timestamp_ms' }).notNull(), note: text('note'), createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [index('idx_debt_payments_agreement').on(table.debtAgreementId)]);

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  actorId: text('actor_id').references(() => users.id), action: text('action').notNull(),
  entityType: text('entity_type').notNull(), entityId: text('entity_id').notNull(), changes: text('changes', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => [index('idx_audit_logs_entity').on(table.workspaceId, table.entityType, table.entityId)]);
