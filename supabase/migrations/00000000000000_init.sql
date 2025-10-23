

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "auth";


ALTER SCHEMA "auth" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "storage";


ALTER SCHEMA "storage" OWNER TO "supabase_admin";


CREATE TYPE "auth"."aal_level" AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE "auth"."aal_level" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."code_challenge_method" AS ENUM (
    's256',
    'plain'
);


ALTER TYPE "auth"."code_challenge_method" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_status" AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE "auth"."factor_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_type" AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE "auth"."factor_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_authorization_status" AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE "auth"."oauth_authorization_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_client_type" AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE "auth"."oauth_client_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_registration_type" AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE "auth"."oauth_registration_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_response_type" AS ENUM (
    'code'
);


ALTER TYPE "auth"."oauth_response_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."one_time_token_type" AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE "auth"."one_time_token_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "public"."account_type_enum" AS ENUM (
    'USER_CREDITS',
    'PLATFORM_REVENUE'
);


ALTER TYPE "public"."account_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."credit_hold_status_enum" AS ENUM (
    'active',
    'released',
    'consumed'
);


ALTER TYPE "public"."credit_hold_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."credit_source_enum" AS ENUM (
    'monetary',
    'reward',
    'adjustment'
);


ALTER TYPE "public"."credit_source_enum" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'user',
    'admin'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE TYPE "public"."webhook_status_enum" AS ENUM (
    'queued',
    'processed',
    'failed',
    'ignored'
);


ALTER TYPE "public"."webhook_status_enum" OWNER TO "postgres";


CREATE TYPE "storage"."buckettype" AS ENUM (
    'STANDARD',
    'ANALYTICS'
);


ALTER TYPE "storage"."buckettype" OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "auth"."email"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION "auth"."email"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."email"() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';



CREATE OR REPLACE FUNCTION "auth"."jwt"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION "auth"."jwt"() OWNER TO "supabase_auth_admin";


CREATE OR REPLACE FUNCTION "auth"."role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION "auth"."role"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."role"() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';



CREATE OR REPLACE FUNCTION "auth"."uid"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION "auth"."uid"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."uid"() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';



CREATE OR REPLACE FUNCTION "public"."after_lead_change_create_auction"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$DECLARE
  v_expiration_time TIMESTAMPTZ;
  v_category CHAR(1);
  v_minimum_bid NUMERIC;
  v_current_time TIMESTAMPTZ;
  v_time_in_brasilia TIME;
BEGIN
  -- Impede a criação de um leilão se o lead for atualizado para um estado final
  IF TG_OP = 'UPDATE' AND NEW.status IN ('sold', 'expired', 'low_frozen', 'high_frozen') THEN
    RETURN NEW;
  END IF;

  -- Determina a categoria
  IF NEW.revenue = 'Até 20 mil' THEN
    v_category := 'c';
  ELSIF NEW.revenue IN ('De 20 mil até 40 mil', 'De 40 mil até 60 mil') THEN
    v_category := 'b';
  ELSE -- Abrange todas as outras faixas de 'a' e o ELSE anterior
    v_category := 'a';
  END IF;

  -- 1. DEFINE O HORÁRIO ATUAL E A DURAÇÃO DO LEILÃO BASEADO NO FUSO DE BRASÍLIA
  v_current_time := now(); -- Pega o timestamp atual (em UTC)
  
  -- Extrai apenas a HORA do dia, convertida para o fuso de Brasília, para a verificação
  v_time_in_brasilia := (v_current_time AT TIME ZONE 'America/Sao_Paulo')::TIME;

  -- Se a hora de criação for entre meia-noite e 6:39:59, a regra é a mesma para todos
  IF v_time_in_brasilia >= '00:00:00' AND v_time_in_brasilia < '06:40:00' THEN 
    -- Calcula o início do dia de hoje no fuso de Brasília e define a expiração para as 7h da manhã
    v_expiration_time := (date_trunc('day', v_current_time AT TIME ZONE 'America/Sao_Paulo') + interval '7 hours') AT TIME ZONE 'America/Sao_Paulo';
  ELSE 
    -- Para 06:40:00 em diante, a duração depende do status do lead
    IF NEW.status = 'hot' THEN
      -- Duração de 10 minutos para leads 'hot'
      v_expiration_time := v_current_time + interval '10 minutes';
    ELSE
      -- Duração de 5 minutos para os demais (neste caso, 'cold')
      v_expiration_time := v_current_time + interval '5 minutes';
    END IF;
  END IF;

  -- LÓGICA DE CRIAÇÃO DE LEILÃO UNIFICADA
  -- Cria auction para lead 'hot' (INSERT ou UPDATE)
  IF NEW.status = 'hot' AND (
      (TG_OP = 'INSERT') OR 
      (TG_OP = 'UPDATE' AND OLD.status != 'hot')
     ) THEN
    
    v_minimum_bid := NEW.contract_value * 0.58;

    INSERT INTO public.auctions (lead_id, minimum_bid, expired_at, created_at)
    VALUES (NEW.id, v_minimum_bid, v_expiration_time, v_current_time);

  -- Cria auction para lead 'cold' (apenas INSERT)
  ELSIF TG_OP = 'INSERT' AND NEW.status = 'cold' THEN
    v_minimum_bid := 250;

    INSERT INTO public.auctions (lead_id, minimum_bid, expired_at, created_at)
    VALUES (NEW.id, v_minimum_bid, v_expiration_time, v_current_time);
  END IF;

  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."after_lead_change_create_auction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."before_lead_change_set_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$DECLARE
  v_category CHAR(1);
