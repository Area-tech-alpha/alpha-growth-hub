-- =============================================================================
-- SCRIPT GROWTH HUB (v8.3 - PGMQ Type Fix)
-- Dialeto: PostgreSQL
-- Descrição: Versão com correção do tipo de dado na função worker para
--            resolver o erro 'pgmq.message does not exist'.
-- =============================================================================

-- ETAPA 1: HABILITAÇÃO DAS EXTENSÕES
-- Estas extensões devem ser habilitadas no painel do Supabase antes de rodar o script.
-- A execução aqui garante que elas existem. Elas não podem estar dentro de um bloco de transação.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS pgmq CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_cron;

BEGIN;

-- -----------------------------------------------------------------------------
-- LIMPEZA
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS public."Session", public."Account", public."VerificationToken", public.ledger_entries, public.credit_transactions, public.processed_webhooks, public.bids, public.auctions, public.leads, public.users, public.auth_users CASCADE;
DROP TYPE IF EXISTS public.account_type_enum, public.webhook_status_enum;

-- -----------------------------------------------------------------------------
-- TIPOS (ENUMs)
-- -----------------------------------------------------------------------------
CREATE TYPE public.account_type_enum AS ENUM ('USER_CREDITS', 'PLATFORM_REVENUE');
CREATE TYPE public.webhook_status_enum AS ENUM ('queued', 'processed', 'failed');

-- =============================================================================
-- TABELAS DE AUTENTICAÇÃO (Auth.js / NextAuth)
-- =============================================================================

CREATE TABLE public.auth_users (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    "emailVerified" TIMESTAMPTZ,
    image TEXT
);
COMMENT ON TABLE public.auth_users IS 'Tabela central de autenticação gerenciada pelo NextAuth.';

CREATE TABLE public."Account" (
    id TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at BIGINT,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    CONSTRAINT "provider_unique_id" UNIQUE (provider, "providerAccountId")
);

CREATE TABLE public."Session" (
    id TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "sessionToken" TEXT NOT NULL UNIQUE,
    "userId" TEXT NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
    expires TIMESTAMPTZ NOT NULL
);

CREATE TABLE public."VerificationToken" (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL,
    expires TIMESTAMPTZ NOT NULL,
    CONSTRAINT "token_identifier_unique" UNIQUE (identifier, token)
);

-- =============================================================================
-- TABELAS DE NEGÓCIO DA APLICAÇÃO
-- =============================================================================

CREATE TABLE public.users (
    id TEXT NOT NULL PRIMARY KEY REFERENCES public.auth_users(id) ON DELETE CASCADE,
    credit_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.users IS 'Armazena dados de negócio do usuário. Vinculada 1-para-1 com auth_users.';

CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    revenue DECIMAL(15, 2) NOT NULL,
    marketing_investment DECIMAL(12, 2) NOT NULL,
    location VARCHAR(255),
    segment VARCHAR(100),
    minimum_value DECIMAL(15, 2),
    status VARCHAR(50) NOT NULL DEFAULT 'cold' CHECK (status IN ( 'cold', 'hot', 'low_frozen', 'high_frozen', 'sold')),
    channel VARCHAR(100),
    owner_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
    minimum_bid DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ( 'open', 'closed_won', 'closed_expired')),
    winning_bid_id UUID UNIQUE,
    expired_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.auctions ADD CONSTRAINT fk_winning_bid FOREIGN KEY (winning_bid_id) REFERENCES public.bids(id) ON DELETE SET NULL;

-- =============================================================================
-- TABELAS DO SISTEMA DE LEDGER E WEBHOOKS
-- =============================================================================

