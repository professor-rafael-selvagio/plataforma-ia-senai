# Block Users, Server Resources Dashboard & Token Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o bloqueio e desbloqueio de usuários com auditoria completa; atualizar o NIF do superadministrador para process.env.SUPERADMIN_NIF; tornar os cards da Visão Geral clicáveis (com gráficos detalhados de tokens de entrada vs. saída e dia de pico); e criar uma 5ª aba dedicada para monitoramento em tempo real dos recursos do servidor (CPU, Memória RAM e Armazenamento).

**Architecture:**
- **PostgreSQL / Migrações**:
  - Atualização do NIF do superadministrador `process.env.SUPERADMIN_EMAIL` para `'process.env.SUPERADMIN_NIF'`.
  - Adição da coluna `is_blocked boolean default false` em `auth.users`.
- **Backend (Express + TypeScript)**:
  - `PATCH /api/admin/users/:id/block`: ativa/desativa bloqueio de acesso e gera logs `USER_BLOCK` / `USER_UNBLOCK`.
  - Barramento imediato em `login` e `authMiddleware` com código 403 Forbidden caso o usuário esteja bloqueado.
  - Proteção garantida para que o superadmin `process.env.SUPERADMIN_EMAIL` não possa ser bloqueado.
  - `GET /api/admin/tokens/analytics`: agregação diária de tokens de entrada vs saída, dia de pico e métricas de uso.
  - `GET /api/admin/system-resources`: leitura de CPU (`os.cpus`, loadavg), Memória (`os.totalmem`, `os.freemem`) e Disco (`fs.promises.statfs`).
- **Frontend (React + Tailwind CSS)**:
  - Visão Geral com cards clicáveis redirecionando para Usuários, Online, Lixeira e abrindo a visão de Tokens.
  - Análise de Tokens com comparativo Entrada vs. Saída, dia de maior consumo e timeline diária.
  - Tabela de Usuários com status e botão de Bloquear/Desbloquear.
  - Nova 5ª aba dedicada: **"Recursos do Servidor"** com medidores visuais em tempo real (CPU, RAM, Disco e Uptime).

**Tech Stack:** TypeScript, Node.js (`os`, `fs.promises.statfs`), Express, PostgreSQL, Vitest, React, Tailwind CSS, Lucide React.

---

## Global Constraints
- `process.env.SUPERADMIN_EMAIL` tem NIF fixado em `process.env.SUPERADMIN_NIF` e nunca pode ser bloqueado nem rebaixado.
- Usuários bloqueados não conseguem efetuar login nem utilizar tokens JWT ativos (retorna 403 Forbidden).
- Qualquer bloqueio ou desbloqueio deve gerar log no serviço de auditoria (`audit_logs`).
- Todas as rotas de sistema e administração são protegidas por `adminMiddleware` (401/403).
- 100% de aprovação na suíte de testes automatizados (`npm test`).

---

## Tasks

### Task 1: Banco de Dados, NIF do Superadmin e Coluna `is_blocked`
- [x] Atualizar `servidor/supabase/migrations/20261106_create_chat_tables.sql` e `servidor/backend/src/config/database.ts`:
  - Adicionar coluna `is_blocked boolean default false` em `auth.users`.
  - Definir `nif = 'process.env.SUPERADMIN_NIF'` para `process.env.SUPERADMIN_EMAIL`.
- [x] Atualizar tipos em `servidor/backend/src/types/index.ts`:
  - Adicionar `is_blocked?: boolean` em `AuthUser` e `AdminUserSummary`.
  - Adicionar interfaces `SystemResourcesResponse` e `TokenAnalyticsResponse`.

### Task 2: Bloqueio/Desbloqueio de Usuários no Backend
- [x] Atualizar `servidor/backend/src/schemas/admin.schema.ts`:
  - Criar `blockUserSchema = z.object({ is_blocked: z.boolean() })`.
- [x] Atualizar `servidor/backend/src/services/admin.service.ts`:
  - Adicionar método `blockUser(adminUserId: string, targetUserId: string, isBlocked: boolean): Promise<AdminUserSummary>`.
  - Impedir bloqueio de `process.env.SUPERADMIN_EMAIL` com `ForbiddenError`.
  - Registrar log `USER_BLOCK` ou `USER_UNBLOCK` no `getAuditService()`.
  - Atualizar `getUsers()` para retornar `is_blocked`.
