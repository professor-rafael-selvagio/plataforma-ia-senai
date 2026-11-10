import { NextFunction, Request, Response } from "express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { getAuthService } from "../services/auth.service";
import { ForbiddenError, UnauthorizedError } from "../utils/errors";
import { logger } from "../utils/logger";

let supabaseClient: SupabaseClient | null = null;

/**
 * Permite injetar cliente mock do Supabase para testes automatizados
 */
export function setSupabaseClientForTesting(client: SupabaseClient | null): void {
  supabaseClient = client;
}

// Inicializa o cliente Supabase se as credenciais estiverem disponíveis
if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
  supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Middleware para validação rigorosa de autenticação via Supabase Auth.
 * Valida o JWT diretamente com a API do Supabase, garantindo que o token não
 * seja apenas aceito pela presença do header.
 */
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  // Se a autenticação estiver desabilitada explicitamente para testes locais
  if (!env.REQUIRE_AUTH && (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY)) {
    if (!authHeader) {
      req.user = {
        id: "local-developer",
        email: "dev@localhost",
        role: "authenticated",
      };
      return next();
    }
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(
      new UnauthorizedError("Token de autenticação ausente ou formato inválido. Use 'Bearer <token>'.")
    );
  }

  const token = authHeader.split(" ")[1];

  if (!token || token.trim().length === 0) {
    return next(new UnauthorizedError("Token de autenticação vazio."));
  }

  // Se o Supabase estiver configurado, valida o token com a API de autenticação
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.auth.getUser(token);

      if (error || !data.user) {
        logger.warn("Tentativa de acesso com token Supabase inválido ou expirado", {
          error: error?.message,
        });
        return next(new UnauthorizedError("Token de autenticação inválido ou expirado."));
      }

      const isSuperAdmin = Boolean(
        data.user.app_metadata?.is_superadmin ||
        data.user.user_metadata?.is_superadmin
      );

      const isAdmin = Boolean(
        isSuperAdmin ||
        data.user.app_metadata?.is_admin ||
        data.user.user_metadata?.is_admin
      );

      req.user = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || data.user.user_metadata?.full_name,
        role: data.user.role,
        is_admin: isAdmin,
        is_superadmin: isSuperAdmin,
        app_metadata: data.user.app_metadata,
        user_metadata: data.user.user_metadata,
      };

      try {
        getAuthService().recordActivity(req.user.id).catch(() => {});
      } catch {
        // noop
      }

      return next();
    } catch (err: unknown) {
      logger.error("Falha ao comunicar com o serviço de autenticação Supabase", err as Error);
      return next(new UnauthorizedError("Falha na validação do token com o provedor de autenticação."));
    }
  }

  // Se o PostgreSQL próprio estiver configurado via DATABASE_URL, valida o JWT com JWT_SECRET
  if (env.DATABASE_URL) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        sub: string;
        email: string;
        role?: string;
        name?: string;
        is_admin?: boolean;
        is_superadmin?: boolean;
      };

      const profile = await getAuthService().getProfile(decoded.sub).catch(() => null);
      if (profile?.is_blocked) {
        return next(new ForbiddenError("Sua conta de usuário foi bloqueada pelo administrador."));
      }

      const isSuperAdmin = Boolean(
        profile?.is_superadmin ||
        decoded.is_superadmin
      );

      const isAdmin = Boolean(
        isSuperAdmin ||
        profile?.is_admin ||
        decoded.is_admin
      );

      req.user = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name || undefined,
        role: decoded.role || "authenticated",
        is_admin: isAdmin,
        is_superadmin: isSuperAdmin,
        is_blocked: Boolean(profile?.is_blocked),
        user_metadata: { name: decoded.name },
      };

      try {
        getAuthService().recordActivity(req.user.id).catch(() => {});
      } catch {
        // noop
      }

      return next();
    } catch {
      logger.warn("Tentativa de acesso com token JWT inválido ou expirado");
      return next(new UnauthorizedError("Token de autenticação inválido ou expirado."));
    }
  }

  // Se REQUIRE_AUTH estiver ativo mas não houver cliente Supabase configurado
  if (env.REQUIRE_AUTH && !supabaseClient) {
    logger.error("REQUIRE_AUTH está ativado mas SUPABASE_URL e SUPABASE_ANON_KEY não foram informados");
    return next(
      new UnauthorizedError(
        "Serviço de autenticação não configurado no servidor. Contate o administrador."
      )
    );
  }

  // Se autenticação obrigatória não estiver ativa e não houver cliente Supabase
  const fallbackId = token.startsWith("mock-jwt-")
    ? token.replace("mock-jwt-", "")
    : "local-developer";

  let fallbackEmail = fallbackId.includes("@") ? fallbackId : `${fallbackId}@localhost`;
  let fallbackName: string | undefined = undefined;
  let userType: "aluno" | "funcionario" | undefined = undefined;
  let ra: string | undefined = undefined;
  let cpf: string | undefined = undefined;
  let nif: string | undefined = undefined;
  let isBlocked = false;
  let isSuperAdmin = req.headers["x-test-is-superadmin"] === "true";
  let isAdmin = isSuperAdmin || req.headers["x-test-is-admin"] === "true";

  try {
    const profile = await getAuthService().getProfile(fallbackId);
    if (profile) {
      if (profile.is_blocked) {
        return next(new ForbiddenError("Sua conta de usuário foi bloqueada pelo administrador."));
      }
      fallbackEmail = profile.email || fallbackEmail;
      fallbackName = profile.name;
      userType = profile.user_type;
      ra = profile.ra;
      cpf = profile.cpf;
      nif = profile.nif;
      isBlocked = Boolean(profile.is_blocked);
      isSuperAdmin = Boolean(
        profile.is_superadmin ||
        req.headers["x-test-is-superadmin"] === "true"
      );
      isAdmin = Boolean(
        isSuperAdmin ||
        profile.is_admin ||
        req.headers["x-test-is-admin"] === "true"
      );
    }
  } catch (err: unknown) {
    if (err instanceof ForbiddenError) {
      return next(err);
    }
    // Mantém fallback inicial
  }

  req.user = {
    id: fallbackId,
    email: fallbackEmail,
    name: fallbackName,
    user_type: userType,
    ra,
    cpf,
    nif,
    role: "authenticated",
    is_admin: isAdmin,
    is_superadmin: isSuperAdmin,
    is_blocked: isBlocked,
  };

  try {
    getAuthService().recordActivity(req.user.id).catch(() => {});
  } catch {
    // noop
  }

  next();
}