CREATE TABLE public.processed_webhooks (
    event_key TEXT PRIMARY KEY,
    status public.webhook_status_enum NOT NULL DEFAULT 'queued',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.processed_webhooks IS 'Garante que cada webhook seja processado apenas uma vez.';

CREATE TABLE public.credit_transactions (
    id BIGSERIAL PRIMARY KEY,
    asaas_payment_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount_paid DECIMAL(10, 2) NOT NULL,
    credits_purchased DECIMAL(10, 2) NOT NULL,
    metadata JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT min_purchase_check CHECK (credits_purchased >= 130.00)
);
COMMENT ON TABLE public.credit_transactions IS 'Registro imutável de compras de crédito.';

CREATE TABLE public.ledger_entries (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL REFERENCES public.credit_transactions(id) ON DELETE RESTRICT,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    account_type public.account_type_enum NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.ledger_entries IS 'Fonte da verdade para todos os saldos (contabilidade de dupla entrada).';

-- =============================================================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================================================
CREATE INDEX ON public."Account" ("userId");
CREATE INDEX ON public."Session" ("userId");
CREATE INDEX ON public.leads (owner_id);
CREATE INDEX ON public.leads (status);
CREATE INDEX ON public.auctions (lead_id);
CREATE INDEX ON public.bids (auction_id);
CREATE INDEX ON public.bids (user_id);
CREATE INDEX ON public.credit_transactions (user_id);
CREATE INDEX ON public.ledger_entries (user_id);
CREATE INDEX ON public.ledger_entries (transaction_id);

-- =============================================================================
-- SEGURANÇA EM NÍVEL DE LINHA (ROW LEVEL SECURITY - RLS)
-- =============================================================================
ALTER TABLE public.auth_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver seus próprios dados de perfil.
CREATE POLICY "Allow user to read their own profile" ON public.users FOR SELECT USING (id = auth.uid()::text);
CREATE POLICY "Allow user to read their own auth info" ON public.auth_users FOR SELECT USING (id = auth.uid()::text);

-- Política: Usuários autenticados podem interagir com leilões e leads.
CREATE POLICY "Allow authenticated users to interact with leads" ON public.leads FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to interact with auctions" ON public.auctions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to place bids" ON public.bids FOR ALL USING (auth.role() = 'authenticated');

-- Política: Usuários podem ver apenas suas próprias transações e entradas de ledger.
CREATE POLICY "Allow user to read their own transactions" ON public.credit_transactions FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "Allow user to read their own ledger entries" ON public.ledger_entries FOR SELECT USING (user_id = auth.uid()::text);

-- =============================================================================
-- GATILHO (TRIGGER) PARA AUTOMAÇÃO DE LEILÕES
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_auction_expiration_based_on_lead_status()
RETURNS TRIGGER AS $$
DECLARE
  v_lead_status TEXT;
BEGIN
  SELECT status INTO v_lead_status FROM public.leads WHERE id = NEW.lead_id;
  IF v_lead_status = 'hot' THEN
    NEW.expired_at = NEW.created_at + interval '24 hours';
  ELSE
    NEW.expired_at = NEW.created_at + interval '8 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auction_insert
BEFORE INSERT ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.set_auction_expiration_based_on_lead_status();

-- =============================================================================
-- FUNÇÕES DE BANCO DE DADOS (ARQUITETURA ASSÍNCRONA)
-- =============================================================================

-- FUNÇÃO 1: Enfileiramento (Corrigida para evitar race condition).
CREATE OR REPLACE FUNCTION public.enqueue_credit_job(p_asaas_payment_id TEXT, p_payload JSONB)
RETURNS VOID AS $$
DECLARE
    v_inserted_id TEXT;
BEGIN
    INSERT INTO public.processed_webhooks (event_key, status)
    VALUES (p_asaas_payment_id, 'queued')
    ON CONFLICT (event_key) DO NOTHING
    RETURNING event_key INTO v_inserted_id;

    IF v_inserted_id IS NOT NULL THEN
        PERFORM pgmq.send('credit_jobs', p_payload);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, extensions;
COMMENT ON FUNCTION public.enqueue_credit_job IS 'Recebe um webhook, verifica a idempotência e enfileira o trabalho no pgmq.';

-- FUNÇÃO 2: Lógica de Negócio (Sem alterações, já estava segura).
CREATE OR REPLACE FUNCTION public.grant_credits_on_payment(p_asaas_payment_id TEXT, p_user_id TEXT, p_credits_purchased DECIMAL(10, 2), p_metadata JSONB)
RETURNS BIGINT AS $$
DECLARE
    v_transaction_id BIGINT;
    v_current_balance NUMERIC;
BEGIN
    SELECT credit_balance INTO v_current_balance FROM public.users WHERE id = p_user_id FOR UPDATE;
    INSERT INTO public.credit_transactions (asaas_payment_id, user_id, amount_paid, credits_purchased, metadata)
    VALUES (p_asaas_payment_id, p_user_id, p_credits_purchased, p_credits_purchased, p_metadata)
    ON CONFLICT (asaas_payment_id) DO NOTHING
    RETURNING id INTO v_transaction_id;

    IF v_transaction_id IS NOT NULL THEN
        INSERT INTO public.ledger_entries (transaction_id, user_id, account_type, amount)
        VALUES (v_transaction_id, p_user_id, 'USER_CREDITS', p_credits_purchased);
        INSERT INTO public.ledger_entries (transaction_id, user_id, account_type, amount)
        VALUES (v_transaction_id, p_user_id, 'PLATFORM_REVENUE', -p_credits_purchased);
        UPDATE public.users SET credit_balance = v_current_balance + p_credits_purchased WHERE id = p_user_id;
        UPDATE public.processed_webhooks SET status = 'processed' WHERE event_key = p_asaas_payment_id;
    END IF;
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, extensions;
COMMENT ON FUNCTION public.grant_credits_on_payment IS 'Executa a lógica de negócio atômica para conceder créditos.';

-- FUNÇÃO 3: O Worker (Com melhor tratamento de erros).
CREATE OR REPLACE FUNCTION public.process_credit_jobs_worker()
RETURNS JSONB AS $$
DECLARE
    -- CORREÇÃO: Alterado de 'pgmq.message' para 'RECORD' para resolver o erro de tipo.
    job RECORD;
BEGIN
    SELECT * INTO job FROM pgmq.read('credit_jobs', 60, 1);
    IF job IS NOT NULL THEN
        BEGIN
            PERFORM public.grant_credits_on_payment(
                p_asaas_payment_id := job.message->'payment'->>'id',
                p_user_id := job.message->>'userId',
                p_credits_purchased := (job.message->'payment'->>'value')::numeric,
                p_metadata := job.message
            );
            PERFORM pgmq.delete('credit_jobs', job.msg_id);
            RETURN jsonb_build_object('status', 'success', 'msg_id', job.msg_id);
        EXCEPTION
            WHEN others THEN
                -- Se ocorrer um erro, arquiva o job em vez de deixá-lo tentar para sempre.
                PERFORM pgmq.archive('credit_jobs', job.msg_id);
                RAISE WARNING 'Job % arquivado devido a erro: %', job.msg_id, SQLERRM;
                RETURN jsonb_build_object('status', 'failed', 'msg_id', job.msg_id, 'error', SQLERRM);
        END;
    END IF;
    RETURN jsonb_build_object('status', 'no_jobs_found');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, extensions;
COMMENT ON FUNCTION public.process_credit_jobs_worker IS 'Função worker que lê da fila pgmq, chama a lógica de negócio e arquiva jobs com erro.';

COMMIT;

-- =============================================================================
-- COMANDOS OPERACIONAIS (Executar uma vez no editor SQL do Supabase)
-- =============================================================================
/*

-- 1. Criar a fila de trabalhos (se ainda não existir)
SELECT pgmq.create('credit_jobs');

-- 2. Agendar o worker para rodar a cada 15 segundos
-- Para parar: SELECT cron.unschedule('process-credit-queue-worker');
SELECT cron.schedule(
    'process-credit-queue-worker',
    '15 * * * * *', -- Sintaxe cron para "a cada 15 segundos"
    $$SELECT public.process_credit_jobs_worker()$$
);
*/
-- Para verificar os jobs agendados: SELECT * FROM cron.job;



SELECT 'Banco de dados (v8.3 - PGMQ Type Fix) criado com sucesso!' AS status;
