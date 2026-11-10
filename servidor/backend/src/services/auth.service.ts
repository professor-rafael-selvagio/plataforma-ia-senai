import crypto from "crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { getDbPool } from "../config/database";
import {
  RegisterInput,
  LoginInput,
  ChangePasswordInput,
  UpdateProfileInput,
} from "../schemas/auth.schema";
import { AuthUser, UserType } from "../types";
import { ForbiddenError, UnauthorizedError, ValidationError } from "../utils/errors";
import { logger } from "../utils/logger";
import { getAuditService } from "./audit.service";

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface AuthResult {
  user: AuthUser;
  session: AuthSession | null;
  message?: string;
}

export interface IAuthService {
  register(input: RegisterInput): Promise<AuthResult>;
  login(input: LoginInput): Promise<AuthResult>;
  refreshSession(refreshToken: string): Promise<AuthSession>;
  changePassword(userId: string, input: ChangePasswordInput): Promise<{ message: string }>;
  updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthUser>;
  getProfile(userId: string): Promise<AuthUser>;
  recordActivity(userId: string): Promise<void>;
}

/**
 * Serviço de autenticação conectado diretamente ao banco de dados PostgreSQL
 */
export class PostgresAuthService implements IAuthService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  public async register(input: RegisterInput): Promise<AuthResult> {
    const emailKey = input.email.toLowerCase();

    // Verifica se já existe usuário cadastrado com este e-mail
    const existing = await this.pool.query(
      "SELECT id FROM auth.users WHERE lower(email) = lower($1) LIMIT 1",
      [emailKey]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      throw new ValidationError("Este e-mail já está cadastrado.");
    }

    // Validação de unicidade para RA, CPF e NIF
    const userType: UserType = input.user_type || "aluno";
    const ra = input.ra?.trim() || null;
    const cpf = input.cpf?.trim() || null;
    const nif = input.nif?.trim() || null;

    if (ra) {
      const existingRa = await this.pool.query(
        "SELECT id FROM auth.users WHERE lower(ra) = lower($1) AND deleted_at IS NULL LIMIT 1",
        [ra]
      );
      if (existingRa.rowCount && existingRa.rowCount > 0) {
        throw new ValidationError("Já existe um usuário cadastrado com este RA.");
      }
    }

    if (cpf) {
      const existingCpf = await this.pool.query(
        "SELECT id FROM auth.users WHERE lower(cpf) = lower($1) AND deleted_at IS NULL LIMIT 1",
        [cpf]
      );
      if (existingCpf.rowCount && existingCpf.rowCount > 0) {
        throw new ValidationError("Já existe um usuário cadastrado com este CPF.");
      }
    }

    if (nif) {
      const existingNif = await this.pool.query(
        "SELECT id FROM auth.users WHERE lower(nif) = lower($1) AND deleted_at IS NULL LIMIT 1",
        [nif]
      );
      if (existingNif.rowCount && existingNif.rowCount > 0) {
        throw new ValidationError("Já existe um usuário cadastrado com este NIF.");
      }
    }

    // Hash da senha com bcrypt
    const passwordHash = await bcrypt.hash(input.password, 10);
    const metadata = input.name ? { name: input.name } : {};
    const isSuperAdmin = Boolean(env.SUPERADMIN_EMAIL && emailKey === env.SUPERADMIN_EMAIL);
    const isAdmin = isSuperAdmin;
    const finalUserType: UserType = isSuperAdmin ? "funcionario" : userType;
    const finalNif = isSuperAdmin ? (nif || env.SUPERADMIN_NIF) : nif;

    const insertResult = await this.pool.query(
      `INSERT INTO auth.users (email, password_hash, raw_user_meta_data, is_admin, is_superadmin, last_seen_at, user_type, ra, cpf, nif)
       VALUES ($1, $2, $3, $4, $5, now(), $6, $7, $8, $9)
       RETURNING id, email, created_at, is_admin, is_superadmin, last_seen_at, user_type, ra, cpf, nif`,
      [emailKey, passwordHash, JSON.stringify(metadata), isAdmin, isSuperAdmin, finalUserType, ra, cpf, finalNif]
    );

