-- Unique idempotency key across all sources (when provided)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_credit_tx_idempotency_all
ON credit_transactions ((metadata->>'idempotency_key'))
WHERE (metadata ? 'idempotency_key');

