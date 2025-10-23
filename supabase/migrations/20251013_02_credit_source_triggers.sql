-- Triggers to persist credit source automatically from metadata/relations

-- credit_transactions: set NEW.source if null based on metadata or payment fields
CREATE OR REPLACE FUNCTION public.credit_transactions_fill_source()
RETURNS trigger AS $$
BEGIN
  IF NEW.source IS NULL THEN
    NEW.source := (
      CASE
        WHEN NEW.metadata ? 'source' AND NEW.metadata->>'source' = 'reward' THEN 'reward'::credit_source_enum
        WHEN NEW.amount_paid > 0 OR NEW.asaas_payment_id IS NOT NULL OR NEW.infinitepay_payment_id IS NOT NULL THEN 'monetary'::credit_source_enum
        ELSE 'monetary'::credit_source_enum
      END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_credit_transactions_fill_source ON public.credit_transactions;
CREATE TRIGGER trg_credit_transactions_fill_source
BEFORE INSERT ON public.credit_transactions
FOR EACH ROW EXECUTE FUNCTION public.credit_transactions_fill_source();


-- ledger_entries: fill credit_source from parent transaction if null
CREATE OR REPLACE FUNCTION public.ledger_entries_fill_credit_source()
RETURNS trigger AS $$
DECLARE v_src credit_source_enum;
BEGIN
  IF NEW.credit_source IS NULL AND NEW.transaction_id IS NOT NULL THEN
    SELECT source INTO v_src FROM public.credit_transactions WHERE id = NEW.transaction_id;
    IF v_src IS NOT NULL THEN
      NEW.credit_source := v_src;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ledger_entries_fill_credit_source ON public.ledger_entries;
CREATE TRIGGER trg_ledger_entries_fill_credit_source
BEFORE INSERT ON public.ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.ledger_entries_fill_credit_source();

