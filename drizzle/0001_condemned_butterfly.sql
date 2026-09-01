CREATE TABLE `counterparties` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_counterparties_workspace` ON `counterparties` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `debt_agreements` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`counterparty_id` text NOT NULL,
	`direction` text NOT NULL,
	`principal_minor` integer NOT NULL,
	`interest_minor` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'VND' NOT NULL,
	`started_at` integer NOT NULL,
	`due_at` integer,
	`status` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`counterparty_id`) REFERENCES `counterparties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_debt_agreements_workspace_status` ON `debt_agreements` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_debt_agreements_counterparty` ON `debt_agreements` (`counterparty_id`);--> statement-breakpoint
CREATE TABLE `debt_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`debt_agreement_id` text NOT NULL,
	`transaction_id` text,
	`amount_minor` integer NOT NULL,
	`paid_at` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`debt_agreement_id`) REFERENCES `debt_agreements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_debt_payments_agreement` ON `debt_payments` (`debt_agreement_id`);