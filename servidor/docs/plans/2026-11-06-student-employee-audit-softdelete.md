# Student/Employee Categorization, Soft Delete, Audit Logs & Admin Trash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar cadastro de Aluno (RA ou CPF obrigatório) e Funcionário (NIF obrigatório) com garantia de unicidade; exclusão lógica (*soft delete*) em todo o sistema; registro de auditoria persistente (*audit_logs*) para todas as ações; aba exclusiva do Administrador protegida contra acesso não autorizado para visualização e restauração de itens excluídos; e expansão do dashboard administrativo com métricas detalhadas.

**Architecture:**
- **PostgreSQL / Migrações**:
  - `auth.users`: colunas `user_type text check (user_type in ('aluno', 'funcionario'))`, `ra text`, `cpf text`, `nif text`, `deleted_at timestamptz`.
  - Índices únicos parciais no PostgreSQL: `ra`, `cpf`, `nif` únicos para registros não nulos.
  - `public.projects`, `public.conversations`, `public.messages`: coluna `deleted_at timestamptz default null`.
  - `public.audit_logs`: tabela estruturada para registrar todas as ações (autenticação, criação, exclusão, restauração, alteração de permissões).
- **Backend (Express + TypeScript)**:
  - Validação Zod estrita para Aluno vs. Funcionário no registro.
  - Atualização dos repositórios de Projetos e Conversas para realizar `UPDATE ... SET deleted_at = now()` em vez de `DELETE`.
  - Filtros nas consultas normais do usuário: `WHERE deleted_at IS NULL`.
  - Serviço de Auditoria `audit.service.ts` para registrar eventos automaticamente.
  - Endpoints administrativos protegidos por `adminMiddleware`:
    - `GET /api/admin/deleted`: lista conversas e projetos excluídos.
    - `POST /api/admin/restore`: restaura item excluído logicamente.
    - `GET /api/admin/audit-logs`: consulta histórico de ações.
    - `GET /api/admin/metrics`: métricas atualizadas (Alunos vs. Funcionários, excluídos vs. ativos, tokens).
- **Frontend (React + Tailwind CSS)**:
  - `RegisterPage.tsx`: seletor dinâmico Aluno / Funcionário com campos condicionais e validações.
  - `AdminDashboard.tsx`: abas exclusivas (Visão Geral, Usuários com RA/NIF, Lixeira do Sistema com restauração, Trilha de Auditoria). Acesso estritamente barrado a não-admins.

**Tech Stack:** TypeScript, Node.js, Express, PostgreSQL, Vitest, React, Tailwind CSS, Lucide React.

---

## Global Constraints
- `process.env.SUPERADMIN_EMAIL` é superadministrador garantido e classificado como Funcionário.
- Aluno deve obrigatoriamente fornecer RA ou CPF; Funcionário deve obrigatoriamente fornecer NIF.
- Nenhum usuário pode compartilhar o mesmo RA, CPF ou NIF no sistema.
- Exclusões nunca apagam fisicamente linhas do banco (*soft delete* com `deleted_at`).
- Não-administradores nunca têm acesso aos endpoints administrativos nem à aba de lixeira (retorna 403 Forbidden).
- Cobertura de 100% de aprovação na suíte de testes automatizados (`npm test`).

---

## Tasks

### Task 1: Migrações no Banco de Dados e Schemas
- [x] Atualizar `servidor/supabase/migrations/20261106_create_chat_tables.sql` e `servidor/backend/src/config/database.ts`:
  - Adicionar colunas `user_type`, `ra`, `cpf`, `nif`, `deleted_at` em `auth.users`.
  - Criar índices de unicidade parciais para `ra`, `cpf` e `nif`.
  - Adicionar coluna `deleted_at` em `public.projects`, `public.conversations` e `public.messages`.
  - Criar tabela `public.audit_logs`.
- [x] Atualizar tipos em `servidor/backend/src/types/index.ts`:
  - `UserType`: `'aluno' | 'funcionario'`.
  - Campos `user_type`, `ra`, `cpf`, `nif`, `deleted_at` em `AuthUser`, `Project`, `Conversation`, `DatabaseMessage`.
  - Interfaces `AuditLogEntry`, `AdminDeletedItem`, `RestoreItemInput`.

### Task 2: Validação de Cadastro e Verificação de Unicidade
- [x] Atualizar `servidor/backend/src/schemas/auth.schema.ts`:
  - Suporte a `user_type`, `ra`, `cpf`, `nif` com validações cruzadas (`superRefine`).