BEGIN
  -- Apenas processa INSERT de novos leads
  IF TG_OP = 'INSERT' THEN
    -- Determina a categoria (lógica original mantida)
    IF NEW.revenue = 'Até 20 mil' THEN
      v_category := 'c';
    ELSIF NEW.revenue IN ('De 20 mil até 40 mil', 'De 40 mil até 60 mil') THEN
      v_category := 'b';
    ELSIF NEW.revenue IN (
      'De 60 mil até 80 mil',
      'De 80 mil até 100 mil',
      'De 100 mil até 150 mil',
      'De 150 mil até 250 mil',
      'De 250 mil até 400 mil',
      'De 400 mil até 600 mil',
      'De 600 mil até 1 milhão',
      'Mais de 1 milhão'
    ) THEN
      v_category := 'a';
    ELSE
      v_category := 'c';
    END IF;

    -- LÓGICA DO STATUS ALTERADA
    -- Se qualquer um dos campos de contrato/documento estiver preenchido, o status é 'hot'
    IF NEW.contract_url IS NOT NULL OR
       NEW.contract_value IS NOT NULL OR
       NEW.document_url IS NOT NULL THEN
      NEW.status := 'hot';
    -- Caso contrário, se todos forem nulos, o status é 'cold'
    ELSE
      NEW.status := 'cold';
    END IF;
    
  END IF;

  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."before_lead_change_set_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."credit_transactions_fill_source"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."credit_transactions_fill_source"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_credit_job"("p_asaas_payment_id" "text", "p_payload" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
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
$$;


ALTER FUNCTION "public"."enqueue_credit_job"("p_asaas_payment_id" "text", "p_payload" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enqueue_credit_job"("p_asaas_payment_id" "text", "p_payload" "jsonb") IS 'Recebe um webhook, verifica a idempotência e enfileira o trabalho no pgmq.';



CREATE OR REPLACE FUNCTION "public"."get_user_active_credit_holds"("p_user_id" "text") RETURNS numeric
    LANGUAGE "sql"
    AS $$
  select coalesce(sum(ch.amount),0)
  from public.credit_holds ch
  join public.users u on u.id = ch.user_id
  where u.email = auth.email() and ch.status = 'active';
$$;


ALTER FUNCTION "public"."get_user_active_credit_holds"("p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_credit_balance"("p_user_id" "text" DEFAULT NULL::"text") RETURNS numeric
    LANGUAGE "sql"
    AS $$
  select coalesce(credit_balance::numeric, 0)
  from public.users
  where email = auth.email()
  limit 1;
$$;


ALTER FUNCTION "public"."get_user_credit_balance"("p_user_id" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."credit_transactions" (
    "id" bigint NOT NULL,
    "asaas_payment_id" "text",
    "user_id" "text" NOT NULL,
    "amount_paid" numeric(10,2) NOT NULL,
    "credits_purchased" numeric(10,2) NOT NULL,
    "metadata" "jsonb",
    "status" character varying(50) DEFAULT 'completed'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "infinitepay_payment_id" "text",
    "source" "public"."credit_source_enum" DEFAULT 'monetary'::"public"."credit_source_enum" NOT NULL,
    CONSTRAINT "credit_transactions_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('pending'::character varying)::"text", ('completed'::character varying)::"text", ('failed'::character varying)::"text"]))),
    CONSTRAINT "min_purchase_check" CHECK (((("source" = 'monetary'::"public"."credit_source_enum") AND ("amount_paid" > 0.00) AND ("credits_purchased" > 0.00)) OR (("source" = 'reward'::"public"."credit_source_enum") AND ("amount_paid" = 0.00) AND ("credits_purchased" > 0.00)) OR (("source" = 'adjustment'::"public"."credit_source_enum") AND ("credits_purchased" <> 0.00) AND ("amount_paid" >= 0.00))))
);


ALTER TABLE "public"."credit_transactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."credit_transactions" IS 'Registro imutável de compras de crédito.';



CREATE OR REPLACE FUNCTION "public"."get_user_credit_transactions"("p_user_id" "text", "p_limit" integer DEFAULT 5) RETURNS SETOF "public"."credit_transactions"
    LANGUAGE "sql"
    AS $$
  select ct.*
  from public.credit_transactions ct
  join public.users u on u.id = ct.user_id
  where u.email = auth.email()
  order by ct.created_at desc
  limit greatest(1, least(coalesce(p_limit,5), 100));
$$;


ALTER FUNCTION "public"."get_user_credit_transactions"("p_user_id" "text", "p_limit" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_name" character varying(255) NOT NULL,
    "contact_name" character varying(255) NOT NULL,
    "phone" character varying(50) NOT NULL,
    "email" character varying(255) NOT NULL,
    "revenue" "text" NOT NULL,
    "marketing_investment" "text" NOT NULL,
    "segment" character varying(100),
    "minimum_value" numeric(15,2),
    "status" character varying(50) DEFAULT NULL::character varying,
    "channel" character varying(100),
    "owner_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "cnpj" character varying(32),
    "city" character varying(255),
    "state" character varying(100),
    "document_url" character varying(2048),
    "contract_url" character varying(2048),
    "contract_value" double precision,
    "call_url" "text",
    "contract_time" "text",
    "briefing_url" "text",
    CONSTRAINT "leads_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('cold'::character varying)::"text", ('hot'::character varying)::"text", ('low_frozen'::character varying)::"text", ('high_frozen'::character varying)::"text", ('sold'::character varying)::"text"])))
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_leads"("p_user_id" "text", "p_limit" integer DEFAULT 100) RETURNS SETOF "public"."leads"
    LANGUAGE "sql"
    AS $$
  select l.*
  from public.leads l
  join public.users u on u.id = l.owner_id
  where u.email = auth.email()
  order by l.updated_at desc
  limit greatest(1, least(coalesce(p_limit,100), 500));
$$;


ALTER FUNCTION "public"."get_user_leads"("p_user_id" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_credits_on_payment"("p_asaas_payment_id" "text", "p_user_id" "text", "p_credits_purchased" numeric, "p_metadata" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'extensions'
    AS $$
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
$$;


ALTER FUNCTION "public"."grant_credits_on_payment"("p_asaas_payment_id" "text", "p_user_id" "text", "p_credits_purchased" numeric, "p_metadata" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."grant_credits_on_payment"("p_asaas_payment_id" "text", "p_user_id" "text", "p_credits_purchased" numeric, "p_metadata" "jsonb") IS 'Executa a lógica de negócio atômica para conceder créditos.';



CREATE OR REPLACE FUNCTION "public"."grant_credits_on_payment_generic"("p_provider" "text", "p_payment_id" "text", "p_user_id" "text", "p_credits_purchased" numeric, "p_metadata" "jsonb") RETURNS bigint
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_transaction_id BIGINT;
    v_current_balance NUMERIC;
BEGIN
    SELECT credit_balance INTO v_current_balance
    FROM public.users WHERE id = p_user_id FOR UPDATE;

    IF upper(p_provider) = 'INFINITEPAY' THEN
        INSERT INTO public.credit_transactions (infinitepay_payment_id, user_id, amount_paid, credits_purchased, metadata)
        VALUES (p_payment_id, p_user_id, p_credits_purchased, p_credits_purchased, p_metadata)
        ON CONFLICT (infinitepay_payment_id) DO NOTHING
        RETURNING id INTO v_transaction_id;
    ELSE
        INSERT INTO public.credit_transactions (asaas_payment_id, user_id, amount_paid, credits_purchased, metadata)
        VALUES (p_payment_id, p_user_id, p_credits_purchased, p_credits_purchased, p_metadata)
        ON CONFLICT (asaas_payment_id) DO NOTHING
        RETURNING id INTO v_transaction_id;
    END IF;

    IF v_transaction_id IS NOT NULL THEN
        INSERT INTO public.ledger_entries (transaction_id, user_id, account_type, amount)
        VALUES (v_transaction_id, p_user_id, 'USER_CREDITS', p_credits_purchased);

        INSERT INTO public.ledger_entries (transaction_id, user_id, account_type, amount)
        VALUES (v_transaction_id, p_user_id, 'PLATFORM_REVENUE', -p_credits_purchased);

        UPDATE public.users
        SET credit_balance = v_current_balance + p_credits_purchased
        WHERE id = p_user_id;
    END IF;

    RETURN v_transaction_id;
END;
$$;


ALTER FUNCTION "public"."grant_credits_on_payment_generic"("p_provider" "text", "p_payment_id" "text", "p_user_id" "text", "p_credits_purchased" numeric, "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ledger_entries_fill_credit_source"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."ledger_entries_fill_credit_source"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_expired_bids"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if exists (
    select 1 from public.auctions a
    where a.id = new.auction_id
      and (a.status <> 'open' or a.expired_at <= now())
  ) then
    raise exception 'Bids are not allowed after expiration or when auction is not open';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_expired_bids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_credit_jobs_worker"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    job RECORD;
    v_provider text;
    v_payment_id text;
    v_user_id text;
    v_credits numeric;
    v_source_text text;
BEGIN
    SELECT * INTO job FROM pgmq.read('credit_jobs', 60, 1);
    IF job IS NOT NULL THEN
        BEGIN
            v_provider   := COALESCE(job.message->>'provider', 'ASAAS');
            v_payment_id := job.message->'payment'->>'id';
            v_user_id    := job.message->>'userId';
            v_credits    := (job.message->'payment'->>'value')::numeric;
            v_source_text := COALESCE(job.message->>'source', 'monetary');

            -- Keep current grant function; ensure it persists source via triggers or function update
            PERFORM public.grant_credits_on_payment_generic(
                p_provider          := v_provider,
                p_payment_id        := v_payment_id,
                p_user_id           := v_user_id,
                p_credits_purchased := v_credits,
                p_metadata          := job.message
            );

            PERFORM pgmq.delete('credit_jobs', job.msg_id);
            RETURN jsonb_build_object('status', 'success', 'msg_id', job.msg_id);
        EXCEPTION WHEN others THEN
            PERFORM pgmq.archive('credit_jobs', job.msg_id);
            RAISE WARNING 'Job % arquivado devido a erro: %', job.msg_id, SQLERRM;
            RETURN jsonb_build_object('status', 'failed', 'msg_id', job.msg_id, 'error', SQLERRM);
        END;
    END IF;

    RETURN jsonb_build_object('status', 'no_jobs_found');
END;
$$;


ALTER FUNCTION "public"."process_credit_jobs_worker"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."process_credit_jobs_worker"() IS 'Função worker que lê da fila pgmq, chama a lógica de negócio e arquiva jobs com erro.';



CREATE OR REPLACE FUNCTION "public"."trigger_auction_on_lead_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$DECLARE
  v_lead_count INTEGER;
  v_expiration_time TIMESTAMPTZ;
  v_category CHAR(1);
  v_minimum_bid NUMERIC;
BEGIN
  -- Impede a criação de um leilão se o lead for atualizado para um estado final.
  IF TG_OP = 'UPDATE' AND NEW.status IN ('sold', 'expired', 'low_frozen', 'high_frozen') THEN
    RETURN NEW;
  END IF;

  -- Determina a categoria com base no valor textual de revenue.
  IF NEW.revenue = 'Até 20 mil' THEN
    v_category := 'c';
  ELSIF NEW.revenue IN ('De 20 mil até 40 mil', 'De 40 mil até 60 mil') THEN
    v_category := 'b';
  ELSIF NEW.revenue IN (
    'De 60 mil até 80 mil',
    'De 80 mil até 100 mil',
    'De 100 mil até 150 mil',
    'De 150 mil até 250 mil',
    'De 250 mil até 400 mil',
    'De 400 mil até 600 mil',
    'De 600 mil até 1 milhão',
    'Mais de 1 milhão'
  ) THEN
    v_category := 'a';
  ELSE
    v_category := 'c';
  END IF;

  -- Lógica para criar o leilão
  IF TG_OP = 'UPDATE' AND NEW.status = 'hot' THEN
    IF v_category = 'a' THEN
      v_minimum_bid := 800;
    ELSIF v_category = 'b' THEN
      v_minimum_bid := 640;
    ELSE -- Categoria C
      v_minimum_bid := 240;
    END IF;

    v_expiration_time := now() + interval '5 minutes';

    INSERT INTO public.auctions (lead_id, minimum_bid, expired_at, created_at)
    VALUES (NEW.id, v_minimum_bid, v_expiration_time, now());

  ELSIF TG_OP = 'INSERT' THEN
    -- Lógica para leads "cold"
    IF v_category = 'a' THEN
      SELECT nextval('public.lead_counter_a') INTO v_lead_count;
      v_minimum_bid := 500;
    ELSIF v_category = 'b' THEN
      SELECT nextval('public.lead_counter_b') INTO v_lead_count;
      v_minimum_bid := 400;
    ELSE -- Categoria C
      SELECT nextval('public.lead_counter_c') INTO v_lead_count;
      v_minimum_bid := 150;
    END IF;

    IF v_lead_count = 15 THEN
      NEW.status := 'cold';  -- AGORA VAI FUNCIONAR com BEFORE trigger
      v_expiration_time := now() + interval '5 minutes';

      INSERT INTO public.auctions (lead_id, minimum_bid, expired_at, created_at)
      VALUES (NEW.id, v_minimum_bid, v_expiration_time, now());
      
      -- Opcional: resetar o contador
      IF v_category = 'a' THEN
        PERFORM setval('public.lead_counter_a', 0, false);
      ELSIF v_category = 'b' THEN
        PERFORM setval('public.lead_counter_b', 0, false);
      ELSE
        PERFORM setval('public.lead_counter_c', 0, false);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."trigger_auction_on_lead_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "storage"."add_prefixes"("_bucket_id" "text", "_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    prefixes text[];
BEGIN
    prefixes := "storage"."get_prefixes"("_name");

    IF array_length(prefixes, 1) > 0 THEN
        INSERT INTO storage.prefixes (name, bucket_id)
        SELECT UNNEST(prefixes) as name, "_bucket_id" ON CONFLICT DO NOTHING;
    END IF;
END;
$$;


ALTER FUNCTION "storage"."add_prefixes"("_bucket_id" "text", "_name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


ALTER FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."delete_leaf_prefixes"("bucket_ids" "text"[], "names" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_rows_deleted integer;
BEGIN
    LOOP
        WITH candidates AS (
            SELECT DISTINCT
                t.bucket_id,
                unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        ),
        uniq AS (
             SELECT
                 bucket_id,
                 name,
                 storage.get_level(name) AS level
             FROM candidates
             WHERE name <> ''
             GROUP BY bucket_id, name
        ),
        leaf AS (
             SELECT
                 p.bucket_id,
                 p.name,
                 p.level
             FROM storage.prefixes AS p
                  JOIN uniq AS u
                       ON u.bucket_id = p.bucket_id
                           AND u.name = p.name
                           AND u.level = p.level
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM storage.objects AS o
                 WHERE o.bucket_id = p.bucket_id
                   AND o.level = p.level + 1
                   AND o.name COLLATE "C" LIKE p.name || '/%'
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM storage.prefixes AS c
                 WHERE c.bucket_id = p.bucket_id
                   AND c.level = p.level + 1
                   AND c.name COLLATE "C" LIKE p.name || '/%'
             )
        )
        DELETE
        FROM storage.prefixes AS p
            USING leaf AS l
        WHERE p.bucket_id = l.bucket_id
          AND p.name = l.name
          AND p.level = l.level;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$$;


ALTER FUNCTION "storage"."delete_leaf_prefixes"("bucket_ids" "text"[], "names" "text"[]) OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."delete_prefix"("_bucket_id" "text", "_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Check if we can delete the prefix
    IF EXISTS(
        SELECT FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name") + 1
          AND "prefixes"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    )
    OR EXISTS(
        SELECT FROM "storage"."objects"
        WHERE "objects"."bucket_id" = "_bucket_id"
          AND "storage"."get_level"("objects"."name") = "storage"."get_level"("_name") + 1
          AND "objects"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    ) THEN
    -- There are sub-objects, skip deletion
    RETURN false;
    ELSE
        DELETE FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name")
          AND "prefixes"."name" = "_name";
        RETURN true;
    END IF;
END;
$$;


ALTER FUNCTION "storage"."delete_prefix"("_bucket_id" "text", "_name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."delete_prefix_hierarchy_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    prefix text;
BEGIN
    prefix := "storage"."get_prefix"(OLD."name");

    IF coalesce(prefix, '') != '' THEN
        PERFORM "storage"."delete_prefix"(OLD."bucket_id", prefix);
    END IF;

    RETURN OLD;
END;
$$;


ALTER FUNCTION "storage"."delete_prefix_hierarchy_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."enforce_bucket_name_length"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


ALTER FUNCTION "storage"."enforce_bucket_name_length"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."extension"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION "storage"."extension"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."filename"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


ALTER FUNCTION "storage"."filename"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."foldername"("name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


ALTER FUNCTION "storage"."foldername"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_level"("name" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


ALTER FUNCTION "storage"."get_level"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_prefix"("name" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


ALTER FUNCTION "storage"."get_prefix"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_prefixes"("name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


ALTER FUNCTION "storage"."get_prefixes"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_size_by_bucket"() RETURNS TABLE("size" bigint, "bucket_id" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION "storage"."get_size_by_bucket"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "next_key_token" "text" DEFAULT ''::"text", "next_upload_token" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "id" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


ALTER FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "next_key_token" "text", "next_upload_token" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_objects_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "start_after" "text" DEFAULT ''::"text", "next_token" "text" DEFAULT ''::"text") RETURNS TABLE("name" "text", "id" "uuid", "metadata" "jsonb", "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
END;
$_$;


ALTER FUNCTION "storage"."list_objects_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "start_after" "text", "next_token" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."lock_top_prefixes"("bucket_ids" "text"[], "names" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_bucket text;
    v_top text;
BEGIN
    FOR v_bucket, v_top IN
        SELECT DISTINCT t.bucket_id,
            split_part(t.name, '/', 1) AS top
        FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        WHERE t.name <> ''
        ORDER BY 1, 2
        LOOP
            PERFORM pg_advisory_xact_lock(hashtextextended(v_bucket || '/' || v_top, 0));
        END LOOP;
END;
$$;


ALTER FUNCTION "storage"."lock_top_prefixes"("bucket_ids" "text"[], "names" "text"[]) OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_delete_cleanup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."objects_delete_cleanup"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_insert_prefix_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    NEW.level := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


ALTER FUNCTION "storage"."objects_insert_prefix_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_update_cleanup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    -- NEW - OLD (destinations to create prefixes for)
    v_add_bucket_ids text[];
    v_add_names      text[];

    -- OLD - NEW (sources to prune)
    v_src_bucket_ids text[];
    v_src_names      text[];
BEGIN
    IF TG_OP <> 'UPDATE' THEN
        RETURN NULL;
    END IF;

    -- 1) Compute NEW−OLD (added paths) and OLD−NEW (moved-away paths)
    WITH added AS (
        SELECT n.bucket_id, n.name
        FROM new_rows n
        WHERE n.name <> '' AND position('/' in n.name) > 0
        EXCEPT
        SELECT o.bucket_id, o.name FROM old_rows o WHERE o.name <> ''
    ),
    moved AS (
         SELECT o.bucket_id, o.name
         FROM old_rows o
         WHERE o.name <> ''
         EXCEPT
         SELECT n.bucket_id, n.name FROM new_rows n WHERE n.name <> ''
    )
    SELECT
        -- arrays for ADDED (dest) in stable order
        COALESCE( (SELECT array_agg(a.bucket_id ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        COALESCE( (SELECT array_agg(a.name      ORDER BY a.bucket_id, a.name) FROM added a), '{}' ),
        -- arrays for MOVED (src) in stable order
        COALESCE( (SELECT array_agg(m.bucket_id ORDER BY m.bucket_id, m.name) FROM moved m), '{}' ),
        COALESCE( (SELECT array_agg(m.name      ORDER BY m.bucket_id, m.name) FROM moved m), '{}' )
    INTO v_add_bucket_ids, v_add_names, v_src_bucket_ids, v_src_names;

    -- Nothing to do?
    IF (array_length(v_add_bucket_ids, 1) IS NULL) AND (array_length(v_src_bucket_ids, 1) IS NULL) THEN
        RETURN NULL;
    END IF;

    -- 2) Take per-(bucket, top) locks: ALL prefixes in consistent global order to prevent deadlocks
    DECLARE
        v_all_bucket_ids text[];
        v_all_names text[];
    BEGIN
        -- Combine source and destination arrays for consistent lock ordering
        v_all_bucket_ids := COALESCE(v_src_bucket_ids, '{}') || COALESCE(v_add_bucket_ids, '{}');
        v_all_names := COALESCE(v_src_names, '{}') || COALESCE(v_add_names, '{}');

        -- Single lock call ensures consistent global ordering across all transactions
        IF array_length(v_all_bucket_ids, 1) IS NOT NULL THEN
            PERFORM storage.lock_top_prefixes(v_all_bucket_ids, v_all_names);
        END IF;
    END;

    -- 3) Create destination prefixes (NEW−OLD) BEFORE pruning sources
    IF array_length(v_add_bucket_ids, 1) IS NOT NULL THEN
        WITH candidates AS (
            SELECT DISTINCT t.bucket_id, unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(v_add_bucket_ids, v_add_names) AS t(bucket_id, name)
            WHERE name <> ''
        )
        INSERT INTO storage.prefixes (bucket_id, name)
        SELECT c.bucket_id, c.name
        FROM candidates c
        ON CONFLICT DO NOTHING;
    END IF;

    -- 4) Prune source prefixes bottom-up for OLD−NEW
    IF array_length(v_src_bucket_ids, 1) IS NOT NULL THEN
        -- re-entrancy guard so DELETE on prefixes won't recurse
        IF current_setting('storage.gc.prefixes', true) <> '1' THEN
            PERFORM set_config('storage.gc.prefixes', '1', true);
        END IF;

        PERFORM storage.delete_leaf_prefixes(v_src_bucket_ids, v_src_names);
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."objects_update_cleanup"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_update_level_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Set the new level
        NEW."level" := "storage"."get_level"(NEW."name");
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "storage"."objects_update_level_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."objects_update_prefix_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    old_prefixes TEXT[];
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Retrieve old prefixes
        old_prefixes := "storage"."get_prefixes"(OLD."name");

        -- Remove old prefixes that are only used by this object
        WITH all_prefixes as (
            SELECT unnest(old_prefixes) as prefix
        ),
        can_delete_prefixes as (
             SELECT prefix
             FROM all_prefixes
             WHERE NOT EXISTS (
                 SELECT 1 FROM "storage"."objects"
                 WHERE "bucket_id" = OLD."bucket_id"
                   AND "name" <> OLD."name"
                   AND "name" LIKE (prefix || '%')
             )
         )
        DELETE FROM "storage"."prefixes" WHERE name IN (SELECT prefix FROM can_delete_prefixes);

        -- Add new prefixes
        PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    END IF;
    -- Set the new level
    NEW."level" := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


ALTER FUNCTION "storage"."objects_update_prefix_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."operation"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION "storage"."operation"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."prefixes_delete_cleanup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_bucket_ids text[];
    v_names      text[];
BEGIN
    IF current_setting('storage.gc.prefixes', true) = '1' THEN
        RETURN NULL;
    END IF;

    PERFORM set_config('storage.gc.prefixes', '1', true);

    SELECT COALESCE(array_agg(d.bucket_id), '{}'),
           COALESCE(array_agg(d.name), '{}')
    INTO v_bucket_ids, v_names
    FROM deleted AS d
    WHERE d.name <> '';

    PERFORM storage.lock_top_prefixes(v_bucket_ids, v_names);
    PERFORM storage.delete_leaf_prefixes(v_bucket_ids, v_names);

    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."prefixes_delete_cleanup"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."prefixes_insert_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    RETURN NEW;
END;
$$;


ALTER FUNCTION "storage"."prefixes_insert_trigger"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
declare
    can_bypass_rls BOOLEAN;
begin
    SELECT rolbypassrls
    INTO can_bypass_rls
    FROM pg_roles
    WHERE rolname = coalesce(nullif(current_setting('role', true), 'none'), current_user);

    IF can_bypass_rls THEN
        RETURN QUERY SELECT * FROM storage.search_v1_optimised(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    ELSE
        RETURN QUERY SELECT * FROM storage.search_legacy_v1(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    END IF;
end;
$$;


ALTER FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_legacy_v1"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


ALTER FUNCTION "storage"."search_legacy_v1"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_v1_optimised"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select (string_to_array(name, ''/''))[level] as name
           from storage.prefixes
             where lower(prefixes.name) like lower($2 || $3) || ''%''
               and bucket_id = $4
               and level = $1
           order by name ' || v_sort_order || '
     )
     (select name,
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[level] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where lower(objects.name) like lower($2 || $3) || ''%''
       and bucket_id = $4
       and level = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


ALTER FUNCTION "storage"."search_v1_optimised"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "start_after" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text", "sort_column" "text" DEFAULT 'name'::"text", "sort_column_after" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    sort_col text;
    sort_ord text;
    cursor_op text;
    cursor_expr text;
    sort_expr text;
BEGIN
    -- Validate sort_order
    sort_ord := lower(sort_order);
    IF sort_ord NOT IN ('asc', 'desc') THEN
        sort_ord := 'asc';
    END IF;

    -- Determine cursor comparison operator
    IF sort_ord = 'asc' THEN
        cursor_op := '>';
    ELSE
        cursor_op := '<';
    END IF;
    
    sort_col := lower(sort_column);
    -- Validate sort column  
    IF sort_col IN ('updated_at', 'created_at') THEN
        cursor_expr := format(
            '($5 = '''' OR ROW(date_trunc(''milliseconds'', %I), name COLLATE "C") %s ROW(COALESCE(NULLIF($6, '''')::timestamptz, ''epoch''::timestamptz), $5))',
            sort_col, cursor_op
        );
        sort_expr := format(
            'COALESCE(date_trunc(''milliseconds'', %I), ''epoch''::timestamptz) %s, name COLLATE "C" %s',
            sort_col, sort_ord, sort_ord
        );
    ELSE
        cursor_expr := format('($5 = '''' OR name COLLATE "C" %s $5)', cursor_op);
        sort_expr := format('name COLLATE "C" %s', sort_ord);
    END IF;

    RETURN QUERY EXECUTE format(
        $sql$
        SELECT * FROM (
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    NULL::uuid AS id,
                    updated_at,
                    created_at,
                    NULL::timestamptz AS last_accessed_at,
                    NULL::jsonb AS metadata
                FROM storage.prefixes
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
            UNION ALL
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name,
                    id,
                    updated_at,
                    created_at,
                    last_accessed_at,
                    metadata
                FROM storage.objects
                WHERE name COLLATE "C" LIKE $1 || '%%'
                    AND bucket_id = $2
                    AND level = $4
                    AND %s
                ORDER BY %s
                LIMIT $3
            )
        ) obj
        ORDER BY %s
        LIMIT $3
        $sql$,
        cursor_expr,    -- prefixes WHERE
        sort_expr,      -- prefixes ORDER BY
        cursor_expr,    -- objects WHERE
        sort_expr,      -- objects ORDER BY
        sort_expr       -- final ORDER BY
    )
    USING prefix, bucket_name, limits, levels, start_after, sort_column_after;
END;
$_$;


ALTER FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer, "levels" integer, "start_after" "text", "sort_order" "text", "sort_column" "text", "sort_column_after" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION "storage"."update_updated_at_column"() OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "auth"."audit_log_entries" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "payload" json,
    "created_at" timestamp with time zone,
    "ip_address" character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE "auth"."audit_log_entries" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."audit_log_entries" IS 'Auth: Audit trail for user actions.';



CREATE TABLE IF NOT EXISTS "auth"."flow_state" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid",
    "auth_code" "text" NOT NULL,
    "code_challenge_method" "auth"."code_challenge_method" NOT NULL,
    "code_challenge" "text" NOT NULL,
    "provider_type" "text" NOT NULL,
    "provider_access_token" "text",
    "provider_refresh_token" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "authentication_method" "text" NOT NULL,
    "auth_code_issued_at" timestamp with time zone
);


ALTER TABLE "auth"."flow_state" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."flow_state" IS 'stores metadata for pkce logins';



CREATE TABLE IF NOT EXISTS "auth"."identities" (
    "provider_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "identity_data" "jsonb" NOT NULL,
    "provider" "text" NOT NULL,
    "last_sign_in_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "email" "text" GENERATED ALWAYS AS ("lower"(("identity_data" ->> 'email'::"text"))) STORED,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "auth"."identities" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."identities" IS 'Auth: Stores identities associated to a user.';



COMMENT ON COLUMN "auth"."identities"."email" IS 'Auth: Email is a generated column that references the optional email property in the identity_data';



CREATE TABLE IF NOT EXISTS "auth"."instances" (
    "id" "uuid" NOT NULL,
    "uuid" "uuid",
    "raw_base_config" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "auth"."instances" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."instances" IS 'Auth: Manages users across multiple sites.';



CREATE TABLE IF NOT EXISTS "auth"."mfa_amr_claims" (
    "session_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "authentication_method" "text" NOT NULL,
    "id" "uuid" NOT NULL
);


ALTER TABLE "auth"."mfa_amr_claims" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_amr_claims" IS 'auth: stores authenticator method reference claims for multi factor authentication';



CREATE TABLE IF NOT EXISTS "auth"."mfa_challenges" (
    "id" "uuid" NOT NULL,
    "factor_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "verified_at" timestamp with time zone,
    "ip_address" "inet" NOT NULL,
    "otp_code" "text",
    "web_authn_session_data" "jsonb"
);


ALTER TABLE "auth"."mfa_challenges" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_challenges" IS 'auth: stores metadata about challenge requests made';



CREATE TABLE IF NOT EXISTS "auth"."mfa_factors" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "friendly_name" "text",
    "factor_type" "auth"."factor_type" NOT NULL,
    "status" "auth"."factor_status" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "secret" "text",
    "phone" "text",
    "last_challenged_at" timestamp with time zone,
    "web_authn_credential" "jsonb",
    "web_authn_aaguid" "uuid"
);


ALTER TABLE "auth"."mfa_factors" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_factors" IS 'auth: stores metadata about factors';



CREATE TABLE IF NOT EXISTS "auth"."oauth_authorizations" (
    "id" "uuid" NOT NULL,
    "authorization_id" "text" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "redirect_uri" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "state" "text",
    "resource" "text",
    "code_challenge" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "response_type" "auth"."oauth_response_type" DEFAULT 'code'::"auth"."oauth_response_type" NOT NULL,
    "status" "auth"."oauth_authorization_status" DEFAULT 'pending'::"auth"."oauth_authorization_status" NOT NULL,
    "authorization_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:03:00'::interval) NOT NULL,
    "approved_at" timestamp with time zone,
    CONSTRAINT "oauth_authorizations_authorization_code_length" CHECK (("char_length"("authorization_code") <= 255)),
    CONSTRAINT "oauth_authorizations_code_challenge_length" CHECK (("char_length"("code_challenge") <= 128)),
    CONSTRAINT "oauth_authorizations_expires_at_future" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "oauth_authorizations_redirect_uri_length" CHECK (("char_length"("redirect_uri") <= 2048)),
    CONSTRAINT "oauth_authorizations_resource_length" CHECK (("char_length"("resource") <= 2048)),
    CONSTRAINT "oauth_authorizations_scope_length" CHECK (("char_length"("scope") <= 4096)),
    CONSTRAINT "oauth_authorizations_state_length" CHECK (("char_length"("state") <= 4096))
);


ALTER TABLE "auth"."oauth_authorizations" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_clients" (
    "id" "uuid" NOT NULL,
    "client_secret_hash" "text",
    "registration_type" "auth"."oauth_registration_type" NOT NULL,
    "redirect_uris" "text" NOT NULL,
    "grant_types" "text" NOT NULL,
    "client_name" "text",
    "client_uri" "text",
    "logo_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "client_type" "auth"."oauth_client_type" DEFAULT 'confidential'::"auth"."oauth_client_type" NOT NULL,
    CONSTRAINT "oauth_clients_client_name_length" CHECK (("char_length"("client_name") <= 1024)),
    CONSTRAINT "oauth_clients_client_uri_length" CHECK (("char_length"("client_uri") <= 2048)),
    CONSTRAINT "oauth_clients_logo_uri_length" CHECK (("char_length"("logo_uri") <= 2048))
);


ALTER TABLE "auth"."oauth_clients" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_consents" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "scopes" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "oauth_consents_revoked_after_granted" CHECK ((("revoked_at" IS NULL) OR ("revoked_at" >= "granted_at"))),
    CONSTRAINT "oauth_consents_scopes_length" CHECK (("char_length"("scopes") <= 2048)),
    CONSTRAINT "oauth_consents_scopes_not_empty" CHECK (("char_length"(TRIM(BOTH FROM "scopes")) > 0))
);


ALTER TABLE "auth"."oauth_consents" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."one_time_tokens" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_type" "auth"."one_time_token_type" NOT NULL,
    "token_hash" "text" NOT NULL,
    "relates_to" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "one_time_tokens_token_hash_check" CHECK (("char_length"("token_hash") > 0))
);


ALTER TABLE "auth"."one_time_tokens" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."refresh_tokens" (
    "instance_id" "uuid",
    "id" bigint NOT NULL,
    "token" character varying(255),
    "user_id" character varying(255),
    "revoked" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "parent" character varying(255),
    "session_id" "uuid"
);


ALTER TABLE "auth"."refresh_tokens" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."refresh_tokens" IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';



CREATE SEQUENCE IF NOT EXISTS "auth"."refresh_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNER TO "supabase_auth_admin";


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNED BY "auth"."refresh_tokens"."id";



CREATE TABLE IF NOT EXISTS "auth"."saml_providers" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "entity_id" "text" NOT NULL,
    "metadata_xml" "text" NOT NULL,
    "metadata_url" "text",
    "attribute_mapping" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "name_id_format" "text",
    CONSTRAINT "entity_id not empty" CHECK (("char_length"("entity_id") > 0)),
    CONSTRAINT "metadata_url not empty" CHECK ((("metadata_url" = NULL::"text") OR ("char_length"("metadata_url") > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK (("char_length"("metadata_xml") > 0))
);


ALTER TABLE "auth"."saml_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_providers" IS 'Auth: Manages SAML Identity Provider connections.';



CREATE TABLE IF NOT EXISTS "auth"."saml_relay_states" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "request_id" "text" NOT NULL,
    "for_email" "text",
    "redirect_to" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "flow_state_id" "uuid",
    CONSTRAINT "request_id not empty" CHECK (("char_length"("request_id") > 0))
);


ALTER TABLE "auth"."saml_relay_states" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_relay_states" IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';



CREATE TABLE IF NOT EXISTS "auth"."schema_migrations" (
    "version" character varying(255) NOT NULL
);


ALTER TABLE "auth"."schema_migrations" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."schema_migrations" IS 'Auth: Manages updates to the auth system.';



CREATE TABLE IF NOT EXISTS "auth"."sessions" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "factor_id" "uuid",
    "aal" "auth"."aal_level",
    "not_after" timestamp with time zone,
    "refreshed_at" timestamp without time zone,
    "user_agent" "text",
    "ip" "inet",
    "tag" "text",
    "oauth_client_id" "uuid"
);


ALTER TABLE "auth"."sessions" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sessions" IS 'Auth: Stores session data associated to a user.';



COMMENT ON COLUMN "auth"."sessions"."not_after" IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';



CREATE TABLE IF NOT EXISTS "auth"."sso_domains" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK (("char_length"("domain") > 0))
);


ALTER TABLE "auth"."sso_domains" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_domains" IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';



CREATE TABLE IF NOT EXISTS "auth"."sso_providers" (
    "id" "uuid" NOT NULL,
    "resource_id" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "disabled" boolean,
    CONSTRAINT "resource_id not empty" CHECK ((("resource_id" = NULL::"text") OR ("char_length"("resource_id") > 0)))
);


ALTER TABLE "auth"."sso_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_providers" IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';



COMMENT ON COLUMN "auth"."sso_providers"."resource_id" IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';



CREATE TABLE IF NOT EXISTS "auth"."users" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "aud" character varying(255),
    "role" character varying(255),
    "email" character varying(255),
    "encrypted_password" character varying(255),
    "email_confirmed_at" timestamp with time zone,
    "invited_at" timestamp with time zone,
    "confirmation_token" character varying(255),
    "confirmation_sent_at" timestamp with time zone,
    "recovery_token" character varying(255),
    "recovery_sent_at" timestamp with time zone,
    "email_change_token_new" character varying(255),
    "email_change" character varying(255),
    "email_change_sent_at" timestamp with time zone,
    "last_sign_in_at" timestamp with time zone,
    "raw_app_meta_data" "jsonb",
    "raw_user_meta_data" "jsonb",
    "is_super_admin" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "phone" "text" DEFAULT NULL::character varying,
    "phone_confirmed_at" timestamp with time zone,
    "phone_change" "text" DEFAULT ''::character varying,
    "phone_change_token" character varying(255) DEFAULT ''::character varying,
    "phone_change_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone GENERATED ALWAYS AS (LEAST("email_confirmed_at", "phone_confirmed_at")) STORED,
    "email_change_token_current" character varying(255) DEFAULT ''::character varying,
    "email_change_confirm_status" smallint DEFAULT 0,
    "banned_until" timestamp with time zone,
    "reauthentication_token" character varying(255) DEFAULT ''::character varying,
    "reauthentication_sent_at" timestamp with time zone,
    "is_sso_user" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "is_anonymous" boolean DEFAULT false NOT NULL,
    CONSTRAINT "users_email_change_confirm_status_check" CHECK ((("email_change_confirm_status" >= 0) AND ("email_change_confirm_status" <= 2)))
);


ALTER TABLE "auth"."users" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."users" IS 'Auth: Stores user login data within a secure schema.';



COMMENT ON COLUMN "auth"."users"."is_sso_user" IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';



CREATE TABLE IF NOT EXISTS "public"."Account" (
    "id" "text" DEFAULT "gen_random_uuid"() NOT NULL,
    "userId" "text" NOT NULL,
    "type" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "providerAccountId" "text" NOT NULL,
    "refresh_token" "text",
    "access_token" "text",
    "expires_at" bigint,
    "token_type" "text",
    "scope" "text",
    "id_token" "text",
    "session_state" "text"
);


ALTER TABLE "public"."Account" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Session" (
    "id" "text" DEFAULT "gen_random_uuid"() NOT NULL,
    "sessionToken" "text" NOT NULL,
    "userId" "text" NOT NULL,
    "expires" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."Session" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."User" (
    "id" "text" NOT NULL,
    "name" "text",
    "email" "text",
    "emailVerified" timestamp(6) with time zone,
    "image" "text"
);


ALTER TABLE "public"."User" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."VerificationToken" (
    "identifier" "text" NOT NULL,
    "token" "text" NOT NULL,
    "expires" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."VerificationToken" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auctions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "minimum_bid" numeric(10,2) NOT NULL,
    "status" character varying(20) DEFAULT 'open'::character varying NOT NULL,
    "winning_bid_id" "uuid",
    "expired_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "auctions_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('open'::character varying)::"text", ('closed_won'::character varying)::"text", ('closed_expired'::character varying)::"text"])))
);


ALTER TABLE "public"."auctions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bids" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auction_id" "uuid" NOT NULL,
    "user_id" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bids" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checkout_sessions" (
    "id" bigint NOT NULL,
    "asaas_checkout_id" "text",
    "internal_checkout_id" "text" NOT NULL,
    "user_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."checkout_sessions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."checkout_sessions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."checkout_sessions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."checkout_sessions_id_seq" OWNED BY "public"."checkout_sessions"."id";



CREATE TABLE IF NOT EXISTS "public"."credit_holds" (
    "id" bigint NOT NULL,
    "user_id" "text" NOT NULL,
    "auction_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "status" "public"."credit_hold_status_enum" DEFAULT 'active'::"public"."credit_hold_status_enum" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "bid_id" "uuid"
);


ALTER TABLE "public"."credit_holds" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."credit_holds_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."credit_holds_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."credit_holds_id_seq" OWNED BY "public"."credit_holds"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."credit_transactions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."credit_transactions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."credit_transactions_id_seq" OWNED BY "public"."credit_transactions"."id";



CREATE TABLE IF NOT EXISTS "public"."google_chat_webhook_logs" (
    "id" bigint NOT NULL,
    "auction_id" "uuid",
    "payload_text" "text",
    "status" integer,
    "response_text" "text",
    "error_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."google_chat_webhook_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."google_chat_webhook_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."google_chat_webhook_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."google_chat_webhook_logs_id_seq" OWNED BY "public"."google_chat_webhook_logs"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."lead_counter_a"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 15
    CACHE 1
    CYCLE;


ALTER SEQUENCE "public"."lead_counter_a" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."lead_counter_b"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 13
    CACHE 1
    CYCLE;


ALTER SEQUENCE "public"."lead_counter_b" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."lead_counter_c"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    MAXVALUE 7
    CACHE 1
    CYCLE;


ALTER SEQUENCE "public"."lead_counter_c" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ledger_entries" (
    "id" bigint NOT NULL,
    "transaction_id" bigint NOT NULL,
    "user_id" "text" NOT NULL,
    "account_type" "public"."account_type_enum" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "credit_source" "public"."credit_source_enum"
);


ALTER TABLE "public"."ledger_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."ledger_entries" IS 'Fonte da verdade para todos os saldos (contabilidade de dupla entrada).';



CREATE SEQUENCE IF NOT EXISTS "public"."ledger_entries_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ledger_entries_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."ledger_entries_id_seq" OWNED BY "public"."ledger_entries"."id";



CREATE TABLE IF NOT EXISTS "public"."processed_webhooks" (
    "event_key" "text" NOT NULL,
    "status" "public"."webhook_status_enum" DEFAULT 'queued'::"public"."webhook_status_enum" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."processed_webhooks" OWNER TO "postgres";


COMMENT ON TABLE "public"."processed_webhooks" IS 'Garante que cada webhook seja processado apenas uma vez.';



CREATE TABLE IF NOT EXISTS "public"."request_keys" (
    "key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."request_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "text" NOT NULL,
    "credit_balance" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    "email" "text",
    "email_verified" timestamp with time zone,
    "avatar_url" "text",
    "accepted_terms_at" timestamp with time zone,
    "role" "public"."user_role" DEFAULT 'user'::"public"."user_role" NOT NULL
);

ALTER TABLE ONLY "public"."users" REPLICA IDENTITY FULL;


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON TABLE "public"."users" IS 'Armazena dados de negócio do usuário. Vinculada 1-para-1 com auth_users.';



CREATE TABLE IF NOT EXISTS "public"."v_lead_count" (
    "nextval" bigint
);


ALTER TABLE "public"."v_lead_count" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "storage"."buckets" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "public" boolean DEFAULT false,
    "avif_autodetection" boolean DEFAULT false,
    "file_size_limit" bigint,
    "allowed_mime_types" "text"[],
    "owner_id" "text",
    "type" "storage"."buckettype" DEFAULT 'STANDARD'::"storage"."buckettype" NOT NULL
);


ALTER TABLE "storage"."buckets" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."buckets"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."buckets_analytics" (
    "id" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'ANALYTICS'::"storage"."buckettype" NOT NULL,
    "format" "text" DEFAULT 'ICEBERG'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."buckets_analytics" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."migrations" (
    "id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "hash" character varying(40) NOT NULL,
    "executed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "storage"."migrations" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."objects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bucket_id" "text",
    "name" "text",
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_accessed_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb",
    "path_tokens" "text"[] GENERATED ALWAYS AS ("string_to_array"("name", '/'::"text")) STORED,
    "version" "text",
    "owner_id" "text",
    "user_metadata" "jsonb",
    "level" integer
);


ALTER TABLE "storage"."objects" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."objects"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."prefixes" (
    "bucket_id" "text" NOT NULL,
    "name" "text" NOT NULL COLLATE "pg_catalog"."C",
    "level" integer GENERATED ALWAYS AS ("storage"."get_level"("name")) STORED NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "storage"."prefixes" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads" (
    "id" "text" NOT NULL,
    "in_progress_size" bigint DEFAULT 0 NOT NULL,
    "upload_signature" "text" NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "version" "text" NOT NULL,
    "owner_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_metadata" "jsonb"
);


ALTER TABLE "storage"."s3_multipart_uploads" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "upload_id" "text" NOT NULL,
    "size" bigint DEFAULT 0 NOT NULL,
    "part_number" integer NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "etag" "text" NOT NULL,
    "owner_id" "text",
    "version" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."s3_multipart_uploads_parts" OWNER TO "supabase_storage_admin";


ALTER TABLE ONLY "auth"."refresh_tokens" ALTER COLUMN "id" SET DEFAULT "nextval"('"auth"."refresh_tokens_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."checkout_sessions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."checkout_sessions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."credit_holds" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."credit_holds_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."credit_transactions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."credit_transactions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."google_chat_webhook_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."google_chat_webhook_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ledger_entries" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ledger_entries_id_seq"'::"regclass");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "amr_id_pk" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."audit_log_entries"
    ADD CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."flow_state"
    ADD CONSTRAINT "flow_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_provider_id_provider_unique" UNIQUE ("provider_id", "provider");



ALTER TABLE ONLY "auth"."instances"
    ADD CONSTRAINT "instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_authentication_method_pkey" UNIQUE ("session_id", "authentication_method");



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_last_challenged_at_key" UNIQUE ("last_challenged_at");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_code_key" UNIQUE ("authorization_code");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_id_key" UNIQUE ("authorization_id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_clients"
    ADD CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_client_unique" UNIQUE ("user_id", "client_id");



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_token_unique" UNIQUE ("token");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_entity_id_key" UNIQUE ("entity_id");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_providers"
    ADD CONSTRAINT "sso_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Session"
    ADD CONSTRAINT "Session_sessionToken_key" UNIQUE ("sessionToken");



ALTER TABLE ONLY "public"."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auctions"
    ADD CONSTRAINT "auctions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auctions"
    ADD CONSTRAINT "auctions_winning_bid_id_key" UNIQUE ("winning_bid_id");



ALTER TABLE ONLY "public"."bids"
    ADD CONSTRAINT "bids_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checkout_sessions"
    ADD CONSTRAINT "checkout_sessions_asaas_checkout_id_key" UNIQUE ("asaas_checkout_id");



ALTER TABLE ONLY "public"."checkout_sessions"
    ADD CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_holds"
    ADD CONSTRAINT "credit_holds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_holds"
    ADD CONSTRAINT "credit_holds_user_auction_unique" UNIQUE ("user_id", "auction_id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_asaas_payment_id_key" UNIQUE ("asaas_payment_id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_infinitepay_payment_id_key" UNIQUE ("infinitepay_payment_id");



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."google_chat_webhook_logs"
    ADD CONSTRAINT "google_chat_webhook_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ledger_entries"
    ADD CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."processed_webhooks"
    ADD CONSTRAINT "processed_webhooks_pkey" PRIMARY KEY ("event_key");



ALTER TABLE ONLY "public"."Account"
    ADD CONSTRAINT "provider_unique_id" UNIQUE ("provider", "providerAccountId");



ALTER TABLE ONLY "public"."request_keys"
    ADD CONSTRAINT "request_keys_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."VerificationToken"
    ADD CONSTRAINT "token_identifier_unique" UNIQUE ("identifier", "token");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets_analytics"
    ADD CONSTRAINT "buckets_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets"
    ADD CONSTRAINT "buckets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."prefixes"
    ADD CONSTRAINT "prefixes_pkey" PRIMARY KEY ("bucket_id", "level", "name");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_pkey" PRIMARY KEY ("id");



CREATE INDEX "audit_logs_instance_id_idx" ON "auth"."audit_log_entries" USING "btree" ("instance_id");



CREATE UNIQUE INDEX "confirmation_token_idx" ON "auth"."users" USING "btree" ("confirmation_token") WHERE (("confirmation_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "email_change_token_current_idx" ON "auth"."users" USING "btree" ("email_change_token_current") WHERE (("email_change_token_current")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "email_change_token_new_idx" ON "auth"."users" USING "btree" ("email_change_token_new") WHERE (("email_change_token_new")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "factor_id_created_at_idx" ON "auth"."mfa_factors" USING "btree" ("user_id", "created_at");



CREATE INDEX "flow_state_created_at_idx" ON "auth"."flow_state" USING "btree" ("created_at" DESC);



CREATE INDEX "identities_email_idx" ON "auth"."identities" USING "btree" ("email" "text_pattern_ops");



COMMENT ON INDEX "auth"."identities_email_idx" IS 'Auth: Ensures indexed queries on the email column';



CREATE INDEX "identities_user_id_idx" ON "auth"."identities" USING "btree" ("user_id");



CREATE INDEX "idx_auth_code" ON "auth"."flow_state" USING "btree" ("auth_code");



CREATE INDEX "idx_user_id_auth_method" ON "auth"."flow_state" USING "btree" ("user_id", "authentication_method");



CREATE INDEX "mfa_challenge_created_at_idx" ON "auth"."mfa_challenges" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "mfa_factors_user_friendly_name_unique" ON "auth"."mfa_factors" USING "btree" ("friendly_name", "user_id") WHERE (TRIM(BOTH FROM "friendly_name") <> ''::"text");



CREATE INDEX "mfa_factors_user_id_idx" ON "auth"."mfa_factors" USING "btree" ("user_id");



CREATE INDEX "oauth_auth_pending_exp_idx" ON "auth"."oauth_authorizations" USING "btree" ("expires_at") WHERE ("status" = 'pending'::"auth"."oauth_authorization_status");



CREATE INDEX "oauth_clients_deleted_at_idx" ON "auth"."oauth_clients" USING "btree" ("deleted_at");



CREATE INDEX "oauth_consents_active_client_idx" ON "auth"."oauth_consents" USING "btree" ("client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_active_user_client_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_user_order_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "granted_at" DESC);



CREATE INDEX "one_time_tokens_relates_to_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("relates_to");



CREATE INDEX "one_time_tokens_token_hash_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("token_hash");



CREATE UNIQUE INDEX "one_time_tokens_user_id_token_type_key" ON "auth"."one_time_tokens" USING "btree" ("user_id", "token_type");



CREATE UNIQUE INDEX "reauthentication_token_idx" ON "auth"."users" USING "btree" ("reauthentication_token") WHERE (("reauthentication_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "recovery_token_idx" ON "auth"."users" USING "btree" ("recovery_token") WHERE (("recovery_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "refresh_tokens_instance_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id");



CREATE INDEX "refresh_tokens_instance_id_user_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id", "user_id");



CREATE INDEX "refresh_tokens_parent_idx" ON "auth"."refresh_tokens" USING "btree" ("parent");



CREATE INDEX "refresh_tokens_session_id_revoked_idx" ON "auth"."refresh_tokens" USING "btree" ("session_id", "revoked");



CREATE INDEX "refresh_tokens_updated_at_idx" ON "auth"."refresh_tokens" USING "btree" ("updated_at" DESC);



CREATE INDEX "saml_providers_sso_provider_id_idx" ON "auth"."saml_providers" USING "btree" ("sso_provider_id");



CREATE INDEX "saml_relay_states_created_at_idx" ON "auth"."saml_relay_states" USING "btree" ("created_at" DESC);



CREATE INDEX "saml_relay_states_for_email_idx" ON "auth"."saml_relay_states" USING "btree" ("for_email");



CREATE INDEX "saml_relay_states_sso_provider_id_idx" ON "auth"."saml_relay_states" USING "btree" ("sso_provider_id");



CREATE INDEX "sessions_not_after_idx" ON "auth"."sessions" USING "btree" ("not_after" DESC);



CREATE INDEX "sessions_oauth_client_id_idx" ON "auth"."sessions" USING "btree" ("oauth_client_id");



CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "sso_domains_domain_idx" ON "auth"."sso_domains" USING "btree" ("lower"("domain"));



CREATE INDEX "sso_domains_sso_provider_id_idx" ON "auth"."sso_domains" USING "btree" ("sso_provider_id");



CREATE UNIQUE INDEX "sso_providers_resource_id_idx" ON "auth"."sso_providers" USING "btree" ("lower"("resource_id"));



CREATE INDEX "sso_providers_resource_id_pattern_idx" ON "auth"."sso_providers" USING "btree" ("resource_id" "text_pattern_ops");



CREATE UNIQUE INDEX "unique_phone_factor_per_user" ON "auth"."mfa_factors" USING "btree" ("user_id", "phone");



CREATE INDEX "user_id_created_at_idx" ON "auth"."sessions" USING "btree" ("user_id", "created_at");



CREATE UNIQUE INDEX "users_email_partial_key" ON "auth"."users" USING "btree" ("email") WHERE ("is_sso_user" = false);



COMMENT ON INDEX "auth"."users_email_partial_key" IS 'Auth: A partial unique index that applies only when is_sso_user is false';



CREATE INDEX "users_instance_id_email_idx" ON "auth"."users" USING "btree" ("instance_id", "lower"(("email")::"text"));



CREATE INDEX "users_instance_id_idx" ON "auth"."users" USING "btree" ("instance_id");



CREATE INDEX "users_is_anonymous_idx" ON "auth"."users" USING "btree" ("is_anonymous");



CREATE INDEX "Account_userId_idx" ON "public"."Account" USING "btree" ("userId");



CREATE INDEX "Session_userId_idx" ON "public"."Session" USING "btree" ("userId");



CREATE UNIQUE INDEX "User_email_key" ON "public"."User" USING "btree" ("email");



CREATE INDEX "auctions_lead_id_idx" ON "public"."auctions" USING "btree" ("lead_id");



CREATE INDEX "bids_auction_id_idx" ON "public"."bids" USING "btree" ("auction_id");



CREATE INDEX "bids_user_id_idx" ON "public"."bids" USING "btree" ("user_id");



CREATE INDEX "credit_transactions_user_id_idx" ON "public"."credit_transactions" USING "btree" ("user_id");



CREATE INDEX "idx_auctions_status_expired_at" ON "public"."auctions" USING "btree" ("status", "expired_at");



CREATE INDEX "idx_bids_auction_id_created_at" ON "public"."bids" USING "btree" ("auction_id", "created_at" DESC);



CREATE INDEX "idx_checkout_sessions_user_id" ON "public"."checkout_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_credit_holds_auction_id" ON "public"."credit_holds" USING "btree" ("auction_id");



CREATE INDEX "idx_credit_holds_status" ON "public"."credit_holds" USING "btree" ("status");



CREATE INDEX "idx_credit_holds_user_id" ON "public"."credit_holds" USING "btree" ("user_id");



CREATE INDEX "idx_leads_owner_id" ON "public"."leads" USING "btree" ("owner_id");



CREATE INDEX "leads_owner_id_idx" ON "public"."leads" USING "btree" ("owner_id");



CREATE INDEX "leads_status_idx" ON "public"."leads" USING "btree" ("status");



CREATE INDEX "ledger_entries_transaction_id_idx" ON "public"."ledger_entries" USING "btree" ("transaction_id");



CREATE INDEX "ledger_entries_user_id_idx" ON "public"."ledger_entries" USING "btree" ("user_id");



CREATE UNIQUE INDEX "uniq_credit_tx_reward_idempotency" ON "public"."credit_transactions" USING "btree" ((("metadata" ->> 'idempotency_key'::"text"))) WHERE ("source" = 'reward'::"public"."credit_source_enum");



CREATE UNIQUE INDEX "bname" ON "storage"."buckets" USING "btree" ("name");



CREATE UNIQUE INDEX "bucketid_objname" ON "storage"."objects" USING "btree" ("bucket_id", "name");



CREATE INDEX "idx_multipart_uploads_list" ON "storage"."s3_multipart_uploads" USING "btree" ("bucket_id", "key", "created_at");



CREATE UNIQUE INDEX "idx_name_bucket_level_unique" ON "storage"."objects" USING "btree" ("name" COLLATE "C", "bucket_id", "level");



CREATE INDEX "idx_objects_bucket_id_name" ON "storage"."objects" USING "btree" ("bucket_id", "name" COLLATE "C");



CREATE INDEX "idx_objects_lower_name" ON "storage"."objects" USING "btree" (("path_tokens"["level"]), "lower"("name") "text_pattern_ops", "bucket_id", "level");



CREATE INDEX "idx_prefixes_lower_name" ON "storage"."prefixes" USING "btree" ("bucket_id", "level", (("string_to_array"("name", '/'::"text"))["level"]), "lower"("name") "text_pattern_ops");



CREATE INDEX "name_prefix_search" ON "storage"."objects" USING "btree" ("name" "text_pattern_ops");



CREATE UNIQUE INDEX "objects_bucket_id_level_idx" ON "storage"."objects" USING "btree" ("bucket_id", "level", "name" COLLATE "C");



CREATE OR REPLACE TRIGGER "after_lead_change_trigger" AFTER INSERT OR UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."after_lead_change_create_auction"();



CREATE OR REPLACE TRIGGER "before_lead_change_trigger" BEFORE INSERT ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."before_lead_change_set_status"();



CREATE OR REPLACE TRIGGER "on-add-new-auction-google-chat" AFTER INSERT ON "public"."auctions" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://nfwfolrcpaxqwgkzzfok.supabase.co/functions/v1/rapid-service', 'POST', '{"Content-type":"application/json","x-webhook-secret":"aAyVo2Ak94F7Myfv2A"}', '{}', '10000');



CREATE OR REPLACE TRIGGER "trg_credit_transactions_fill_source" BEFORE INSERT ON "public"."credit_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."credit_transactions_fill_source"();



CREATE OR REPLACE TRIGGER "trg_ledger_entries_fill_credit_source" BEFORE INSERT ON "public"."ledger_entries" FOR EACH ROW EXECUTE FUNCTION "public"."ledger_entries_fill_credit_source"();



CREATE OR REPLACE TRIGGER "trg_prevent_expired_bids" BEFORE INSERT ON "public"."bids" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_expired_bids"();



CREATE OR REPLACE TRIGGER "enforce_bucket_name_length_trigger" BEFORE INSERT OR UPDATE OF "name" ON "storage"."buckets" FOR EACH ROW EXECUTE FUNCTION "storage"."enforce_bucket_name_length"();



CREATE OR REPLACE TRIGGER "objects_delete_delete_prefix" AFTER DELETE ON "storage"."objects" FOR EACH ROW EXECUTE FUNCTION "storage"."delete_prefix_hierarchy_trigger"();



CREATE OR REPLACE TRIGGER "objects_insert_create_prefix" BEFORE INSERT ON "storage"."objects" FOR EACH ROW EXECUTE FUNCTION "storage"."objects_insert_prefix_trigger"();



CREATE OR REPLACE TRIGGER "objects_update_create_prefix" BEFORE UPDATE ON "storage"."objects" FOR EACH ROW WHEN ((("new"."name" <> "old"."name") OR ("new"."bucket_id" <> "old"."bucket_id"))) EXECUTE FUNCTION "storage"."objects_update_prefix_trigger"();



CREATE OR REPLACE TRIGGER "prefixes_create_hierarchy" BEFORE INSERT ON "storage"."prefixes" FOR EACH ROW WHEN (("pg_trigger_depth"() < 1)) EXECUTE FUNCTION "storage"."prefixes_insert_trigger"();



CREATE OR REPLACE TRIGGER "prefixes_delete_hierarchy" AFTER DELETE ON "storage"."prefixes" FOR EACH ROW EXECUTE FUNCTION "storage"."delete_prefix_hierarchy_trigger"();



CREATE OR REPLACE TRIGGER "update_objects_updated_at" BEFORE UPDATE ON "storage"."objects" FOR EACH ROW EXECUTE FUNCTION "storage"."update_updated_at_column"();



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_auth_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "auth"."mfa_factors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_flow_state_id_fkey" FOREIGN KEY ("flow_state_id") REFERENCES "auth"."flow_state"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_oauth_client_id_fkey" FOREIGN KEY ("oauth_client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auctions"
    ADD CONSTRAINT "auctions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bids"
    ADD CONSTRAINT "bids_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bids"
    ADD CONSTRAINT "bids_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checkout_sessions"
    ADD CONSTRAINT "checkout_sessions_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_holds"
    ADD CONSTRAINT "credit_holds_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_holds"
    ADD CONSTRAINT "credit_holds_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credit_transactions"
    ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."auctions"
    ADD CONSTRAINT "fk_winning_bid" FOREIGN KEY ("winning_bid_id") REFERENCES "public"."bids"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ledger_entries"
    ADD CONSTRAINT "ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."credit_transactions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ledger_entries"
    ADD CONSTRAINT "ledger_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."prefixes"
    ADD CONSTRAINT "prefixes_bucketId_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "storage"."s3_multipart_uploads"("id") ON DELETE CASCADE;



ALTER TABLE "auth"."audit_log_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."flow_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_amr_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_factors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."one_time_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."refresh_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_relay_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."schema_migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_domains" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Allow authenticated users to interact with auctions" ON "public"."auctions" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to interact with leads" ON "public"."leads" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to place bids" ON "public"."bids" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow user to read their own ledger entries" ON "public"."ledger_entries" FOR SELECT USING (("user_id" = ("auth"."uid"())::"text"));



CREATE POLICY "Allow user to read their own transactions" ON "public"."credit_transactions" FOR SELECT USING (("user_id" = ("auth"."uid"())::"text"));



CREATE POLICY "TEST - Allow authenticated users to read all leads." ON "public"."leads" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."auctions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auctions_select_all_statuses" ON "public"."auctions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auctions_select_open" ON "public"."auctions" FOR SELECT TO "authenticated" USING ((("status")::"text" = 'open'::"text"));



ALTER TABLE "public"."bids" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bids_insert_self" ON "public"."bids" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ("auth"."uid"())::"text"));



CREATE POLICY "bids_select_all_auth" ON "public"."bids" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "bids_select_open_or_own" ON "public"."bids" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."auctions" "a"
  WHERE (("a"."id" = "bids"."auction_id") AND (("a"."status")::"text" = 'open'::"text")))) OR ("user_id" = ("auth"."uid"())::"text")));



ALTER TABLE "public"."checkout_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_holds" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_holds_select_own" ON "public"."credit_holds" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "credit_holds"."user_id") AND ("u"."email" = "auth"."email"())))));



ALTER TABLE "public"."credit_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_transactions_select_own" ON "public"."credit_transactions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "credit_transactions"."user_id") AND ("u"."email" = "auth"."email"())))));



CREATE POLICY "insert bids for open auctions" ON "public"."bids" FOR INSERT TO "anon" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."auctions" "a"
  WHERE (("a"."id" = "bids"."auction_id") AND (("a"."status")::"text" = 'open'::"text") AND ("a"."expired_at" > "now"())))));



CREATE POLICY "insert bids only for open & unexpired auctions" ON "public"."bids" FOR INSERT TO "anon" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."auctions" "a"
  WHERE (("a"."id" = "bids"."auction_id") AND (("a"."status")::"text" = 'open'::"text") AND ("a"."expired_at" > "now"())))));



ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leads_select_owned" ON "public"."leads" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "leads"."owner_id") AND ("u"."email" = "auth"."email"())))));



CREATE POLICY "leads_select_owner" ON "public"."leads" FOR SELECT TO "authenticated" USING (("owner_id" = ("auth"."uid"())::"text"));



ALTER TABLE "public"."processed_webhooks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read bids for open auctions" ON "public"."bids" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."auctions" "a"
  WHERE (("a"."id" = "bids"."auction_id") AND (("a"."status")::"text" = 'open'::"text") AND ("a"."expired_at" > "now"())))));



CREATE POLICY "read leads for open auctions" ON "public"."leads" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."auctions" "a"
  WHERE (("a"."lead_id" = "leads"."id") AND (("a"."status")::"text" = 'open'::"text") AND ("a"."expired_at" > "now"())))));



CREATE POLICY "read open auctions" ON "public"."auctions" FOR SELECT TO "anon" USING (((("status")::"text" = 'open'::"text") AND ("expired_at" > "now"())));



CREATE POLICY "read_auctions_for_own_holds" ON "public"."auctions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."credit_holds" "ch"
  WHERE (("ch"."auction_id" = "auctions"."id") AND ("ch"."user_id" = ("auth"."uid"())::"text")))));



CREATE POLICY "read_own_holds" ON "public"."credit_holds" FOR SELECT USING (("user_id" = ("auth"."uid"())::"text"));



CREATE POLICY "select_own_credit_holds" ON "public"."credit_holds" FOR SELECT TO "authenticated" USING (("user_id" = ("auth"."uid"())::"text"));



CREATE POLICY "select_own_credits" ON "public"."users" FOR SELECT USING (("id" = ("auth"."uid"())::"text"));



CREATE POLICY "select_own_transactions" ON "public"."credit_transactions" FOR SELECT USING (("user_id" = ("auth"."uid"())::"text"));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_select_own" ON "public"."users" FOR SELECT TO "authenticated" USING (("email" = "auth"."email"()));



CREATE POLICY "users_update_own" ON "public"."users" FOR UPDATE TO "authenticated" USING (("email" = "auth"."email"())) WITH CHECK (("email" = "auth"."email"()));



ALTER TABLE "storage"."buckets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."objects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."prefixes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads_parts" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "auth" TO "anon";
GRANT USAGE ON SCHEMA "auth" TO "authenticated";
GRANT USAGE ON SCHEMA "auth" TO "service_role";
GRANT ALL ON SCHEMA "auth" TO "supabase_auth_admin";
GRANT ALL ON SCHEMA "auth" TO "dashboard_user";
GRANT USAGE ON SCHEMA "auth" TO "postgres";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT USAGE ON SCHEMA "storage" TO "postgres" WITH GRANT OPTION;
GRANT USAGE ON SCHEMA "storage" TO "anon";
GRANT USAGE ON SCHEMA "storage" TO "authenticated";
GRANT USAGE ON SCHEMA "storage" TO "service_role";
GRANT ALL ON SCHEMA "storage" TO "supabase_storage_admin";
GRANT ALL ON SCHEMA "storage" TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."email"() TO "dashboard_user";
GRANT ALL ON FUNCTION "auth"."email"() TO "postgres";



GRANT ALL ON FUNCTION "auth"."jwt"() TO "postgres";
GRANT ALL ON FUNCTION "auth"."jwt"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."role"() TO "dashboard_user";
GRANT ALL ON FUNCTION "auth"."role"() TO "postgres";



GRANT ALL ON FUNCTION "auth"."uid"() TO "dashboard_user";
GRANT ALL ON FUNCTION "auth"."uid"() TO "postgres";



GRANT ALL ON FUNCTION "public"."after_lead_change_create_auction"() TO "anon";
GRANT ALL ON FUNCTION "public"."after_lead_change_create_auction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."after_lead_change_create_auction"() TO "service_role";



GRANT ALL ON FUNCTION "public"."before_lead_change_set_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."before_lead_change_set_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."before_lead_change_set_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."credit_transactions_fill_source"() TO "anon";
GRANT ALL ON FUNCTION "public"."credit_transactions_fill_source"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."credit_transactions_fill_source"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_credit_job"("p_asaas_payment_id" "text", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_credit_job"("p_asaas_payment_id" "text", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_credit_job"("p_asaas_payment_id" "text", "p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_active_credit_holds"("p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_active_credit_holds"("p_user_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_credit_balance"("p_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_credit_balance"("p_user_id" "text") TO "service_role";



GRANT ALL ON TABLE "public"."credit_transactions" TO "service_role";
GRANT SELECT ON TABLE "public"."credit_transactions" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_user_credit_transactions"("p_user_id" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_credit_transactions"("p_user_id" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_credit_transactions"("p_user_id" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "service_role";
GRANT SELECT ON TABLE "public"."leads" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_user_leads"("p_user_id" "text", "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_leads"("p_user_id" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_leads"("p_user_id" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_credits_on_payment"("p_asaas_payment_id" "text", "p_user_id" "text", "p_credits_purchased" numeric, "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."grant_credits_on_payment"("p_asaas_payment_id" "text", "p_user_id" "text", "p_credits_purchased" numeric, "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_credits_on_payment"("p_asaas_payment_id" "text", "p_user_id" "text", "p_credits_purchased" numeric, "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_credits_on_payment_generic"("p_provider" "text", "p_payment_id" "text", "p_user_id" "text", "p_credits_purchased" numeric, "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."grant_credits_on_payment_generic"("p_provider" "text", "p_payment_id" "text", "p_user_id" "text", "p_credits_purchased" numeric, "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_credits_on_payment_generic"("p_provider" "text", "p_payment_id" "text", "p_user_id" "text", "p_credits_purchased" numeric, "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."ledger_entries_fill_credit_source"() TO "anon";
GRANT ALL ON FUNCTION "public"."ledger_entries_fill_credit_source"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ledger_entries_fill_credit_source"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_expired_bids"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_expired_bids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_expired_bids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_credit_jobs_worker"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_credit_jobs_worker"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_credit_jobs_worker"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_auction_on_lead_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_auction_on_lead_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_auction_on_lead_change"() TO "service_role";



GRANT ALL ON FUNCTION "storage"."add_prefixes"("_bucket_id" "text", "_name" "text") TO "postgres";



GRANT ALL ON FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") TO "postgres";



GRANT ALL ON FUNCTION "storage"."delete_prefix"("_bucket_id" "text", "_name" "text") TO "postgres";



GRANT ALL ON FUNCTION "storage"."delete_prefix_hierarchy_trigger"() TO "postgres";



GRANT ALL ON FUNCTION "storage"."enforce_bucket_name_length"() TO "postgres";



GRANT ALL ON FUNCTION "storage"."extension"("name" "text") TO "postgres";



GRANT ALL ON FUNCTION "storage"."filename"("name" "text") TO "postgres";



GRANT ALL ON FUNCTION "storage"."foldername"("name" "text") TO "postgres";



GRANT ALL ON FUNCTION "storage"."get_level"("name" "text") TO "postgres";



GRANT ALL ON FUNCTION "storage"."get_prefix"("name" "text") TO "postgres";



GRANT ALL ON FUNCTION "storage"."get_prefixes"("name" "text") TO "postgres";



GRANT ALL ON FUNCTION "storage"."get_size_by_bucket"() TO "postgres";



GRANT ALL ON FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "next_key_token" "text", "next_upload_token" "text") TO "postgres";



GRANT ALL ON FUNCTION "storage"."list_objects_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "start_after" "text", "next_token" "text") TO "postgres";



GRANT ALL ON FUNCTION "storage"."objects_insert_prefix_trigger"() TO "postgres";



GRANT ALL ON FUNCTION "storage"."objects_update_prefix_trigger"() TO "postgres";



GRANT ALL ON FUNCTION "storage"."operation"() TO "postgres";



GRANT ALL ON FUNCTION "storage"."prefixes_insert_trigger"() TO "postgres";



GRANT ALL ON FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") TO "postgres";



GRANT ALL ON FUNCTION "storage"."search_legacy_v1"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") TO "postgres";



GRANT ALL ON FUNCTION "storage"."search_v1_optimised"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") TO "postgres";



GRANT ALL ON FUNCTION "storage"."update_updated_at_column"() TO "postgres";



GRANT ALL ON TABLE "auth"."audit_log_entries" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."audit_log_entries" TO "postgres";
GRANT SELECT ON TABLE "auth"."audit_log_entries" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."flow_state" TO "postgres";
GRANT SELECT ON TABLE "auth"."flow_state" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."flow_state" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."identities" TO "postgres";
GRANT SELECT ON TABLE "auth"."identities" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."identities" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."instances" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."instances" TO "postgres";
GRANT SELECT ON TABLE "auth"."instances" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_amr_claims" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_amr_claims" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_amr_claims" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_challenges" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_challenges" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_challenges" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_factors" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_factors" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_factors" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_clients" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_clients" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_consents" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_consents" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."one_time_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."one_time_tokens" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."one_time_tokens" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."refresh_tokens" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."refresh_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."refresh_tokens" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "dashboard_user";
GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "postgres";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_providers" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_relay_states" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_relay_states" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_relay_states" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sessions" TO "postgres";
GRANT SELECT ON TABLE "auth"."sessions" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sessions" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_domains" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_domains" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_domains" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_providers" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."users" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."users" TO "postgres";
GRANT SELECT ON TABLE "auth"."users" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "public"."Account" TO "anon";
GRANT ALL ON TABLE "public"."Account" TO "authenticated";
GRANT ALL ON TABLE "public"."Account" TO "service_role";



GRANT ALL ON TABLE "public"."Session" TO "anon";
GRANT ALL ON TABLE "public"."Session" TO "authenticated";
GRANT ALL ON TABLE "public"."Session" TO "service_role";



GRANT ALL ON TABLE "public"."User" TO "anon";
GRANT ALL ON TABLE "public"."User" TO "authenticated";
GRANT ALL ON TABLE "public"."User" TO "service_role";



GRANT ALL ON TABLE "public"."VerificationToken" TO "anon";
GRANT ALL ON TABLE "public"."VerificationToken" TO "authenticated";
GRANT ALL ON TABLE "public"."VerificationToken" TO "service_role";



GRANT ALL ON TABLE "public"."auctions" TO "service_role";
GRANT SELECT ON TABLE "public"."auctions" TO "authenticated";



GRANT ALL ON TABLE "public"."bids" TO "service_role";
GRANT SELECT ON TABLE "public"."bids" TO "authenticated";



GRANT ALL ON TABLE "public"."checkout_sessions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."checkout_sessions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."checkout_sessions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."checkout_sessions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."credit_holds" TO "service_role";
GRANT SELECT ON TABLE "public"."credit_holds" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."credit_holds_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."credit_holds_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."credit_holds_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."credit_transactions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."credit_transactions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."credit_transactions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."google_chat_webhook_logs" TO "anon";
GRANT ALL ON TABLE "public"."google_chat_webhook_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."google_chat_webhook_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."google_chat_webhook_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."google_chat_webhook_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."google_chat_webhook_logs_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."lead_counter_a" TO "anon";
GRANT ALL ON SEQUENCE "public"."lead_counter_a" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lead_counter_a" TO "service_role";



GRANT ALL ON SEQUENCE "public"."lead_counter_b" TO "anon";
GRANT ALL ON SEQUENCE "public"."lead_counter_b" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lead_counter_b" TO "service_role";



GRANT ALL ON SEQUENCE "public"."lead_counter_c" TO "anon";
GRANT ALL ON SEQUENCE "public"."lead_counter_c" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lead_counter_c" TO "service_role";



GRANT ALL ON TABLE "public"."ledger_entries" TO "anon";
GRANT ALL ON TABLE "public"."ledger_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."ledger_entries" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ledger_entries_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ledger_entries_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ledger_entries_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."processed_webhooks" TO "service_role";



GRANT ALL ON TABLE "public"."request_keys" TO "anon";
GRANT ALL ON TABLE "public"."request_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."request_keys" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."users" TO "authenticated";



GRANT SELECT("credit_balance") ON TABLE "public"."users" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."users" TO "authenticated";



GRANT SELECT("updated_at") ON TABLE "public"."users" TO "authenticated";



GRANT SELECT("name") ON TABLE "public"."users" TO "authenticated";



GRANT SELECT("email") ON TABLE "public"."users" TO "authenticated";



GRANT SELECT("avatar_url") ON TABLE "public"."users" TO "authenticated";



GRANT SELECT("accepted_terms_at") ON TABLE "public"."users" TO "authenticated";



GRANT ALL ON TABLE "public"."v_lead_count" TO "anon";
GRANT ALL ON TABLE "public"."v_lead_count" TO "authenticated";
GRANT ALL ON TABLE "public"."v_lead_count" TO "service_role";



GRANT ALL ON TABLE "storage"."buckets" TO "anon";
GRANT ALL ON TABLE "storage"."buckets" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."buckets_analytics" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "anon";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "postgres";



GRANT ALL ON TABLE "storage"."objects" TO "anon";
GRANT ALL ON TABLE "storage"."objects" TO "authenticated";
GRANT ALL ON TABLE "storage"."objects" TO "service_role";
GRANT ALL ON TABLE "storage"."objects" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."prefixes" TO "service_role";
GRANT ALL ON TABLE "storage"."prefixes" TO "authenticated";
GRANT ALL ON TABLE "storage"."prefixes" TO "anon";
GRANT ALL ON TABLE "storage"."prefixes" TO "postgres";



GRANT ALL ON TABLE "storage"."s3_multipart_uploads" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "anon";
GRANT ALL ON TABLE "storage"."s3_multipart_uploads" TO "postgres";



GRANT ALL ON TABLE "storage"."s3_multipart_uploads_parts" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "anon";
GRANT ALL ON TABLE "storage"."s3_multipart_uploads_parts" TO "postgres";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "service_role";



RESET ALL;