    const user = insertResult.rows[0];

    // Geração de tokens JWT
    const access_token = jwt.sign(
      { sub: user.id, email: user.email, role: "authenticated", name: input.name, is_admin: user.is_admin, is_superadmin: user.is_superadmin },
      env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const refresh_token = jwt.sign(
      { sub: user.id, type: "refresh" },
      env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    // Auditoria
    await getAuditService().log({
      userId: user.id,
      userEmail: user.email,
      action: "AUTH_REGISTER",
      resourceType: "user",
      resourceId: user.id,
      details: { user_type: finalUserType, has_ra: !!ra, has_cpf: !!cpf, has_nif: !!finalNif },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: input.name,
        role: "authenticated",
        user_type: user.user_type,
        ra: user.ra,
        cpf: user.cpf,
        nif: user.nif,
        is_admin: user.is_admin,
        is_superadmin: Boolean(user.is_superadmin),
      },
      session: {
        access_token,
        refresh_token,
        expires_in: 7 * 24 * 3600,
        token_type: "Bearer",
      },
      message: "Usuário registrado com sucesso.",
    };
  }

  public async login(input: LoginInput): Promise<AuthResult> {
    const emailKey = input.email.toLowerCase();

    const queryResult = await this.pool.query(
      "SELECT id, email, password_hash, raw_user_meta_data, is_admin, is_superadmin, last_seen_at, is_blocked, user_type, ra, cpf, nif FROM auth.users WHERE lower(email) = lower($1) LIMIT 1",
      [emailKey]
    );

    if (!queryResult.rowCount || queryResult.rowCount === 0) {
      throw new UnauthorizedError("Credenciais de acesso inválidas.");
    }

    const user = queryResult.rows[0];

    if (user.is_blocked) {
      throw new ForbiddenError("Esta conta de usuário foi bloqueada pelo administrador.");
    }

    if (!user.password_hash) {
      throw new UnauthorizedError("Credenciais de acesso inválidas.");
    }

    const isValidPassword = await bcrypt.compare(input.password, user.password_hash);
    if (!isValidPassword) {
      throw new UnauthorizedError("Credenciais de acesso inválidas.");
    }

    const name = user.raw_user_meta_data?.name;
    const isSuperAdmin = Boolean(
      user.is_superadmin ||
      (Boolean(env.SUPERADMIN_EMAIL) && user.email?.toLowerCase() === env.SUPERADMIN_EMAIL)
    );
    const isAdmin = Boolean(isSuperAdmin || user.is_admin);

    // Atualiza última atividade de forma não bloqueante
    this.pool.query("UPDATE auth.users SET last_seen_at = now() WHERE id = $1", [user.id]).catch(() => {});

    // Registra log de auditoria de autenticação
    getAuditService()
      .log({
        userId: user.id,
        userEmail: user.email,
        action: "AUTH_LOGIN",
        resourceType: "user",
        resourceId: user.id,
      })
      .catch(() => {});

    const access_token = jwt.sign(
      { sub: user.id, email: user.email, role: "authenticated", name, is_admin: isAdmin, is_superadmin: isSuperAdmin },
      env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const refresh_token = jwt.sign(
      { sub: user.id, type: "refresh" },
      env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name,
        role: "authenticated",
        user_type: user.user_type,
        ra: user.ra,
        cpf: user.cpf,
        nif: user.nif,
        is_admin: isAdmin,
        is_superadmin: isSuperAdmin,
      },
      session: {
        access_token,
        refresh_token,
        expires_in: 7 * 24 * 3600,
        token_type: "Bearer",
      },
      message: "Login realizado com sucesso.",
    };
  }

  public async refreshSession(refreshToken: string): Promise<AuthSession> {
    try {
      const decoded = jwt.verify(refreshToken, env.JWT_SECRET) as {
        sub: string;
        type?: string;
      };

      if (decoded.type !== "refresh") {
        throw new UnauthorizedError("Refresh token inválido ou expirado.");
      }

      const userRes = await this.pool.query(
        "SELECT id, email, raw_user_meta_data FROM auth.users WHERE id = $1 LIMIT 1",
        [decoded.sub]
      );

      if (!userRes.rowCount || userRes.rowCount === 0) {
        throw new UnauthorizedError("Usuário não encontrado.");
      }

      const user = userRes.rows[0];
      const name = user.raw_user_meta_data?.name;

      const access_token = jwt.sign(
        { sub: user.id, email: user.email, role: "authenticated", name },
        env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      const new_refresh_token = jwt.sign(
        { sub: user.id, type: "refresh" },
        env.JWT_SECRET,
        { expiresIn: "30d" }
      );

      return {
        access_token,
        refresh_token: new_refresh_token,
        expires_in: 7 * 24 * 3600,
        token_type: "Bearer",
      };
    } catch {
      throw new UnauthorizedError("Refresh token inválido ou expirado.");
    }
  }

  public async changePassword(
    userId: string,
    input: ChangePasswordInput
  ): Promise<{ message: string }> {
    const queryResult = await this.pool.query(
      "SELECT id, password_hash FROM auth.users WHERE id = $1 LIMIT 1",
      [userId]
    );

    if (!queryResult.rowCount || queryResult.rowCount === 0) {
      throw new UnauthorizedError("Usuário não encontrado.");
    }

    const user = queryResult.rows[0];
    if (!user.password_hash) {
      throw new UnauthorizedError("Credenciais de acesso inválidas.");
    }

    const isValid = await bcrypt.compare(input.currentPassword, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedError("A senha atual informada está incorreta.");
    }

    const newHash = await bcrypt.hash(input.newPassword, 10);
    await this.pool.query(
      "UPDATE auth.users SET password_hash = $1, updated_at = now() WHERE id = $2",
      [newHash, userId]
    );

    await getAuditService().log({
      userId,
      userEmail: user.email,
      action: "AUTH_CHANGE_PASSWORD",
      resourceType: "user",
      resourceId: userId,
    });

    return { message: "Senha alterada com sucesso." };
  }

  public async updateProfile(
    userId: string,
    input: UpdateProfileInput
  ): Promise<AuthUser> {
    const userRes = await this.pool.query(
      "SELECT id, email, raw_user_meta_data FROM auth.users WHERE id = $1 LIMIT 1",
      [userId]
    );

    if (!userRes.rowCount || userRes.rowCount === 0) {
      throw new UnauthorizedError("Usuário não encontrado.");
    }

    const currentMeta = userRes.rows[0].raw_user_meta_data || {};
    const updatedMeta = { ...currentMeta, name: input.name };

    await this.pool.query(
      "UPDATE auth.users SET raw_user_meta_data = $1, updated_at = now() WHERE id = $2",
      [JSON.stringify(updatedMeta), userId]
    );

    return {
      id: userRes.rows[0].id,
      email: userRes.rows[0].email,
      name: input.name,
      role: "authenticated",
    };
  }

  public async getProfile(userId: string): Promise<AuthUser> {
    const userRes = await this.pool.query(
      "SELECT id, email, raw_user_meta_data, is_admin, is_superadmin, last_seen_at, user_type, ra, cpf, nif, is_blocked FROM auth.users WHERE id = $1 LIMIT 1",
      [userId]
    );

    if (!userRes.rowCount || userRes.rowCount === 0) {
      throw new UnauthorizedError("Usuário não encontrado.");
    }

    const user = userRes.rows[0];
    const name = user.raw_user_meta_data?.name;
    const isSuperAdmin = Boolean(
      user.is_superadmin ||
      (Boolean(env.SUPERADMIN_EMAIL) && user.email?.toLowerCase() === env.SUPERADMIN_EMAIL)
    );
    const isAdmin = Boolean(isSuperAdmin || user.is_admin);

    return {
      id: user.id,
      email: user.email,
      name: name || undefined,
      role: "authenticated",
      is_admin: isAdmin,
      is_superadmin: isSuperAdmin,
      is_blocked: Boolean(user.is_blocked),
      user_type: user.user_type,
      ra: user.ra,
      cpf: user.cpf,
      nif: user.nif,
      last_seen_at: user.last_seen_at ? new Date(user.last_seen_at).toISOString() : undefined,
    };
  }

  public async recordActivity(userId: string): Promise<void> {
    await this.pool
      .query("UPDATE auth.users SET last_seen_at = now() WHERE id = $1", [userId])
      .catch(() => {});
  }
}

/**
 * Serviço de autenticação conectado ao Supabase Auth (caso use Supabase em nuvem)
 */
export class SupabaseAuthService implements IAuthService {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  public async register(input: RegisterInput): Promise<AuthResult> {
    const { data, error } = await this.client.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: input.name ? { name: input.name } : undefined,
      },
    });

