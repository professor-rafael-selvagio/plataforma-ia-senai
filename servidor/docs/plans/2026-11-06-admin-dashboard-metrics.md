# Admin Dashboard & Token Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar uma página dedicada de Painel de Controle Administrativo (com acesso exclusivo para `superadministrador (banco de dados)` e administradores nomeados), gestão de permissões de administrador, monitoramento de usuários online em tempo real, métricas consolidadas de consumo de tokens (entrada e saída), e inclusão discreta dos créditos autorais nas telas de login e chat.

**Architecture:**
- **Banco de Dados (PostgreSQL / Supabase)**: Adicionar suporte a `is_admin` e `last_seen_at` na tabela `auth.users`. Garantir que `superadministrador (banco de dados)` seja sempre inicializado como administrador.
- **Armazenamento de Tokens**: Ao interagir com o Ollama, persistir `prompt_tokens` (tokens de entrada) e `completion_tokens` (tokens de saída) para cálculo consolidado por usuário e geral.
- **Backend (Express + TypeScript)**:
  - Middleware `adminMiddleware` para proteção estrita de endpoints administrativos.
  - Endpoints em `/api/admin`:
    - `GET /api/admin/metrics`: Total de usuários, online agora, tokens de entrada, tokens de saída, conversas e mensagens.
    - `GET /api/admin/users`: Listagem de usuários com status online/offline, papel (admin/usuário) e tokens consumidos.
    - `PATCH /api/admin/users/:id/role`: Concessão e revogação de permissão administrativa (com trava de segurança para o superadmin).
    - `POST /api/auth/heartbeat`: Atualização de atividade do usuário para cálculo de status online.
- **Frontend (React + Tailwind CSS + Lucide Icons)**:
  - Página dedicada `AdminDashboard.tsx` com KPIs (tokens de entrada/saída, usuários online, etc.), busca/filtro e ações de permissão.
  - Botão no `Sidebar.tsx` visível apenas para administradores para alternar entre Chat e Painel Admin.
  - Créditos discretos no rodapé da `LoginPage.tsx` e abaixo da área de digitação em `ChatInput.tsx` / `ChatArea.tsx`: *"Desenvolvido pelo Prof. Esp. Rafael de Sena Selvagio, utilizando IA."*

**Tech Stack:** TypeScript, Node.js, Express, PostgreSQL, Vitest, React, Tailwind CSS, Lucide React.

**Spec:** Requisitos do usuário informados na conversa de 06/11/2026.

---

## Global Constraints
- `superadministrador (banco de dados)` tem papel de administrador garantido nativamente no sistema.
- Superadministrador principal não pode ser rebaixado para evitar travamento do painel.
- O tema segue a paleta vermelha SENAI (`brand-600` / `rose-400` / `slate-950`).
- Compatibilidade total tanto com PostgreSQL local quanto com serviço em memória para testes.
- Cobertura de 100% de aprovação na suíte de testes automatizados (`npm test`).

---

## Tasks

### Task 1: Migração do Banco de Dados e Serviços de Armazenamento
- [x] Atualizar `servidor/supabase/migrations/20261106_create_chat_tables.sql` e `servidor/backend/src/config/database.ts`:
  - Adicionar colunas `is_admin BOOLEAN NOT NULL DEFAULT false` e `last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()` em `auth.users`.
  - Adicionar colunas `prompt_tokens INTEGER DEFAULT 0` e `completion_tokens INTEGER DEFAULT 0` em `public.messages`.
  - Criar gatilho/update para garantir que `email = 'superadministrador (banco de dados)'` receba `is_admin = true`.
- [x] Atualizar tipos TypeScript em `servidor/backend/src/types/index.ts`:
  - `AuthUser`: incluir `is_admin?: boolean`, `last_seen_at?: string`.
  - Criar interfaces `AdminUserSummary`, `AdminMetricsResponse` e `UpdateUserRoleInput`.

### Task 2: Atualização de Rastreamento de Tokens e Heartbeat
- [x] Atualizar `servidor/backend/src/services/conversation.service.ts`:
  - Ao registrar mensagens do chat, gravar `prompt_tokens` (a partir de `aiResponse.prompt_eval_count`) e `completion_tokens` (a partir de `aiResponse.eval_count`).
- [x] Atualizar `servidor/backend/src/middlewares/auth.middleware.ts`:
  - Atualizar `last_seen_at = now()` para o usuário autenticado na requisição.
  - Propagar `is_admin` em `req.user`.
