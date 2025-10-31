# Plano de Implementação — Leilões em Lote para Leads `low_frozen`

## Visão Geral
- **Objetivo**: criar um fluxo que, ao atingir uma quantidade configurável de leads `low_frozen`, gere automaticamente um leilão em lote com esses leads.
- **Escopo**: ajustes de banco, APIs (admin + job), frontend do painel administrativo e observabilidade.
- **Cuidados principais**: impedir reprocessamento de leads já incluídos em lote, garantir que o cálculo do valor do lote respeite o preço fixo de R$225 por lead e manter retrocompatibilidade com os leilões individuais criados pelos gatilhos existentes.

## Requisitos Funcionais
- Permitir que um administrador configure:
  - quantidade mínima de leads `low_frozen` que dispara a criação de lote;
  - habilitação/desabilitação da execução automática (trigger) e acionamento manual.
- Cada lote deve:
  - aparecer no marketplace atual, aceitar lances normalmente e seguir o fluxo padrão de leilões;
  - calcular `minimum_bid` como `quantidade_de_leads * 225`;
  - disponibilizar todos os leads ao vencedor na aba "Meus leads".
- Incluir apenas leads `low_frozen` que nunca participaram de um lote e, ao criar o lote, atualizar seus status para `cold`.
- Após o encerramento:
  - se houver vencedor, todos os leads do lote passam para `sold` e ficam registrados como vendidos em lote;
  - se não houver vencedor, todos retornam para `low_frozen` e voltam a ser elegíveis.
- Registrar todas as execuções (auto/manual) e os estados dos leads para auditoria e relatórios.
- Não permitir remover leads específicos de um lote antes da publicação.
- Manter os gatilhos atuais para leilões individuais (`hot`/`cold`) e evitar colisões com o novo fluxo.

## Modelagem & Banco de Dados

### Novas Entidades / Campos
1. **`batch_auction_settings`** (tabela ou extensão de uma tabela existente de configurações):
   - `id` (UUID) ou pk singleton;
   - `low_frozen_threshold` (INT);
   - `auto_trigger_enabled` (BOOLEAN);
   - `lead_unit_price` (NUMERIC) — default 225 para facilitar ajustes futuros;
   - `created_at` / `updated_at` + `updated_by` (admin).
2. **`batch_auctions`**:
   - `id` (UUID);
   - `total_leads` (INT);
   - `lead_unit_price` (NUMERIC);
   - `minimum_bid` (NUMERIC);
   - `status` (open/running/completed/cancelled);
   - `result` (sold/expired/pending);
   - `created_at`, `expired_at`, `closed_at`;
   - `trigger_reason` (auto vs manual);
   - `metadata` JSON (contagem inicial, notas de auditoria).
3. **`batch_auction_leads`** (tabela pivô):
   - `batch_auction_id` FK → `batch_auctions`;
   - `lead_id` FK → `leads`;
   - `included_at`;
   - `status_before_batch` (VARCHAR);
   - `final_status` (VARCHAR);
   - `sold_at` (TIMESTAMPTZ);
   - Unique constraint (`lead_id`) para impedir duplicidade em lote.
4. **Campos em `leads`**:
   - `batched_at` (TIMESTAMPTZ);
   - `batch_auction_id` nullable (último lote de que participou);
   - `batch_result` (VARCHAR) para histórico simples.

### Migrações & Índices
- Criar migração Prisma para as novas tabelas/campos (`prisma/migrations/202501130001_batch_auctions/migration.sql` já adicionada).
- Índice em `leads(status, batched_at NULL)` para rápido fetch de leads elegíveis.
- Índice em `leads(batch_auction_id)` para consultas de auditoria.
- Índices em `batch_auction_leads(lead_id)` e `(batch_auction_id)`.
- Eventual enum para `batch_auctions.status`.

### Triggers / Funções
- **Trigger de rotas individuais (`after_lead_change_create_auction`)**:
  - Garantir que updates para `low_frozen` não marquem o lead como elegível para o trigger atual.
  - Adicionar `PERFORM pg_notify('lead_low_frozen', NEW.id::text);` sempre que o status migrar para `low_frozen`.
- **Função de criação do lote**:
  - Reaproveitar o serviço Node (ver seção Backend) ou usar `SELECT` na função PostgreSQL para chamar `http` (caso seja tudo no banco).
  - Lógica mínima dentro do banco: inserir em uma fila (`batch_auction_queue`) ou atualizar uma flag para consumo externo.
- **Limpeza de metadados**:
  - Função auxiliar para limpar `batched_at`, `batch_auction_id` e `batch_result` quando um lead for retirado manualmente do fluxo (se aplicável).