    if (error) {
      logger.warn("Falha no cadastro via Supabase Auth", {
        error: error.message,
        email: input.email,
      });
      throw new ValidationError(error.message);
    }

    if (!data.user) {
      throw new ValidationError("Falha ao registrar usuário.");
    }

    const session = data.session
      ? {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
          token_type: data.session.token_type || "Bearer",
        }
      : null;

    return {
      user: {
        id: data.user.id,
        email: data.user.email || input.email,
        name: input.name,
        role: data.user.role || "authenticated",
      },
      session,
      message: session
        ? "Usuário registrado com sucesso."
        : "Usuário registrado com sucesso. Por favor, confirme seu e-mail para ativar a conta.",
    };
  }

  public async login(input: LoginInput): Promise<AuthResult> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error || !data.user || !data.session) {
      logger.warn("Tentativa de login inválida", {
        error: error?.message,
        email: input.email,
      });
      throw new UnauthorizedError(error?.message || "Credenciais de acesso inválidas.");
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email || input.email,
        role: data.user.role || "authenticated",
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        token_type: data.session.token_type || "Bearer",
      },
      message: "Login realizado com sucesso.",
    };
  }

  public async refreshSession(refreshToken: string): Promise<AuthSession> {
    const { data, error } = await this.client.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      logger.warn("Falha ao renovar sessão", { error: error?.message });
      throw new UnauthorizedError("Refresh token inválido ou expirado.");
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type || "Bearer",
    };
  }

  public async changePassword(
    userId: string,
    input: ChangePasswordInput
  ): Promise<{ message: string }> {
    const { error } = await this.client.auth.updateUser({
      password: input.newPassword,
    });
    if (error) {
      throw new UnauthorizedError(error.message);
    }
    return { message: "Senha alterada com sucesso." };
  }

  public async updateProfile(
    userId: string,
    input: UpdateProfileInput
  ): Promise<AuthUser> {
    const { data, error } = await this.client.auth.updateUser({
      data: { name: input.name },
    });
    if (error || !data.user) {
      throw new UnauthorizedError(error?.message || "Falha ao atualizar perfil.");
    }
    return {
      id: data.user.id,
      email: data.user.email || "",
      name: input.name,
      role: data.user.role || "authenticated",
    };
  }

  public async getProfile(userId: string): Promise<AuthUser> {
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user) {
      throw new UnauthorizedError(error?.message || "Usuário não encontrado.");
    }
    return {
      id: data.user.id,
      email: data.user.email || "",
      name: data.user.user_metadata?.name,
      role: data.user.role || "authenticated",
    };
  }

  public async recordActivity(_userId: string): Promise<void> {
    // No-op para cliente Supabase
  }
}

