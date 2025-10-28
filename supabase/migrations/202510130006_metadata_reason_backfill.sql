-- Normalize metadata: move `motivo` -> `reason` and remove `motivo`

-- 1) If there is `motivo` and no `reason`, copy `motivo` to `reason`
UPDATE credit_transactions
SET metadata = jsonb_set(metadata, '{reason}', to_jsonb(metadata->>'motivo'), true)
WHERE (metadata ? 'motivo') AND NOT (metadata ? 'reason');

-- 2) Remove `motivo` key from all rows
UPDATE credit_transactions
SET metadata = metadata - 'motivo'
WHERE (metadata ? 'motivo');
