

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


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



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
    v_minimum_bid := 180;

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


ALTER TABLE ONLY "public"."checkout_sessions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."checkout_sessions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."credit_holds" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."credit_holds_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."credit_transactions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."credit_transactions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."google_chat_webhook_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."google_chat_webhook_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ledger_entries" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ledger_entries_id_seq"'::"regclass");



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



CREATE OR REPLACE TRIGGER "after_lead_change_trigger" AFTER INSERT OR UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."after_lead_change_create_auction"();



CREATE OR REPLACE TRIGGER "before_lead_change_trigger" BEFORE INSERT ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."before_lead_change_set_status"();



CREATE OR REPLACE TRIGGER "on-add-new-auction-google-chat" AFTER INSERT ON "public"."auctions" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://nfwfolrcpaxqwgkzzfok.supabase.co/functions/v1/rapid-service', 'POST', '{"Content-type":"application/json","x-webhook-secret":"aAyVo2Ak94F7Myfv2A"}', '{}', '10000');



CREATE OR REPLACE TRIGGER "trg_credit_transactions_fill_source" BEFORE INSERT ON "public"."credit_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."credit_transactions_fill_source"();



CREATE OR REPLACE TRIGGER "trg_ledger_entries_fill_credit_source" BEFORE INSERT ON "public"."ledger_entries" FOR EACH ROW EXECUTE FUNCTION "public"."ledger_entries_fill_credit_source"();



CREATE OR REPLACE TRIGGER "trg_prevent_expired_bids" BEFORE INSERT ON "public"."bids" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_expired_bids"();



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



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



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






RESET ALL;