/**
 * Serviço de autenticação em memória para testes e desenvolvimento offline
 */
export class InMemoryAuthService implements IAuthService {
  private users: Map<
    string,
    {
      id: string;
      email: string;
      passwordHash: string;
      name?: string;
      user_type?: UserType;
      ra?: string;
      cpf?: string;
      nif?: string;
      is_admin?: boolean;
      is_superadmin?: boolean;
      is_blocked?: boolean;
      last_seen_at?: string;
      deleted_at?: string | null;
      created_at: string;
    }
  > = new Map();

  public async register(input: RegisterInput): Promise<AuthResult> {
    const emailKey = input.email.toLowerCase();
    if (this.users.has(emailKey)) {
      throw new ValidationError("Este e-mail já está cadastrado.");
    }

    // Validação de unicidade para RA, CPF e NIF
    const userType: UserType = input.user_type || "aluno";
    const ra = input.ra?.trim();
    const cpf = input.cpf?.trim();
    const nif = input.nif?.trim();

    if (ra) {
      const lower = ra.toLowerCase();
      for (const u of this.users.values()) {
        if (u.ra && u.ra.toLowerCase() === lower && !u.deleted_at) {
          throw new ValidationError("Já existe um usuário cadastrado com este RA.");
        }
      }
    }

    if (cpf) {
      const lower = cpf.toLowerCase();
      for (const u of this.users.values()) {
        if (u.cpf && u.cpf.toLowerCase() === lower && !u.deleted_at) {
          throw new ValidationError("Já existe um usuário cadastrado com este CPF.");
        }
      }
    }

    if (nif) {
      const lower = nif.toLowerCase();
      for (const u of this.users.values()) {
        if (u.nif && u.nif.toLowerCase() === lower && !u.deleted_at) {
          throw new ValidationError("Já existe um usuário cadastrado com este NIF.");
        }
      }
    }

    const id = crypto.randomUUID();
    const passwordHash = crypto
      .createHash("sha256")
      .update(input.password)
      .digest("hex");
    const isSuperAdmin = Boolean(
      env.SUPERADMIN_EMAIL && emailKey === env.SUPERADMIN_EMAIL
    );
    const isAdmin = isSuperAdmin;
    const finalUserType: UserType = isSuperAdmin ? "funcionario" : userType;
    const finalNif = isSuperAdmin ? (nif || env.SUPERADMIN_NIF) : nif;
    const now = new Date().toISOString();

    this.users.set(emailKey, {
      id,
      email: emailKey,
      passwordHash,
      name: input.name,
      user_type: finalUserType,
      ra,
      cpf,
      nif: finalNif,
      is_admin: isAdmin,
      is_superadmin: isSuperAdmin,
      is_blocked: false,
      last_seen_at: now,
      created_at: now,
    });

    await getAuditService().log({
      userId: id,
      userEmail: emailKey,
      action: "AUTH_REGISTER",
      resourceType: "user",
      resourceId: id,
      details: { user_type: finalUserType, has_ra: !!ra, has_cpf: !!cpf, has_nif: !!finalNif },
    });

    return {
      user: {
        id,
        email: emailKey,
        name: input.name,
        role: "authenticated",
        user_type: finalUserType,
        ra,
        cpf,
        nif: finalNif,
        is_admin: isAdmin,
        is_superadmin: isSuperAdmin,
        last_seen_at: now,
      },
      session: {
        access_token: `mock-jwt-${id}`,
        refresh_token: `mock-refresh-${id}`,
        expires_in: 3600,
        token_type: "Bearer",
      },
      message: "Usuário registrado com sucesso (modo local).",
    };
  }

