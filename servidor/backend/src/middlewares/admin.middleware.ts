import { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../utils/errors";
import { env } from "../config/env";

export const SUPERADMIN_EMAIL = env.SUPERADMIN_EMAIL;

/**
 * Middleware para restringir endpoints apenas a usuários com privilégios de administrador
 * ou ao superadministrador configurado.
 */
export function adminMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.headers.authorization) {
    return next(new UnauthorizedError("Token de autenticação ausente ou formato inválido."));
  }

  if (!req.user) {
    return next(new UnauthorizedError("Usuário não autenticado."));
  }

  const email = req.user.email?.toLowerCase();
  const isSuperAdmin =
    req.user.is_superadmin === true ||
    (Boolean(env.SUPERADMIN_EMAIL) && email === env.SUPERADMIN_EMAIL);
  const isAdmin = req.user.is_admin === true;

  if (!isSuperAdmin && !isAdmin) {
    return next(
      new ForbiddenError(
        "Acesso negado. Esta funcionalidade é exclusiva para administradores do sistema."
      )
    );
  }

  next();
}
