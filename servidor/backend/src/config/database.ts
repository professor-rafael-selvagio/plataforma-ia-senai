import { Pool } from "pg";
import { env } from "./env";
import { logger } from "../utils/logger";

let poolInstance: Pool | null = null;

if (env.DATABASE_URL) {
  try {
    poolInstance = new Pool({
      connectionString: env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    poolInstance.on("error", (err) => {
      logger.error("Erro inesperado no pool do PostgreSQL", err);
    });

    logger.info("Pool de conexão PostgreSQL inicializado com sucesso.");
  } catch (err) {
    logger.error("Falha ao inicializar pool do PostgreSQL", err as Error);
  }
}

export function getDbPool(): Pool | null {
  return poolInstance;
}

export function setDbPoolForTesting(pool: Pool | null): void {
  poolInstance = pool;
}

/**
 * Executa as migrações automáticas e idempotentes para garantir que todas
 * as tabelas (users, projects, conversations, messages), colunas e índices existam.
 */
export async function initializeDatabase(pool: Pool): Promise<void> {
  logger.info("Verificando e sincronizando schema do PostgreSQL...");
  const migrationSql = `
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE SCHEMA IF NOT EXISTS auth;

    CREATE TABLE IF NOT EXISTS auth.users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text UNIQUE NOT NULL,
        password_hash text,
        raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
        user_type text NOT NULL DEFAULT 'aluno' CHECK (user_type IN ('aluno', 'funcionario')),
        ra text,
        cpf text,
        nif text,
        is_admin boolean NOT NULL DEFAULT false,
        is_superadmin boolean NOT NULL DEFAULT false,
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz DEFAULT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    );

    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_admin'
        ) THEN
            ALTER TABLE auth.users ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'last_seen_at'
        ) THEN
            ALTER TABLE auth.users ADD COLUMN last_seen_at timestamptz NOT NULL DEFAULT now();
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'user_type'
        ) THEN
            ALTER TABLE auth.users ADD COLUMN user_type text NOT NULL DEFAULT 'aluno';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'ra'
        ) THEN
            ALTER TABLE auth.users ADD COLUMN ra text;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'cpf'
        ) THEN
            ALTER TABLE auth.users ADD COLUMN cpf text;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'nif'
        ) THEN
            ALTER TABLE auth.users ADD COLUMN nif text;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'deleted_at'
        ) THEN
            ALTER TABLE auth.users ADD COLUMN deleted_at timestamptz DEFAULT NULL;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_blocked'
        ) THEN
            ALTER TABLE auth.users ADD COLUMN is_blocked boolean DEFAULT false;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_superadmin'
        ) THEN
            ALTER TABLE auth.users ADD COLUMN is_superadmin boolean DEFAULT false;
        END IF;
    END $$;

    -- Índices únicos parciais para evitar duplicidade de RA, CPF e NIF
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unique_ra ON auth.users (lower(ra)) WHERE ra IS NOT NULL AND deleted_at IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unique_cpf ON auth.users (lower(cpf)) WHERE cpf IS NOT NULL AND deleted_at IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unique_nif ON auth.users (lower(nif)) WHERE nif IS NOT NULL AND deleted_at IS NULL;

    CREATE TABLE IF NOT EXISTS public.projects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        name text NOT NULL,
        description text,
        color text NOT NULL DEFAULT '#3B82F6',
        deleted_at timestamptz DEFAULT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    );

    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'deleted_at'
        ) THEN
            ALTER TABLE public.projects ADD COLUMN deleted_at timestamptz DEFAULT NULL;
        END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS public.conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
        title text NOT NULL DEFAULT 'Nova Conversa',
        model text NOT NULL,
        deleted_at timestamptz DEFAULT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
    );

    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'project_id'
        ) THEN
            ALTER TABLE public.conversations ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'deleted_at'
        ) THEN
            ALTER TABLE public.conversations ADD COLUMN deleted_at timestamptz DEFAULT NULL;
        END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS public.messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        role text NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
        content text NOT NULL,
        tokens integer,
        prompt_tokens integer DEFAULT 0,
        completion_tokens integer DEFAULT 0,
        deleted_at timestamptz DEFAULT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
    );

    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'prompt_tokens'
        ) THEN
            ALTER TABLE public.messages ADD COLUMN prompt_tokens integer DEFAULT 0;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'completion_tokens'
        ) THEN
            ALTER TABLE public.messages ADD COLUMN completion_tokens integer DEFAULT 0;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'deleted_at'
        ) THEN
            ALTER TABLE public.messages ADD COLUMN deleted_at timestamptz DEFAULT NULL;
        END IF;
    END $$;

    -- Tabela de Auditoria do Sistema
    CREATE TABLE IF NOT EXISTS public.audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
        user_email text,
        action text NOT NULL,
        resource_type text NOT NULL,
        resource_id text,
        details jsonb DEFAULT '{}'::jsonb,
        ip_address text,
        created_at timestamptz NOT NULL DEFAULT now()
    );

    -- Tabela de Histórico de Métricas e Recursos do Servidor
    CREATE TABLE IF NOT EXISTS public.server_metrics_history (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        cpu_usage_percent numeric NOT NULL,
        cpu_cores integer NOT NULL,
        memory_total_bytes bigint NOT NULL,
        memory_used_bytes bigint NOT NULL,
        memory_usage_percent numeric NOT NULL,
        disk_total_bytes bigint NOT NULL,
        disk_used_bytes bigint NOT NULL,
        disk_usage_percent numeric NOT NULL,
        uptime_seconds bigint NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_server_metrics_history_created_at ON public.server_metrics_history(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON public.projects(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at ON public.conversations(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_messages_deleted_at ON public.messages(deleted_at);

    CREATE INDEX IF NOT EXISTS idx_users_email ON auth.users(email);
    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
    CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON public.conversations(project_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
  `;

  await pool.query(migrationSql);
  logger.info("Schema do PostgreSQL sincronizado com sucesso!");
}

