# Guia de Diferenciação de Origem de Créditos

## Objetivo
- Manter o uso dos créditos transparente para o usuário final (saldo único), enquanto a equipe interna consegue rastrear a origem (pagamento, recompensa, ajuste).
- Suportar métricas financeiras, auditoria e governança sem alterar os fluxos de compra, lance ou consumo já existentes.

## Estado Atual (baseline)
- Saldo unificado em `users.credit_balance`, utilizado por holds e deduções (`src/app/api/auction/bid/route.ts` e `src/app/api/auctions/[id]/close/route.ts`).
- Compras registradas em `credit_transactions` apenas com `amount_paid`, `credits_purchased` e `metadata` (sem origem explícita).
- Worker `process_credit_jobs_worker()` (executado pelos webhooks de Asaas/InfinitePay) credita valores e preenche `ledger_entries`, mas não discrimina origem.
- Relatórios internos (`src/app/api/admin/finance/route.ts`) agregam tudo em um único total.

## Evolução de Dados
1. **Enum de origem**  
   - Adicionar `credit_source_enum` com opções `monetary`, `reward`, `adjustment`.
2. **Tabela `credit_transactions`**  
   - Novo campo `source credit_source_enum @default(monetary)`.  
   - Usar `metadata` para detalhar campanha/motivo quando aplicável.
3. **Tabela `ledger_entries`**  
   - Incluir `credit_source credit_source_enum` para alinhar com o lançamento contábil.  
   - Opcional: garantir `metadata` ou referência ao motivo.
4. **Backfill**  
   - Script (migration + SQL) marcando transações existentes como `monetary`.  
   - Validar consistência entre `credit_transactions` e `ledger_entries`.

## Fluxos de Processamento
- **Asaas / InfinitePay**  
  - Na criação do job (`jobPayload`), incluir `source: 'monetary'`.  
  - Worker insere `credit_transactions`/`ledger_entries` com esse valor.
- **Concessão de Cashback/Recompensa**  
  - Nova rota/admin job (`POST /api/admin/credits`) restrita a administradores.  
  - Payload mínimo: `{ userId, credits, source: 'reward', reason, metadata }`.  
  - Worker reutilizado: ao receber `source = reward`, credita normalmente e registra no ledger.  
  - Permitir agendamento/expiração via `metadata` se necessário (sem alterar saldo principal).
- **Ajustes Manuais**  
  - Usar `source = adjustment` para correções contábeis.  
  - Requer motivo obrigatório e possivelmente aprovação dupla (guardado em `metadata`).

## Métricas e Relatórios
- Atualizar endpoints internos para expor totais agrupados por origem (ex.: `totalMonetary`, `totalReward`).  
- Criar consultas Supabase/DB para o board financeiro sumarizar `credits_purchased` e `amount_paid` segmentados por `source`.
- No front-end (opcional), exibir uma etiqueta “Cashback” no histórico quando `source = reward`, mantendo o mesmo saldo.

## Governança e Segurança
- Endpoints de recompensa apenas para usuários com `role = 'admin'`.  
- Registrar operador, motivo e timestamp em `metadata`.  
- Considerar alertas/auditoria automática para lançamentos `reward` acima de limite definido.

## Checklist Executivo
1. Aprovar o schema Prisma + migração SQL (enum, campos novos e backfill).  
2. Atualizar worker/funções SQL para ler o novo campo `source`.  
3. Criar rota/admin para concessão de créditos e conectá-la à fila PGMQ.  
4. Ajustar relatórios internos e, se desejado, etiqueta visual no histórico.  
5. Validar dados pós-backfill com o financeiro e documentar o processo operacional.

