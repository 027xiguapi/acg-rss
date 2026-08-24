CREATE TABLE "accounts" (
	"user_id" integer NOT NULL,
	"type" varchar(32) NOT NULL,
	"provider" varchar(64) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" varchar(1024),
	"access_token" varchar(1024),
	"expires_at" integer,
	"token_type" varchar(64),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "bangumi" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"season" integer DEFAULT 1 NOT NULL,
	"year" integer,
	"origin" varchar(16),
	"air_day" integer,
	"type" varchar(16),
	"cover_url" text,
	"watch_status" varchar(16) DEFAULT 'WATCHING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bangumi_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"bangumi_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bangumi_episodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"bangumi_id" integer NOT NULL,
	"number" integer NOT NULL,
	"cover_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bangumi_favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"bangumi_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bangumi_infos" (
	"id" serial PRIMARY KEY NOT NULL,
	"bangumi_id" integer NOT NULL,
	"kind" varchar(16) DEFAULT 'synonym' NOT NULL,
	"lang" varchar(16),
	"title" varchar(255) NOT NULL,
	"content" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bangumi_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"bangumi_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episode_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"episode_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episode_favorites" (
	"id" serial PRIMARY KEY NOT NULL,
	"episode_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episode_infos" (
	"id" serial PRIMARY KEY NOT NULL,
	"episode_id" integer NOT NULL,
	"lang" varchar(16) NOT NULL,
	"title" text,
	"content" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episode_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"episode_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rss_feeds" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"bangumi_id" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subgroups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"category" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subgroups_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "torrent_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"magnet" text,
	"torrent_url" text,
	"info_hash" varchar(64) NOT NULL,
	"size" bigint,
	"publish_time" timestamp with time zone,
	"category" varchar(128),
	"bangumi_title" text,
	"season" integer,
	"episode" integer,
	"resolution" varchar(16),
	"subgroup" varchar(128),
	"subgroup_id" integer,
	"bangumi_id" integer,
	"episode_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(64),
	"email" varchar(255),
	"password_hash" text,
	"name" text,
	"email_verified" timestamp with time zone,
	"image" text,
	"role" varchar(16) DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bangumi" ADD CONSTRAINT "bangumi_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bangumi" ADD CONSTRAINT "bangumi_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bangumi_comments" ADD CONSTRAINT "bangumi_comments_bangumi_id_bangumi_id_fk" FOREIGN KEY ("bangumi_id") REFERENCES "public"."bangumi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bangumi_comments" ADD CONSTRAINT "bangumi_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bangumi_episodes" ADD CONSTRAINT "bangumi_episodes_bangumi_id_bangumi_id_fk" FOREIGN KEY ("bangumi_id") REFERENCES "public"."bangumi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bangumi_favorites" ADD CONSTRAINT "bangumi_favorites_bangumi_id_bangumi_id_fk" FOREIGN KEY ("bangumi_id") REFERENCES "public"."bangumi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bangumi_favorites" ADD CONSTRAINT "bangumi_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bangumi_infos" ADD CONSTRAINT "bangumi_infos_bangumi_id_bangumi_id_fk" FOREIGN KEY ("bangumi_id") REFERENCES "public"."bangumi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bangumi_likes" ADD CONSTRAINT "bangumi_likes_bangumi_id_bangumi_id_fk" FOREIGN KEY ("bangumi_id") REFERENCES "public"."bangumi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bangumi_likes" ADD CONSTRAINT "bangumi_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_comments" ADD CONSTRAINT "episode_comments_episode_id_bangumi_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."bangumi_episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_comments" ADD CONSTRAINT "episode_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_favorites" ADD CONSTRAINT "episode_favorites_episode_id_bangumi_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."bangumi_episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_favorites" ADD CONSTRAINT "episode_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_infos" ADD CONSTRAINT "episode_infos_episode_id_bangumi_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."bangumi_episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_likes" ADD CONSTRAINT "episode_likes_episode_id_bangumi_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."bangumi_episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_likes" ADD CONSTRAINT "episode_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rss_feeds" ADD CONSTRAINT "rss_feeds_bangumi_id_bangumi_id_fk" FOREIGN KEY ("bangumi_id") REFERENCES "public"."bangumi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "torrent_items" ADD CONSTRAINT "torrent_items_subgroup_id_subgroups_id_fk" FOREIGN KEY ("subgroup_id") REFERENCES "public"."subgroups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "torrent_items" ADD CONSTRAINT "torrent_items_bangumi_id_bangumi_id_fk" FOREIGN KEY ("bangumi_id") REFERENCES "public"."bangumi"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "torrent_items" ADD CONSTRAINT "torrent_items_episode_id_bangumi_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."bangumi_episodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bangumi_user_idx" ON "bangumi" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bangumi_comments_bangumi_idx" ON "bangumi_comments" USING btree ("bangumi_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bangumi_episodes_bangumi_number_unique" ON "bangumi_episodes" USING btree ("bangumi_id","number");--> statement-breakpoint
CREATE INDEX "bangumi_episodes_bangumi_idx" ON "bangumi_episodes" USING btree ("bangumi_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bangumi_favorites_bangumi_user_unique" ON "bangumi_favorites" USING btree ("bangumi_id","user_id");--> statement-breakpoint
CREATE INDEX "bangumi_favorites_user_idx" ON "bangumi_favorites" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bangumi_infos_bangumi_title_unique" ON "bangumi_infos" USING btree ("bangumi_id","title");--> statement-breakpoint
CREATE INDEX "bangumi_infos_bangumi_idx" ON "bangumi_infos" USING btree ("bangumi_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bangumi_likes_bangumi_user_unique" ON "bangumi_likes" USING btree ("bangumi_id","user_id");--> statement-breakpoint
CREATE INDEX "bangumi_likes_user_idx" ON "bangumi_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "episode_comments_episode_idx" ON "episode_comments" USING btree ("episode_id");--> statement-breakpoint
CREATE UNIQUE INDEX "episode_favorites_episode_user_unique" ON "episode_favorites" USING btree ("episode_id","user_id");--> statement-breakpoint
CREATE INDEX "episode_favorites_user_idx" ON "episode_favorites" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "episode_infos_episode_lang_unique" ON "episode_infos" USING btree ("episode_id","lang");--> statement-breakpoint
CREATE INDEX "episode_infos_episode_idx" ON "episode_infos" USING btree ("episode_id");--> statement-breakpoint
CREATE UNIQUE INDEX "episode_likes_episode_user_unique" ON "episode_likes" USING btree ("episode_id","user_id");--> statement-breakpoint
CREATE INDEX "episode_likes_user_idx" ON "episode_likes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rss_feeds_url_unique" ON "rss_feeds" USING btree ("url");--> statement-breakpoint
CREATE INDEX "rss_feeds_bangumi_idx" ON "rss_feeds" USING btree ("bangumi_id");--> statement-breakpoint
CREATE UNIQUE INDEX "torrent_items_info_hash_unique" ON "torrent_items" USING btree ("info_hash");--> statement-breakpoint
CREATE INDEX "torrent_items_created_idx" ON "torrent_items" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "torrent_items_episode_idx" ON "torrent_items" USING btree ("episode_id");