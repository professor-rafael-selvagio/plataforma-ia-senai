import { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../utils/errors";

/**
 * Middleware para restringir endpoints apenas a usuários com privilégios de administrador
 * ou superadministrador (definidos no banco de dados).
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

  const isSuperAdmin = req.user.is_superadmin === true;
  const isAdmin = req.user.is_admin === true || isSuperAdmin;

  if (!isAdmin) {
    return next(
      new ForbiddenError(
        "Acesso negado. Esta funcionalidade é exclusiva para administradores do sistema."
      )
    );
  }

  next();
}