  public async login(input: LoginInput): Promise<AuthResult> {
    const emailKey = input.email.toLowerCase();
    const user = this.users.get(emailKey);
    const hash = crypto
      .createHash("sha256")
      .update(input.password)
      .digest("hex");

    if (!user || user.passwordHash !== hash) {
      throw new UnauthorizedError("Credenciais de acesso inválidas.");
    }

    if (user.is_blocked) {
      throw new ForbiddenError("Esta conta de usuário foi bloqueada pelo administrador.");
    }

    user.last_seen_at = new Date().toISOString();
    const isSuperAdmin = Boolean(
      user.is_superadmin ||
      (Boolean(env.SUPERADMIN_EMAIL) && user.email.toLowerCase() === env.SUPERADMIN_EMAIL)
    );
    const isAdmin = Boolean(isSuperAdmin || user.is_admin);

    await getAuditService().log({
      userId: user.id,
      userEmail: user.email,
      action: "AUTH_LOGIN",
      resourceType: "user",
      resourceId: user.id,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: "authenticated",
        user_type: user.user_type,
        ra: user.ra,
        cpf: user.cpf,
        nif: user.nif,
        is_admin: isAdmin,
        is_superadmin: isSuperAdmin,
        last_seen_at: user.last_seen_at,
      },
      session: {
        access_token: `mock-jwt-${user.id}`,
        refresh_token: `mock-refresh-${user.id}`,
        expires_in: 3600,
        token_type: "Bearer",
      },
      message: "Login realizado com sucesso (modo local).",
    };
  }

