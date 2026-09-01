CREATE TABLE `user_app_state` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text,
	`payload` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