- **Encerramento do lote**:
  - Função/worker que identifica lotes expirados e move leads para `sold` ou `low_frozen` conforme resultado, registrando `sold_at` e `final_status` em `batch_auction_leads`.

## Backend

### APIs/Admin
- **GET/PUT `/api/admin/batch-auctions/settings`**:
  - Recuperar e atualizar a configuração (threshold, `auto_trigger_enabled`, `lead_unit_price` read-only ou editável apenas por super admin).
  - Validação com Zod (limite mínimo, valores positivos etc.).
  - Controle de permissão (role admin).
- **POST `/api/admin/batch-auctions/run`**:
  - Permite disparo manual, opcionalmente com lista específica de leads.
  - Responde com batch criado ou mensagem de "nada elegível".

### Serviços/Domain
- Serviço `BatchAuctionService`:
  - `getEligibleLeads()` → busca leads `low_frozen` sem `batched_at` até o limite configurado.
  - `calculateMinimumBid(count, unitPrice)` → retorna `count * unitPrice` (225 por padrão).
  - `createBatchAuction(leads, settings, triggerReason)` → cria o batch (transação):
    - Insere em `batch_auctions` (`total_leads`, `lead_unit_price`, `minimum_bid`);
    - Insere linhas em `batch_auction_leads` com `status_before_batch`;
    - Atualiza `leads.status = 'cold'`, `batched_at`, `batch_auction_id` e `batch_result = 'pending'`.
- Serviço `BatchAuctionScheduler`:
  - Responsável por verificar, em intervalo (ex.: cron job ou cron API), se há quantidade suficiente.
  - Preferência: trigger `NOTIFY` + Edge Function Supabase (`supabase functions deploy batch-auctions`) que:
    1. Escuta o canal `lead_low_frozen`;
    2. Busca as configurações em `batch_auction_settings`;
    3. Faz `SELECT ... FOR UPDATE` em `leads` com status `low_frozen`, `batch_auction_id IS NULL`, ordenando por `created_at`;
    4. Se a contagem alcançar o threshold, chama `BatchAuctionService.createBatchAuction(leads, settings, 'auto')`;
    5. Retorna `release` caso não alcance o threshold (para não bloquear novas notificações).
  - Fallback: cron job na API/admin para rodar a cada X minutos caso o trigger não esteja disponível.
- Tratar idempotência:
  - Dentro da transação, revalidar contagem e marcar os leads selecionados (`SELECT ... FOR UPDATE`).
  - Guardar hash ou `lock` via advisory lock (`pg_advisory_xact_lock`) para evitar lote duplicado em execuções concorrentes.
- Serviço `BatchAuctionFinalizer`:
  - Reaproveita rotinas de expiração para atualizar `batch_auction_leads.final_status`, `sold_at` e revogar/reativar leads conforme resultado.
  - Gera eventos para auditoria (ex.: `batch_auction_sold`).
  - Job agendado (cron/Edge Function) roda a cada minuto para:
    1. Buscar lotes `status='open'` com `expired_at <= now()`;
    2. Checar bids em `auctions` para definir vencedor;
    3. Atualizar `batch_auctions.status/result`, além de `leads.status` e `batch_auction_leads.final_status`.

#### Fluxo Automático no Supabase (Detalhado)
1. **Trigger SQL** (`after_lead_low_frozen_notify`):
   ```sql
   CREATE OR REPLACE FUNCTION public.notify_low_frozen_lead()
   RETURNS trigger AS $$
   BEGIN
     IF NEW.status = 'low_frozen' AND (TG_OP = 'INSERT' OR OLD.status <> 'low_frozen') THEN
       PERFORM pg_notify('lead_low_frozen', NEW.id::text);
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER after_lead_low_frozen_notify
   AFTER INSERT OR UPDATE ON public.leads
   FOR EACH ROW EXECUTE FUNCTION public.notify_low_frozen_lead();
   ```
2. **Edge Function** (`batch-auctions/index.ts`):
   - Usa `supabaseClient.channel('lead_low_frozen').on('postgres_changes', ...)`.
   - Debounce eventos (ex.: agrega IDs por 30 segundos) e chama endpoint interno `/api/internal/batch-auctions/run-auto`.
3. **Endpoint interno**:
   - Lê `batch_auction_settings` (cache em memória com TTL).
   - Realiza uma transação:
     - `SELECT id FROM leads WHERE status='low_frozen' AND batch_auction_id IS NULL ORDER BY created_at ASC LIMIT threshold FOR UPDATE SKIP LOCKED;`
     - Se contagem < threshold → `ROLLBACK`.
     - Caso contrário → chama `createBatchAuction`.