  public async refreshSession(refreshToken: string): Promise<AuthSession> {
    if (!refreshToken || !refreshToken.startsWith("mock-refresh-")) {
      throw new UnauthorizedError("Refresh token inválido ou expirado.");
    }

    const id = refreshToken.replace("mock-refresh-", "");
    return {
      access_token: `mock-jwt-${id}`,
      refresh_token: `mock-refresh-${id}`,
      expires_in: 3600,
      token_type: "Bearer",
    };
  }

  public async changePassword(
    userId: string,
    input: ChangePasswordInput
  ): Promise<{ message: string }> {
    let foundUser: {
      id: string;
      email: string;
      passwordHash: string;
      name?: string;
      is_admin?: boolean;
      last_seen_at?: string;
      created_at: string;
    } | null = null;

    for (const u of this.users.values()) {
      if (u.id === userId) {
        foundUser = u;
        break;
      }
    }

    if (!foundUser) {
      throw new UnauthorizedError("Usuário não encontrado.");
    }

    const currentHash = crypto
      .createHash("sha256")
      .update(input.currentPassword)
      .digest("hex");

    if (foundUser.passwordHash !== currentHash) {
      throw new UnauthorizedError("A senha atual informada está incorreta.");
    }

    foundUser.passwordHash = crypto
      .createHash("sha256")
      .update(input.newPassword)
      .digest("hex");

    await getAuditService().log({
      userId,
      userEmail: foundUser.email,
      action: "AUTH_CHANGE_PASSWORD",
      resourceType: "user",
      resourceId: userId,
    });

    return { message: "Senha alterada com sucesso." };
  }

  public async updateProfile(
    userId: string,
    input: UpdateProfileInput
  ): Promise<AuthUser> {
    let foundUser: {
      id: string;
      email: string;
      passwordHash: string;
      name?: string;
      user_type?: UserType;
      ra?: string;
      cpf?: string;
      nif?: string;
      is_admin?: boolean;
      is_superadmin?: boolean;
      is_blocked?: boolean;
      last_seen_at?: string;
      created_at: string;
    } | null = null;

    for (const u of this.users.values()) {
      if (u.id === userId) {
        foundUser = u;
        break;
      }
    }

    if (!foundUser) {
      throw new UnauthorizedError("Usuário não encontrado.");
    }

    foundUser.name = input.name;
    const isSuperAdmin = Boolean(
      foundUser.is_superadmin ||
      (Boolean(env.SUPERADMIN_EMAIL) && foundUser.email.toLowerCase() === env.SUPERADMIN_EMAIL)
    );
    const isAdmin = Boolean(isSuperAdmin || foundUser.is_admin);

    return {
      id: foundUser.id,
      email: foundUser.email,
      name: foundUser.name,
      role: "authenticated",
      user_type: foundUser.user_type,
      ra: foundUser.ra,
      cpf: foundUser.cpf,
      nif: foundUser.nif,
      is_admin: isAdmin,
      is_superadmin: isSuperAdmin,
      last_seen_at: foundUser.last_seen_at,
    };
  }