- [x] Atualizar `servidor/backend/src/services/auth.service.ts`:
  - Validar duplicidade de RA, CPF ou NIF antes de cadastrar.
  - Persistir campos no banco de dados e no serviço em memória.
  - Gravar evento de auditoria no cadastro.

### Task 3: Serviço de Auditoria (`audit.service.ts`)
- [x] Criar `servidor/backend/src/services/audit.service.ts`:
  - Interface `IAuditService` com `log()` e `getLogs()`.
  - Implementações `PostgresAuditService` e `InMemoryAuditService`.
  - Integrar chamadas de auditoria nos serviços de autenticação, administração e conversas.

### Task 4: Exclusão Lógica em Projetos e Conversas
- [x] Atualizar `servidor/backend/src/services/conversation.service.ts`:
  - `deleteConversation`: definir `deleted_at = now()`.
  - Listagem e consultas de mensagens: filtrar `deleted_at IS NULL`.
- [x] Atualizar `servidor/backend/src/services/project.service.ts`:
  - `deleteProject`: definir `deleted_at = now()` para o projeto e suas conversas.
  - Listagens: filtrar `deleted_at IS NULL`.

### Task 5: Endpoints Administrativos de Lixeira, Restauração e Auditoria
- [x] Atualizar `servidor/backend/src/services/admin.service.ts`:
  - `getDeletedItems()`: lista projetos e conversas com `deleted_at IS NOT NULL`.
  - `restoreItem(resourceType, resourceId)`: redefine `deleted_at = null`.
  - `getMetrics()`: inclui estatísticas de Alunos vs. Funcionários e contagem de itens excluídos.
- [x] Atualizar `servidor/backend/src/controllers/admin.controller.ts` e `servidor/backend/src/routes/admin.routes.ts`:
  - Adicionar `GET /api/admin/deleted`.
  - Adicionar `POST /api/admin/restore`.
  - Adicionar `GET /api/admin/audit-logs`.

### Task 6: Testes Automatizados no Backend
- [x] Atualizar e expandir `servidor/backend/tests/auth.test.ts`:
  - Testar cadastro de Aluno com RA e com CPF.
  - Testar cadastro de Funcionário com NIF.
  - Testar rejeição de RA, CPF ou NIF duplicado com erro 400.
  - Testar rejeição de Aluno sem RA/CPF e Funcionário sem NIF.
- [x] Atualizar e expandir `servidor/backend/tests/admin.test.ts`:
  - Testar exclusão lógica de conversa/projeto (some da listagem normal).
  - Testar consulta de itens excluídos via `GET /api/admin/deleted`.
  - Testar restauração de item excluído via `POST /api/admin/restore` (reaparece na listagem normal).
  - Testar registro e listagem de logs de auditoria via `GET /api/admin/audit-logs`.
  - Testar bloqueio 401/403 para não-admins.

### Task 7: Frontend - Tela de Cadastro (`RegisterPage.tsx`)
- [x] Atualizar `servidor/frontend/src/pages/RegisterPage.tsx`:
  - Seleção de Perfil: Aluno vs. Funcionário com visual moderno em tabs/cards.
  - Para Aluno: toggle RA ou CPF com campo obrigatório.
  - Para Funcionário: campo NIF obrigatório.
  - Exibição amigável de erros de validação e unicidade.
- [x] Atualizar `servidor/frontend/src/types/index.ts` e `servidor/frontend/src/services/api.ts`:
  - Enviar dados cadastrais e expor métodos `api.admin.getDeleted()`, `api.admin.restoreItem()`, `api.admin.getAuditLogs()`.

### Task 8: Frontend - Aba Exclusiva de Lixeira e Auditoria no AdminDashboard
- [x] Atualizar `servidor/frontend/src/pages/AdminDashboard.tsx`:
  - Sistema de abas no painel:
    1. **Métricas & Visão Geral** (incluindo distribuição Alunos vs. Funcionários e cards de Lixeira).
    2. **Usuários** (com colunas de Perfil, RA/CPF/NIF, online e ações de admin).
    3. **Lixeira do Sistema (Exclusiva Admin)**: Tabela de conversas e projetos excluídos com botão de **"Restaurar"**.
    4. **Trilha de Auditoria**: Tabela em tempo real com ações realizadas no sistema.
  - Proteção de acesso: se usuário não for admin, bloqueia e redireciona ao chat.

### Task 9: Verificação, Compilação e Entrega
- [x] Executar suíte completa de testes no backend (`npm test` - 80/80 passando).
- [x] Executar compilação do backend TypeScript (`npm run build` - 0 erros).
- [x] Executar compilação do frontend Vite (`npm run build` - 0 erros).
- [ ] Commit e push para o repositório GitHub (`origin main`).