4. **Observabilidade**:
   - Edge Function loga `lead_ids`, tempo de execução e resultado (lote criado vs aguardando threshold).
   - Métricas enviadas para Supabase Logs + Grafana (se disponível).

### Integração com Leilões Existentes
- Estender a tabela `auctions` com campo `type` (`single`/`batch`) e FK opcional `batch_auction_id` para reaproveitar toda a infraestrutura existente de bids/compras.
- Ajustar endpoints que listam leilões para incluir registros `type = 'batch'` (com `total_leads`, `lead_unit_price`, `minimum_bid`).
- Adaptar rotinas de expiração atuais para ler `auctions.type` e, quando `batch`, delegar ao `BatchAuctionFinalizer`.
- Garantir que APIs de "Meus leads" consigam expandir os itens do lote a partir de `batch_auction_leads`.

## Frontend

### Painel Administrativo
- Nova seção em `src/app/admin/...` (ver estrutura atual do painel):
  - Formulário com:
    - Input numérico para `low_frozen_threshold`;
    - Toggle para `auto_trigger_enabled`;
    - Campo somente leitura exibindo `lead_unit_price` (ou editável apenas para super admins);
    - Botão "Salvar".
  - Feedback visual (toasts) reutilizando componentes existentes.
- Card/listagem para lotes recentes:
  - Tabela com colunas: ID do lote, quantidade de leads, valor mínimo, criado em, status/result, acionamento (auto/manual).
  - Botão "Forçar criação agora" (chama POST manual) respeitando regras de idempotência.
- Atualizar qualquer dashboard que exiba métricas de `low_frozen` para refletir a nova lógica (ex.: contagem de leads elegíveis, lotes pendentes).

### Portal do Usuário
- Atualizar componentes de listagem para exibir lotes (`type = batch`) com informação de quantidade de leads, valor mínimo e regra de preço fixo.
- Adaptar `AuctionModal.tsx` para exibir a lista de leads pertencentes ao lote (nome, segmento etc.) e reforçar que o valor é `quantidade * R$225`.
- Garantir que fluxos de lance e confirmação funcionem sem alteração para o usuário; backend deve tratar o lote como uma única entidade.
- Atualizar seção "Meus leads" para expandir lotes ganhos e mostrar todos os leads associados (usando `batch_auction_leads`).
- Ajustar métricas ou badges que indicam lotes versus leilões individuais quando necessário.

## Observabilidade & Operação
- Logs estruturados para execuções automáticas e manuais (registrar `triggerReason`, IDs dos leads, `result`).
- Métricas básicas:
  - Número de lotes criados por período;
  - Tempo médio até consumir os leads `low_frozen`;
  - Contagem de leads sem lote (backlog) e leads vendidos em lote.
- Alertas: se fila de `low_frozen` ultrapassar threshold por muito tempo, disparar notificação.
- Auditoria: relatórios que cruzem `batch_auction_leads` com `batch_result` para comprovar quais leads foram vendidos em lote.
- Script de rollback de migração (remover colunas/tabelas) documentado.

## Testes
- **Unitários**:
  - Cálculo do `minimum_bid` com preço unitário fixo.
  - Serviço de seleção de leads (inclui/exclui corretamente).
- **Integração**:
  - Fluxo completo `settings → acumular leads → criar lote → atualizar status`.
  - Encerramento de lote vendido (todos para `sold` + auditoria).
  - Encerramento sem vencedor (retorno a `low_frozen` e reset de `batched_at`).
  - Idempotência em execuções paralelas (simular corridas).
- **E2E**:
  - Fluxo no painel admin (cypress/playwright) para configurar e disparar lote.
  - Usuário dando lance e ganhando lote (checagem em "Meus leads").
  - Caso de não haver leads elegíveis (sem lote criado).

## Decisões Confirmadas
- Lotes ficam visíveis para compradores e seguem o fluxo normal de lances.
- Preço unitário por lead em lote é fixo (R$225).
- Ao criar o lote, leads voltam para `cold`; após fechamento, vão para `sold` (com vencedor) ou retornam para `low_frozen`.
- Leads vendidos em lote precisam de trilha de auditoria dedicada.
- Não há remoção manual de leads específico antes da publicação.
- Execução deve ser automática via trigger/Supabase, com botão manual apenas como fallback.

## Próximos Passos Recomendados
1. Fechar arquitetura detalhada de integração com `auctions` (campos `type`, `batch_auction_id`, ajustes de queries).
2. Modelar e escrever migrações Prisma para novas tabelas/campos.
3. Implementar serviços/backend (settings, criação automática, finalização, auditoria).
4. Adaptar painel admin e portal do usuário para suportar lotes.
5. Criar bateria de testes automatizados e validar fluxo ponta a ponta em ambiente de homologação.
