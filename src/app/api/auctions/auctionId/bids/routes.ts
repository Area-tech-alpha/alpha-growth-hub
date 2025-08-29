import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// --- GET: BUSCAR HISTÓRICO DE LANCES ---
export async function GET(
  _request: Request,
  { params }: { params: { auctionId: string } }
) {
  try {
    const supabase = await createClient();
    const auctionId = params.auctionId;

    const { data: bids, error } = await supabase
      .from('bids')
      .select(`
        id,
        user_id,
        amount,
        created_at,
        author:auth_users ( name )
      `)
      .eq('auction_id', auctionId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    const responseData = bids.map(bid => {
      const authorName = Array.isArray(bid.author) && bid.author.length > 0
        ? bid.author[0]?.name
        : 'Usuário Anônimo';

      return {
        id: bid.id,
        userId: bid.user_id,
        userName: authorName,
        amount: bid.amount,
        createdAt: bid.created_at,
      };
    });

    return NextResponse.json(responseData);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    console.error(`Erro em GET /api/auctions/${params.auctionId}/bids:`, errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// --- POST: CRIAR UM NOVO LANCE ---
export async function POST(
  request: Request,
  { params }: { params: { auctionId: string } }
) {
  try {
    const supabase = await createClient();
    const auctionId = params.auctionId;
    const { amount } = await request.json();

    // 1. Autenticação: Garante que há um usuário logado.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 2. Validação de Créditos: Busca o saldo do usuário.
    const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('credit_balance')
        .eq('id', user.id)
        .single();

    if (profileError || !userProfile) {
        throw new Error('Perfil de usuário não encontrado para verificação de crédito.');
    }
    
    if (userProfile.credit_balance < amount) {
        return NextResponse.json({ error: 'Créditos insuficientes para este lance.' }, { status: 400 });
    }

    // 3. Validação do Lance: Busca o lance atual ou o lance mínimo.
    const { data: highestBid } = await supabase
        .from('bids')
        .select('amount')
        .eq('auction_id', auctionId)
        .order('amount', { ascending: false })
        .limit(1)
        .single();

    let minimumRequiredBid = 0;
    if (highestBid) {
        minimumRequiredBid = highestBid.amount;
    } else {
        const { data: auctionData } = await supabase.from('auctions').select('minimum_bid').eq('id', auctionId).single();
        if (auctionData) {
            minimumRequiredBid = auctionData.minimum_bid;
        }
    }

    if (amount <= minimumRequiredBid) {
        return NextResponse.json({ error: `O lance deve ser maior que ${minimumRequiredBid.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}.` }, { status: 400 });
    }
    
    // 4. Inserção do Novo Lance
    const { data: newBid, error: insertError } = await supabase
      .from('bids')
      .insert({
        auction_id: auctionId,
        user_id: user.id,
        amount: amount,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    
    // NOTA: A lógica de debitar os créditos do usuário deve ser implementada aqui
    // ou, idealmente, quando o leilão for finalizado e o vencedor for definido.

    return NextResponse.json(newBid, { status: 201 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    console.error(`Erro em POST /api/auctions/${params.auctionId}/bids:`, errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
