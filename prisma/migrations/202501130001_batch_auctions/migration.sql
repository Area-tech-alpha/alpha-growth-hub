-- Create enums for batch auction workflow
CREATE TYPE "auction_type_enum" AS ENUM ('single', 'batch');
CREATE TYPE "batch_auction_status_enum" AS ENUM ('open', 'running', 'completed', 'cancelled');
CREATE TYPE "batch_auction_result_enum" AS ENUM ('pending', 'sold', 'expired');
CREATE TYPE "batch_auction_trigger_enum" AS ENUM ('auto', 'manual');

-- Settings table to control automation behaviour
CREATE TABLE "batch_auction_settings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "low_frozen_threshold" INTEGER NOT NULL,
  "auto_trigger_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "lead_unit_price" NUMERIC(10, 2) NOT NULL DEFAULT 225.00,
  "created_at" TIMESTAMPTZ(6) DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) DEFAULT now(),
  "updated_by" TEXT
);

-- Master table for batch auctions
CREATE TABLE "batch_auctions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "total_leads" INTEGER NOT NULL,
  "lead_unit_price" NUMERIC(10, 2) NOT NULL,
  "minimum_bid" NUMERIC(10, 2) NOT NULL,
  "status" "batch_auction_status_enum" NOT NULL DEFAULT 'open',
  "result" "batch_auction_result_enum" NOT NULL DEFAULT 'pending',
  "trigger_reason" "batch_auction_trigger_enum" NOT NULL DEFAULT 'auto',
  "created_at" TIMESTAMPTZ(6) DEFAULT now(),
  "expired_at" TIMESTAMPTZ(6),
  "closed_at" TIMESTAMPTZ(6),
  "metadata" JSONB
);

CREATE INDEX "batch_auctions_status_idx" ON "batch_auctions" ("status");
CREATE INDEX "batch_auctions_result_idx" ON "batch_auctions" ("result");

-- Pivot table capturing leads inside a batch
CREATE TABLE "batch_auction_leads" (
  "batch_auction_id" UUID NOT NULL,
  "lead_id" UUID NOT NULL,
  "included_at" TIMESTAMPTZ(6) DEFAULT now(),
  "status_before_batch" VARCHAR(50) NOT NULL,
  "final_status" VARCHAR(50),
  "sold_at" TIMESTAMPTZ(6),
  CONSTRAINT "batch_auction_leads_pkey" PRIMARY KEY ("batch_auction_id", "lead_id"),
  CONSTRAINT "batch_auction_leads_lead_id_key" UNIQUE ("lead_id")
);

CREATE INDEX "batch_auction_leads_lead_id_idx" ON "batch_auction_leads" ("lead_id");

-- Extend auctions with batch support
ALTER TABLE "auctions"
  ADD COLUMN "type" "auction_type_enum" NOT NULL DEFAULT 'single',
  ADD COLUMN "batch_auction_id" UUID UNIQUE;

CREATE INDEX "auctions_batch_auction_id_idx" ON "auctions" ("batch_auction_id");

-- Extend leads with batch tracking metadata
ALTER TABLE "leads"
  ADD COLUMN "batched_at" TIMESTAMPTZ(6),
  ADD COLUMN "batch_auction_id" UUID,
  ADD COLUMN "batch_result" VARCHAR(50);

CREATE INDEX "leads_batch_auction_id_idx" ON "leads" ("batch_auction_id");

-- Foreign keys after tables & columns exist
ALTER TABLE "batch_auction_leads"
  ADD CONSTRAINT "batch_auction_leads_batch_auction_id_fkey"
  FOREIGN KEY ("batch_auction_id") REFERENCES "batch_auctions"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "batch_auction_leads"
  ADD CONSTRAINT "batch_auction_leads_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "leads"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "auctions"
  ADD CONSTRAINT "auctions_batch_auction_id_fkey"
  FOREIGN KEY ("batch_auction_id") REFERENCES "batch_auctions"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_batch_auction_id_fkey"
  FOREIGN KEY ("batch_auction_id") REFERENCES "batch_auctions"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
