-- Ensure idempotency for admin reward grants: one row per idempotency_key
CREATE UNIQUE INDEX IF NOT EXISTS uniq_credit_tx_reward_idempotency
ON credit_transactions ((metadata->>'idempotency_key'))
WHERE source = 'reward';
