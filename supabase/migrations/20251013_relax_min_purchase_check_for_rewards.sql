-- Allow reward credits to have amount_paid = 0 while preserving monetary constraints

-- Drop old constraint if exists
ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS min_purchase_check;

-- Recreate with source-aware logic
ALTER TABLE credit_transactions
ADD CONSTRAINT min_purchase_check
CHECK (
  (
    source = 'monetary'::credit_source_enum
    AND amount_paid > 0.00
    AND credits_purchased > 0.00
  )
  OR (
    source = 'reward'::credit_source_enum
    AND amount_paid = 0.00
    AND credits_purchased > 0.00
  )
  OR (
    source = 'adjustment'::credit_source_enum
    AND credits_purchased <> 0.00
    AND amount_paid >= 0.00
  )
);

