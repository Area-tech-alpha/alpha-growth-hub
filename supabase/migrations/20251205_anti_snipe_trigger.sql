-- Anti-snipe: estende expired_at quando um lance entra com <60s restante
-- Endpoint passa a depender dessa trigger; a UI recebe o UPDATE pelo realtime

-- Funcao principal chamada tanto pelo trigger quanto por RPC se necessario
create or replace function public.apply_anti_snipe(p_auction_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
    v_expired_at timestamptz;
    v_status text;
    v_remaining interval;
    v_new_expired_at timestamptz;
begin
    select expired_at, status
      into v_expired_at, v_status
      from public.auctions
     where id = p_auction_id
     for update;

    if not found then
        return null;
    end if;

    -- So estende leilao ainda aberto e nao expirado
    if v_status is distinct from 'open' then
        return v_expired_at;
    end if;

    if v_expired_at <= now() then
        return v_expired_at;
    end if;

    v_remaining := v_expired_at - now();

    if v_remaining <= interval '30 seconds' then
        v_new_expired_at := now() + interval '30 seconds';
    elsif v_remaining <= interval '60 seconds' then
        v_new_expired_at := now() + interval '60 seconds';
    else
        v_new_expired_at := v_expired_at;
    end if;

    if v_new_expired_at > v_expired_at then
        update public.auctions
           set expired_at = v_new_expired_at
         where id = p_auction_id;
        return v_new_expired_at;
    end if;

    return v_expired_at;
end;
$$;

-- Trigger que roda em todo INSERT de bid
drop trigger if exists trg_bids_anti_snipe on public.bids;
drop function if exists public.trg_bids_anti_snipe();

create or replace function public.trg_bids_anti_snipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.apply_anti_snipe(new.auction_id);
    return null;
end;
$$;

create trigger trg_bids_anti_snipe
after insert on public.bids
for each row
execute function public.trg_bids_anti_snipe();