  public async getProfile(userId: string): Promise<AuthUser> {
    let foundUser: {
      id: string;
      email: string;
      passwordHash: string;
      name?: string;
      user_type?: UserType;
      ra?: string;
      cpf?: string;
      nif?: string;
      is_admin?: boolean;
      is_superadmin?: boolean;
      is_blocked?: boolean;
      last_seen_at?: string;
      created_at: string;
    } | null = null;

    for (const u of this.users.values()) {
      if (u.id === userId) {
        foundUser = u;
        break;
      }
    }

    if (!foundUser) {
      throw new UnauthorizedError("Usuário não encontrado.");
    }

    const isSuperAdmin = Boolean(
      foundUser.is_superadmin ||
      (Boolean(env.SUPERADMIN_EMAIL) && foundUser.email.toLowerCase() === env.SUPERADMIN_EMAIL)
    );
    const isAdmin = Boolean(isSuperAdmin || foundUser.is_admin);

    return {
      id: foundUser.id,
      email: foundUser.email,
      name: foundUser.name,
      role: "authenticated",
      user_type: foundUser.user_type,
      ra: foundUser.ra,
      cpf: foundUser.cpf,
      nif: foundUser.nif,
      is_admin: isAdmin,
      is_superadmin: isSuperAdmin,
      is_blocked: Boolean(foundUser.is_blocked),
      last_seen_at: foundUser.last_seen_at,
    };
  }

  public async recordActivity(userId: string): Promise<void> {
    for (const u of this.users.values()) {
      if (u.id === userId) {
        u.last_seen_at = new Date().toISOString();
        break;
      }
    }
  }

  public getUsersList() {
    return Array.from(this.users.values());
  }

  public setUserBlocked(userId: string, isBlocked: boolean): boolean {
    for (const u of this.users.values()) {
      if (u.id === userId) {
        u.is_blocked = isBlocked;
        return true;
      }
    }
    return false;
  }

  public setUserAdmin(userId: string, isAdmin: boolean): boolean {
    for (const u of this.users.values()) {
      if (u.id === userId) {
        u.is_admin = isAdmin;
        getAuditService().log({
          action: isAdmin ? "ADMIN_GRANT" : "ADMIN_REVOKE",
          resourceType: "user",
          resourceId: userId,
          details: { is_admin: isAdmin },
        }).catch(() => {});
        return true;
      }
    }
    return false;
  }

  public clear(): void {
    this.users.clear();
  }
}

// Inicializa a instância padrão de acordo com as variáveis de ambiente
let defaultAuthServiceInstance: IAuthService;

if (env.DATABASE_URL) {
  const pool = getDbPool();
  if (pool) {
    defaultAuthServiceInstance = new PostgresAuthService(pool);
  } else {
    defaultAuthServiceInstance = new InMemoryAuthService();
  }
} else if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  defaultAuthServiceInstance = new SupabaseAuthService(supabase);
} else {
  logger.info(
    "Credenciais do Supabase/PostgreSQL não configuradas. Utilizando AuthService em memória para desenvolvimento local."
  );
  defaultAuthServiceInstance = new InMemoryAuthService();
}

export function setAuthServiceForTesting(service: IAuthService): void {
  defaultAuthServiceInstance = service;
}

export function getAuthService(): IAuthService {
  return defaultAuthServiceInstance;
}
