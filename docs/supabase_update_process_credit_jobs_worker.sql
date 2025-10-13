-- Suggested update for Supabase worker: process_credit_jobs_worker
-- This replaces only the parts that set the credit origin.
-- Adapt to your current function body.

-- Example skeleton (adjust variable names and inserts to match your function):

-- Match current signature (RETURNS jsonb) to avoid return-type errors
CREATE OR REPLACE FUNCTION public.process_credit_jobs_worker()
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
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
$function$;
