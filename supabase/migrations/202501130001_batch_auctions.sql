-- Batch auctions schema additions (safe to re-run)

-- Enums ----------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.auction_type_enum AS ENUM ('single', 'batch');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.batch_auction_status_enum AS ENUM ('open', 'running', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.batch_auction_result_enum AS ENUM ('pending', 'sold', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.batch_auction_trigger_enum AS ENUM ('auto', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- Tables ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.batch_auction_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  low_frozen_threshold INTEGER NOT NULL,
  auto_trigger_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  lead_unit_price NUMERIC(10, 2) NOT NULL DEFAULT 225.00,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS public.batch_auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_leads INTEGER NOT NULL,
  lead_unit_price NUMERIC(10, 2) NOT NULL,
  minimum_bid NUMERIC(10, 2) NOT NULL,
  status public.batch_auction_status_enum NOT NULL DEFAULT 'open',
  result public.batch_auction_result_enum NOT NULL DEFAULT 'pending',
  trigger_reason public.batch_auction_trigger_enum NOT NULL DEFAULT 'auto',
  created_at TIMESTAMPTZ DEFAULT now(),
  expired_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS batch_auctions_status_idx ON public.batch_auctions (status);
CREATE INDEX IF NOT EXISTS batch_auctions_result_idx ON public.batch_auctions (result);

CREATE TABLE IF NOT EXISTS public.batch_auction_leads (
  batch_auction_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  included_at TIMESTAMPTZ DEFAULT now(),
  status_before_batch VARCHAR(50) NOT NULL,
  final_status VARCHAR(50),
  sold_at TIMESTAMPTZ,
  CONSTRAINT batch_auction_leads_pkey PRIMARY KEY (batch_auction_id, lead_id),
  CONSTRAINT batch_auction_leads_lead_id_key UNIQUE (lead_id)
);

CREATE INDEX IF NOT EXISTS batch_auction_leads_lead_id_idx ON public.batch_auction_leads (lead_id);


-- Auctions extensions --------------------------------------------------------
ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS type public.auction_type_enum,
  ADD COLUMN IF NOT EXISTS batch_auction_id UUID;

UPDATE public.auctions
SET type = 'single'
WHERE type IS NULL;

ALTER TABLE public.auctions
  ALTER COLUMN type SET DEFAULT 'single';

ALTER TABLE public.auctions
  ALTER COLUMN type SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS auctions_batch_auction_id_key
  ON public.auctions (batch_auction_id)
  WHERE batch_auction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS auctions_batch_auction_id_idx
  ON public.auctions (batch_auction_id);


-- Leads extensions -----------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS batched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS batch_auction_id UUID,
  ADD COLUMN IF NOT EXISTS batch_result VARCHAR(50);

CREATE INDEX IF NOT EXISTS leads_batch_auction_id_idx
  ON public.leads (batch_auction_id);


-- Foreign keys ---------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.batch_auction_leads
    ADD CONSTRAINT batch_auction_leads_batch_auction_id_fkey
    FOREIGN KEY (batch_auction_id) REFERENCES public.batch_auctions(id)
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.batch_auction_leads
    ADD CONSTRAINT batch_auction_leads_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id)
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.auctions
    ADD CONSTRAINT auctions_batch_auction_id_fkey
    FOREIGN KEY (batch_auction_id) REFERENCES public.batch_auctions(id)
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.leads
    ADD CONSTRAINT leads_batch_auction_id_fkey
    FOREIGN KEY (batch_auction_id) REFERENCES public.batch_auctions(id)
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
