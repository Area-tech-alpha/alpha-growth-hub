alter table public.leads
  add column if not exists contract_installments integer;
