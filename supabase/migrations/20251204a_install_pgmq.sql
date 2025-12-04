-- Ensure the PGMQ extension and credit_jobs queue exist (idempotent).
-- Needed because webhooks enqueue payments via pgmq.send(...).

CREATE SCHEMA IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS pgmq WITH SCHEMA pgmq;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'pgmq'
      AND c.relname = 'q_credit_jobs'
  ) THEN
    PERFORM pgmq.create('credit_jobs');
  END IF;
END
$$;