- [x] Criar endpoint `POST /api/auth/heartbeat` para sinalização periódica de atividade pelo frontend.

### Task 3: Middleware e Serviço de Administração no Backend
- [x] Criar `servidor/backend/src/middlewares/admin.middleware.ts`:
  - Validar se `req.user` possui `is_admin === true` ou `email === 'superadministrador (banco de dados)'`; caso contrário, retornar `403 Forbidden`.
- [x] Criar `servidor/backend/src/services/admin.service.ts`:
  - `getMetrics()`: Total de usuários, usuários online (< 3 min), total de conversas, total de mensagens, soma de tokens de entrada e saída.
  - `getUsers()`: Lista de todos os usuários com status online/offline, dados cadastrais e tokens consumidos.
  - `updateUserRole(adminUserId, targetUserId, isAdmin)`: Atualiza `is_admin` do usuário, impedindo auto-revogação de `superadministrador (banco de dados)`.
- [x] Implementar versões do serviço para PostgreSQL e para o modo InMemory (usado nos testes).

### Task 4: Controladores, Rotas e Testes de Backend
- [x] Criar `servidor/backend/src/controllers/admin.controller.ts` e `servidor/backend/src/routes/admin.routes.ts`:
  - Integrar rotas `/api/admin/metrics`, `/api/admin/users`, `/api/admin/users/:id/role`.
  - Registrar rotas no `servidor/backend/src/app.ts`.
- [x] Criar suíte de testes `servidor/backend/tests/admin.test.ts`:
  - Bloqueio 401 para requisição sem token.
  - Bloqueio 403 para usuário autenticado comum.
  - Sucesso 200 para `superadministrador (banco de dados)` ou usuários administradores.
  - Testar concessão e revogação de permissão administrativa.
  - Testar retorno correto das métricas e contagem de tokens de entrada/saída.
- [x] Executar `npm test` e `npm run build` no backend.

### Task 5: Camada de API e Contexto no Frontend
- [x] Atualizar `servidor/frontend/src/types/index.ts`:
  - Adicionar campos `is_admin` no `User`.
  - Definir interfaces `AdminUser` e `AdminMetrics`.
- [x] Atualizar `servidor/frontend/src/services/api.ts`:
  - Adicionar métodos em `api.admin`: `getMetrics()`, `getUsers()`, `updateUserRole(userId, isAdmin)`.
  - Adicionar método `api.auth.heartbeat()`.
- [x] Atualizar `servidor/frontend/src/context/AuthContext.tsx`:
  - Iniciar timer de heartbeat a cada 60s quando usuário estiver autenticado.
  - Expor helper `isAdmin: boolean`.

### Task 6: Tela Dedicada AdminDashboard e Integração de Navegação
- [x] Criar componente `servidor/frontend/src/pages/AdminDashboard.tsx`:
  - Cabeçalho com botão para voltar ao Chat, título "Painel de Controle do Administrador" e botão de atualizar dados.
  - Grid de KPI Cards: Total de Usuários, Usuários Online (com badge pulsante), Tokens de Entrada (Prompt), Tokens de Saída (Completion), Total de Conversas.
  - Tabela de Usuários com busca por nome/email e filtro de status (Todos / Apenas Online).
  - Ações para alternar papel de Administrador com confirmação e feedback visual imediato.
- [x] Atualizar `servidor/frontend/src/components/Sidebar.tsx`:
  - Se o usuário for administrador (`user.is_admin || user.email === 'superadministrador (banco de dados)'`), exibir botão de acesso rápido "Painel de Controle" com ícone de escudo.
- [x] Atualizar `servidor/frontend/src/App.tsx`:
  - Gerenciar alternância de tela entre `"chat"` e `"admin"`.

### Task 7: Crédito Discreto nas Telas de Login e Chat
- [x] Atualizar `servidor/frontend/src/pages/LoginPage.tsx` e `RegisterPage.tsx`:
  - Adicionar no rodapé texto discreto: *"Desenvolvido pelo Prof. Esp. Rafael de Sena Selvagio, utilizando IA."*
- [x] Atualizar `servidor/frontend/src/components/ChatInput.tsx` (ou rodapé do chat):
  - Inserir linha sutil no rodapé inferior com a mesma frase institucional.

### Task 8: Verificação, Compilação e Entrega
- [x] Executar suíte completa de testes no backend (`npm test`).
- [x] Executar compilação do backend (`npm run build`).
- [x] Executar compilação do frontend (`npm run build`).
- [x] Commit e push para o repositório GitHub (`origin main`).
