-- Migration: add credit source enum and columns, with backfill
-- Safe-guarded to run multiple times.

DO $$ BEGIN
  CREATE TYPE credit_source_enum AS ENUM ('monetary','reward','adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE credit_transactions
  ADD COLUMN IF NOT EXISTS source credit_source_enum;

-- set default and not null progressively
ALTER TABLE credit_transactions ALTER COLUMN source SET DEFAULT 'monetary';
UPDATE credit_transactions SET source='monetary' WHERE source IS NULL;
ALTER TABLE credit_transactions ALTER COLUMN source SET NOT NULL;

ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS credit_source credit_source_enum;

-- Backfill from metadata/source and payment fields
UPDATE credit_transactions
SET source = 'reward'
WHERE amount_paid = 0 AND (metadata->>'source') = 'reward';

UPDATE ledger_entries le
SET credit_source = ct.source
FROM credit_transactions ct
WHERE le.transaction_id = ct.id;

-- Notes for function update (apply separately):
-- In public.process_credit_jobs_worker(), derive:
--   v_source_text TEXT := COALESCE((v_msg.message->>'source'), 'monetary');
-- and use it on insert:
--   INSERT INTO credit_transactions (..., source, ...)
--   VALUES (..., v_source_text::credit_source_enum, ...);
--   INSERT INTO ledger_entries (..., credit_source, ...)
--   VALUES (..., v_source_text::credit_source_enum, ...);