- [x] Atualizar `servidor/backend/src/controllers/admin.controller.ts` e `servidor/backend/src/routes/admin.routes.ts`:
  - Rota `PATCH /api/admin/users/:id/block`.
- [x] Atualizar `servidor/backend/src/services/auth.service.ts` e `servidor/backend/src/middlewares/auth.middleware.ts`:
  - Rejeitar login se `is_blocked === true` com 403 Forbidden.
  - Rejeitar requisições em `authMiddleware` se usuário estiver bloqueado.

### Task 3: Endpoints de Recursos do Servidor e Análise de Tokens
- [x] Criar serviço ou métodos em `servidor/backend/src/services/admin.service.ts`:
  - `getSystemResources()`: captura CPU, Memória RAM (`os.totalmem`, `os.freemem`), Disco (`fs.promises.statfs('/')`) e Uptime.
  - `getTokenAnalytics()`: agregação diária de prompt_tokens, completion_tokens e identificação do dia de pico.
- [x] Atualizar `servidor/backend/src/controllers/admin.controller.ts` e `servidor/backend/src/routes/admin.routes.ts`:
  - `GET /api/admin/system-resources`.
  - `GET /api/admin/tokens/analytics`.

### Task 4: Testes Automatizados no Backend
- [x] Atualizar e expandir `servidor/backend/tests/admin.test.ts`:
  - Testar bloqueio de usuário comum e verificação do status `is_blocked: true`.
  - Testar desbloqueio de usuário comum.
  - Testar tentativa de bloquear `process.env.SUPERADMIN_EMAIL` (deve retornar 403 Forbidden).
  - Testar que usuário bloqueado não consegue fazer login (retorna 403).
  - Testar endpoint `GET /api/admin/system-resources` (retorna cpu, memory, disk, uptime).
  - Testar endpoint `GET /api/admin/tokens/analytics` (retorna breakdown diário e pico).
- [x] Executar `npm test` para garantir 100% de aprovação.

### Task 5: Frontend - Tipos e Métodos de API
- [x] Atualizar `servidor/frontend/src/types/index.ts`:
  - Adicionar `is_blocked?: boolean` em `User` e `AdminUser`.
  - Adicionar tipos `SystemResources` e `TokenAnalytics`.
- [x] Atualizar `servidor/frontend/src/services/api.ts`:
  - Adicionar `api.admin.blockUser(userId, isBlocked)`.
  - Adicionar `api.admin.getSystemResources()`.
  - Adicionar `api.admin.getTokenAnalytics()`.

### Task 6: Frontend - Cards Interativos e Análise Detalhada de Tokens
- [x] Atualizar `servidor/frontend/src/pages/AdminDashboard.tsx`:
  - Tornar os 4 cards da aba "Visão Geral" clicáveis:
    - "Usuários Cadastrados": ativa aba `users` e filtro `all`.
    - "Online Agora": ativa aba `users` e filtro `online`.
    - "Itens na Lixeira": ativa aba `trash`.
    - "Tokens Totais": abre modal/seção analítica com gráfico de barras Entrada vs Saída, indicador do dia de maior consumo e histórico diário.

### Task 7: Frontend - Bloqueio/Desbloqueio na Tabela de Usuários
- [x] Atualizar `servidor/frontend/src/pages/AdminDashboard.tsx`:
  - Adicionar badge de status "Bloqueado" quando `u.is_blocked`.
  - Adicionar botão de ação "Bloquear" / "Desbloquear" com confirmação.
  - Desabilitar opção de bloqueio para o superadmin `process.env.SUPERADMIN_EMAIL`.

### Task 8: Frontend - 5ª Aba Dedicada "Recursos do Servidor"
- [x] Atualizar `servidor/frontend/src/pages/AdminDashboard.tsx`:
  - Adicionar aba "Recursos do Servidor" no menu superior.
  - Renderizar painel completo com:
    - Card de CPU: porcentagem, barra de progresso colorida, modelo do processador e núcleos.
    - Card de Memória RAM: total em GB, utilizada em GB, livre em GB, barra de progresso.
    - Card de Armazenamento (Disco): total em GB, usado em GB, disponível em GB e porcentagem.
    - Card de Uptime e Informações do Sistema Operacional.
  - Polling dinâmico para atualização em tempo real.

### Task 9: Verificação, Compilação e Entrega
- [x] Executar `npm test` no backend.
- [x] Executar `npm run build` no backend.
- [x] Executar `npm run build` no frontend.
- [x] Commit e push para o repositório GitHub (`origin main`).
