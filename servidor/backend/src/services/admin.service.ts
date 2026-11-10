import os from "os";
import fs from "fs/promises";
import crypto from "crypto";
import { Pool } from "pg";
import { getDbPool } from "../config/database";
import { env } from "../config/env";
import {
  AdminDeletedItem,
  AdminMetricsResponse,
  AdminUserSummary,
  AuditLogEntry,
  DatabaseMessage,
  SystemResourceHistoryEntry,
  SystemResourcesResponse,
  TokenAnalyticsResponse,
  TokenDailyUsage,
} from "../types";
import { ForbiddenError, NotFoundError } from "../utils/errors";
import { getAuditService } from "./audit.service";
import { getAuthService, InMemoryAuthService } from "./auth.service";
import {
  defaultConversationService,
  InMemoryConversationRepository,
} from "./conversation.service";
import {
  defaultProjectService,
  InMemoryProjectRepository,
} from "./project.service";

export async function collectSystemResources(): Promise<SystemResourcesResponse> {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
  for (const cpu of cpus) {
    for (const type of Object.keys(cpu.times)) {
      totalTick += (cpu.times as Record<string, number>)[type];
    }
    totalIdle += cpu.times.idle;
  }
  const usagePercent =
    totalTick > 0 ? Math.round(((totalTick - totalIdle) / totalTick) * 100) : 0;

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercent = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0;

  let diskTotal = 0;
  let diskFree = 0;
  let diskUsed = 0;
  let diskPercent = 0;

  try {
    const stat = await fs.statfs("/");
    diskTotal = stat.bsize * stat.blocks;
    diskFree = stat.bsize * stat.bavail;
    diskUsed = diskTotal - diskFree;
    diskPercent = diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0;
  } catch {
    // Fallback if statfs fails
  }

  return {
    cpu: {
      usage_percent: usagePercent,
      cores: cpus.length,
      model: cpus[0]?.model || "Unknown",
      load_avg: os.loadavg(),
    },
    memory: {
      total_bytes: totalMem,
      used_bytes: usedMem,
      free_bytes: freeMem,
      usage_percent: memPercent,
    },
    disk: {
      total_bytes: diskTotal,
      used_bytes: diskUsed,
      free_bytes: diskFree,
      usage_percent: diskPercent,
    },
    uptime_seconds: Math.floor(os.uptime()),
    platform: `${os.type()} ${os.release()} (${os.arch()})`,
    hostname: os.hostname(),
    timestamp: new Date().toISOString(),
  };
}

export interface IAdminService {
  getMetrics(): Promise<AdminMetricsResponse>;
  getUsers(): Promise<AdminUserSummary[]>;
  updateUserRole(
    adminUserId: string,
    targetUserId: string,
    isAdmin: boolean
  ): Promise<AdminUserSummary>;
  blockUser(
    adminUserId: string,
    targetUserId: string,
    isBlocked: boolean
  ): Promise<AdminUserSummary>;
  getDeletedItems(): Promise<AdminDeletedItem[]>;
  restoreItem(
    resourceType: "conversation" | "project",
    resourceId: string
  ): Promise<{ success: boolean; message: string }>;
  getAuditLogs(limit?: number, offset?: number): Promise<AuditLogEntry[]>;
  getSystemResources(): Promise<SystemResourcesResponse>;
  saveSystemResourceMetric(data?: SystemResourcesResponse): Promise<SystemResourceHistoryEntry>;
  getSystemResourceHistory(limit?: number, hours?: number): Promise<SystemResourceHistoryEntry[]>;
  getTokenAnalytics(): Promise<TokenAnalyticsResponse>;
}

/**
 * Implementação do serviço administrativo conectado ao PostgreSQL
 */
export class PostgresAdminService implements IAdminService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  public async getMetrics(): Promise<AdminMetricsResponse> {
    const usersCountRes = await this.pool.query(
      `SELECT 
         count(*)::int as total_users,
         count(*) FILTER (WHERE user_type = 'aluno' OR user_type IS NULL)::int as total_alunos,
         count(*) FILTER (WHERE user_type = 'funcionario')::int as total_funcionarios,
         count(*) FILTER (WHERE last_seen_at >= now() - interval '3 minutes')::int as online_users
       FROM auth.users`
    );

    const convCountRes = await this.pool.query(
      `SELECT 
         count(*) FILTER (WHERE deleted_at IS NULL)::int as total_conversations,
         count(*) FILTER (WHERE deleted_at IS NOT NULL)::int as deleted_conversations
       FROM public.conversations`
    );

    const projCountRes = await this.pool.query(
      `SELECT 
         count(*) FILTER (WHERE deleted_at IS NOT NULL)::int as deleted_projects
       FROM public.projects`
    );

    const messagesRes = await this.pool.query(
      `SELECT 
         count(*)::int as total_messages,
         COALESCE(sum(prompt_tokens), 0)::int as total_prompt_tokens,
         COALESCE(sum(COALESCE(completion_tokens, tokens, 0)), 0)::int as total_completion_tokens
       FROM public.messages`
    );

    const totalUsers = usersCountRes.rows[0]?.total_users || 0;
    const totalAlunos = usersCountRes.rows[0]?.total_alunos || 0;
    const totalFuncionarios = usersCountRes.rows[0]?.total_funcionarios || 0;
    const onlineUsers = usersCountRes.rows[0]?.online_users || 0;
    const totalConversations = convCountRes.rows[0]?.total_conversations || 0;
    const deletedConversations = convCountRes.rows[0]?.deleted_conversations || 0;
    const deletedProjects = projCountRes.rows[0]?.deleted_projects || 0;
    const totalMessages = messagesRes.rows[0]?.total_messages || 0;
    const totalPromptTokens = messagesRes.rows[0]?.total_prompt_tokens || 0;
    const totalCompletionTokens = messagesRes.rows[0]?.total_completion_tokens || 0;

    return {
      total_users: totalUsers,
      total_alunos: totalAlunos,
      total_funcionarios: totalFuncionarios,
      online_users: onlineUsers,
      total_conversations: totalConversations,
      deleted_conversations: deletedConversations,
      deleted_projects: deletedProjects,
      total_messages: totalMessages,
      total_prompt_tokens: totalPromptTokens,
      total_completion_tokens: totalCompletionTokens,
      total_tokens: totalPromptTokens + totalCompletionTokens,
    };
  }

  public async getUsers(): Promise<AdminUserSummary[]> {
    const res = await this.pool.query(
      `SELECT 
         u.id,
         COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)) as name,
         u.email,
         u.user_type,
         u.ra,
         u.cpf,
         u.nif,
         u.is_blocked,
         u.deleted_at,
         u.is_admin,
         u.is_superadmin,
         u.created_at,
         u.last_seen_at,
         (u.last_seen_at >= now() - interval '3 minutes') as is_online,
         COUNT(DISTINCT c.id) FILTER (WHERE c.deleted_at IS NULL)::int as total_conversations,
         COUNT(DISTINCT m.id) FILTER (WHERE m.deleted_at IS NULL)::int as total_messages,
         COALESCE(SUM(m.prompt_tokens), 0)::int as total_prompt_tokens,
         COALESCE(SUM(COALESCE(m.completion_tokens, m.tokens, 0)), 0)::int as total_completion_tokens
       FROM auth.users u
       LEFT JOIN public.conversations c ON c.user_id = u.id
       LEFT JOIN public.messages m ON m.user_id = u.id
       GROUP BY u.id, u.email, u.raw_user_meta_data, u.user_type, u.ra, u.cpf, u.nif, u.is_blocked, u.deleted_at, u.is_admin, u.is_superadmin, u.created_at, u.last_seen_at
       ORDER BY (u.last_seen_at >= now() - interval '3 minutes') DESC, u.created_at DESC`
    );

    return res.rows.map((row) => {
      const isSuperAdmin = Boolean(row.is_superadmin);
      const isAdmin = Boolean(isSuperAdmin || row.is_admin);
      const promptTokens = Number(row.total_prompt_tokens) || 0;
      const completionTokens = Number(row.total_completion_tokens) || 0;

      return {
        id: row.id,
        name: row.name || row.email,
        email: row.email,
        user_type: row.user_type || "aluno",
        ra: row.ra || undefined,
        cpf: row.cpf || undefined,
        nif: row.nif || undefined,
        is_admin: isAdmin,
        is_superadmin: isSuperAdmin,
        is_blocked: Boolean(row.is_blocked),
        is_online: Boolean(row.is_online),
        last_seen_at: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : new Date().toISOString(),
        created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        total_conversations: Number(row.total_conversations) || 0,
        total_messages: Number(row.total_messages) || 0,
        total_prompt_tokens: promptTokens,
        total_completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      };
    });
  }

  public async updateUserRole(
    adminUserId: string,
    targetUserId: string,
    isAdmin: boolean
  ): Promise<AdminUserSummary> {
    const userCheck = await this.pool.query(
      "SELECT id, email, is_admin, is_superadmin FROM auth.users WHERE id = $1 LIMIT 1",
      [targetUserId]
    );

    if (!userCheck.rowCount || userCheck.rowCount === 0) {
      throw new NotFoundError("Usuário alvo não encontrado.");
    }

    const targetUser = userCheck.rows[0];
    const isTargetSuperAdmin = Boolean(targetUser.is_superadmin);
    if (isTargetSuperAdmin && !isAdmin) {
      throw new ForbiddenError(
        "Não é permitido revogar a permissão do administrador principal."
      );
    }

    await this.pool.query(
      "UPDATE auth.users SET is_admin = $1, updated_at = now() WHERE id = $2",
      [isAdmin, targetUserId]
    );

    await getAuditService().log({
      userId: adminUserId,
      action: isAdmin ? "ADMIN_GRANT" : "ADMIN_REVOKE",
      resourceType: "user",
      resourceId: targetUserId,
      details: { targetEmail: targetUser.email, is_admin: isAdmin },
    });

    const allUsers = await this.getUsers();
    const updated = allUsers.find((u) => u.id === targetUserId);
    if (!updated) {
      throw new NotFoundError("Erro ao recuperar usuário atualizado.");
    }
    return updated;
  }

  public async blockUser(
    adminUserId: string,
    targetUserId: string,
    isBlocked: boolean
  ): Promise<AdminUserSummary> {
    const userCheck = await this.pool.query(
      "SELECT id, email, is_blocked, is_superadmin FROM auth.users WHERE id = $1 LIMIT 1",
      [targetUserId]
    );

    if (!userCheck.rowCount || userCheck.rowCount === 0) {
      throw new NotFoundError("Usuário alvo não encontrado.");
    }

    const targetUser = userCheck.rows[0];
    const isTargetSuperAdmin = Boolean(targetUser.is_superadmin);
    if (isTargetSuperAdmin && isBlocked) {
      throw new ForbiddenError(
        "Não é permitido bloquear o administrador principal."
      );
    }

    await this.pool.query(
      "UPDATE auth.users SET is_blocked = $1, updated_at = now() WHERE id = $2",
      [isBlocked, targetUserId]
    );

    await getAuditService().log({
      userId: adminUserId,
      action: isBlocked ? "USER_BLOCK" : "USER_UNBLOCK",
      resourceType: "user",
      resourceId: targetUserId,
      details: { targetEmail: targetUser.email, is_blocked: isBlocked },
    });

    const allUsers = await this.getUsers();
    const updated = allUsers.find((u) => u.id === targetUserId);
    if (!updated) {
      throw new NotFoundError("Erro ao recuperar usuário atualizado.");
    }
    return updated;
  }

  public async getSystemResources(): Promise<SystemResourcesResponse> {
    return collectSystemResources();
  }

  public async saveSystemResourceMetric(
    data?: SystemResourcesResponse
  ): Promise<SystemResourceHistoryEntry> {
    const res = data || (await collectSystemResources());
    const query = `
      INSERT INTO public.server_metrics_history (
        cpu_usage_percent,
        cpu_cores,
        memory_total_bytes,
        memory_used_bytes,
        memory_usage_percent,
        disk_total_bytes,
        disk_used_bytes,
        disk_usage_percent,
        uptime_seconds,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING 
        id,
        cpu_usage_percent::float as cpu_usage_percent,
        cpu_cores,
        memory_total_bytes::text as memory_total_bytes,
        memory_used_bytes::text as memory_used_bytes,
        memory_usage_percent::float as memory_usage_percent,
        disk_total_bytes::text as disk_total_bytes,
        disk_used_bytes::text as disk_used_bytes,
        disk_usage_percent::float as disk_usage_percent,
        uptime_seconds::text as uptime_seconds,
        created_at
    `;
    const values = [
      res.cpu.usage_percent,
      res.cpu.cores,
      res.memory.total_bytes,
      res.memory.used_bytes,
      res.memory.usage_percent,
      res.disk.total_bytes,
      res.disk.used_bytes,
      res.disk.usage_percent,
      res.uptime_seconds,
      res.timestamp ? new Date(res.timestamp) : new Date(),
    ];
    const { rows } = await this.pool.query(query, values);
    const row = rows[0];
    return {
      id: row.id,
      cpu_usage_percent: Number(row.cpu_usage_percent),
      cpu_cores: Number(row.cpu_cores),
      memory_total_bytes: Number(row.memory_total_bytes),
      memory_used_bytes: Number(row.memory_used_bytes),
      memory_usage_percent: Number(row.memory_usage_percent),
      disk_total_bytes: Number(row.disk_total_bytes),
      disk_used_bytes: Number(row.disk_used_bytes),
      disk_usage_percent: Number(row.disk_usage_percent),
      uptime_seconds: Number(row.uptime_seconds),
      created_at: new Date(row.created_at).toISOString(),
    };
  }

  public async getSystemResourceHistory(
    limit = 5,
    hours?: number
  ): Promise<SystemResourceHistoryEntry[]> {
    const safeLimit = Math.max(1, Math.min(1000, limit));
    let query = `
      SELECT 
        id,
        cpu_usage_percent::float as cpu_usage_percent,
        cpu_cores,
        memory_total_bytes::text as memory_total_bytes,
        memory_used_bytes::text as memory_used_bytes,
        memory_usage_percent::float as memory_usage_percent,
        disk_total_bytes::text as disk_total_bytes,
        disk_used_bytes::text as disk_used_bytes,
        disk_usage_percent::float as disk_usage_percent,
        uptime_seconds::text as uptime_seconds,
        created_at
      FROM public.server_metrics_history
    `;
    const params: any[] = [];
    if (hours && hours > 0) {
      params.push(hours);
      query += ` WHERE created_at >= NOW() - ($${params.length} || ' hours')::interval`;
    }
    params.push(safeLimit);
    query += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const { rows } = await this.pool.query(query, params);
    return rows
      .map((row) => ({
        id: row.id,
        cpu_usage_percent: Number(row.cpu_usage_percent),
        cpu_cores: Number(row.cpu_cores),
        memory_total_bytes: Number(row.memory_total_bytes),
        memory_used_bytes: Number(row.memory_used_bytes),
        memory_usage_percent: Number(row.memory_usage_percent),
        disk_total_bytes: Number(row.disk_total_bytes),
        disk_used_bytes: Number(row.disk_used_bytes),
        disk_usage_percent: Number(row.disk_usage_percent),
        uptime_seconds: Number(row.uptime_seconds),
        created_at: new Date(row.created_at).toISOString(),
      }))
      .reverse();
  }

  public async getTokenAnalytics(): Promise<TokenAnalyticsResponse> {
    const res = await this.pool.query(
      `SELECT 
         to_char(created_at, 'YYYY-MM-DD') as date,
         count(*)::int as messages_count,
         coalesce(sum(prompt_tokens), 0)::int as prompt_tokens,
         coalesce(sum(coalesce(completion_tokens, tokens, 0)), 0)::int as completion_tokens
       FROM public.messages
       WHERE deleted_at IS NULL
       GROUP BY to_char(created_at, 'YYYY-MM-DD')
       ORDER BY date ASC`
    );

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let peakDay: { date: string; total_tokens: number } | null = null;

    const dailyUsage = res.rows.map((row) => {
      const prompt = Number(row.prompt_tokens) || 0;
      const completion = Number(row.completion_tokens) || 0;
      const total = prompt + completion;
      const count = Number(row.messages_count) || 0;

      totalPromptTokens += prompt;
      totalCompletionTokens += completion;

      if (!peakDay || total > peakDay.total_tokens) {
        if (total > 0) {
          peakDay = { date: row.date, total_tokens: total };
        }
      }

      return {
        date: row.date,
        prompt_tokens: prompt,
        completion_tokens: completion,
        total_tokens: total,
        messages_count: count,
      };
    });

    const totalTokens = totalPromptTokens + totalCompletionTokens;
    const promptPercentage =
      totalTokens > 0 ? Math.round((totalPromptTokens / totalTokens) * 100) : 0;
    const completionPercentage =
      totalTokens > 0 ? Math.round((totalCompletionTokens / totalTokens) * 100) : 0;

    return {
      total_tokens: totalTokens,
      total_prompt_tokens: totalPromptTokens,
      total_completion_tokens: totalCompletionTokens,
      prompt_percentage: promptPercentage,
      completion_percentage: completionPercentage,
      peak_day: peakDay,
      daily_usage: dailyUsage,
    };
  }

  public async getDeletedItems(): Promise<AdminDeletedItem[]> {
    const conversationsRes = await this.pool.query(
      `SELECT 
         c.id,
         c.title,
         c.user_id,
         c.created_at,
         c.deleted_at,
         u.email as user_email,
         COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)) as user_name
       FROM public.conversations c
       LEFT JOIN auth.users u ON u.id = c.user_id
       WHERE c.deleted_at IS NOT NULL`
    );

    const projectsRes = await this.pool.query(
      `SELECT 
         p.id,
         p.name as title,
         p.user_id,
         p.created_at,
         p.deleted_at,
         u.email as user_email,
         COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)) as user_name
       FROM public.projects p
       LEFT JOIN auth.users u ON u.id = p.user_id
       WHERE p.deleted_at IS NOT NULL`
    );

    const items: AdminDeletedItem[] = [
      ...conversationsRes.rows.map((row) => ({
        id: row.id,
        resource_type: "conversation" as const,
        title: row.title,
        user_id: row.user_id,
        user_email: row.user_email,
        user_name: row.user_name,
        created_at: new Date(row.created_at).toISOString(),
        deleted_at: new Date(row.deleted_at).toISOString(),
      })),
      ...projectsRes.rows.map((row) => ({
        id: row.id,
        resource_type: "project" as const,
        title: row.title,
        user_id: row.user_id,
        user_email: row.user_email,
        user_name: row.user_name,
        created_at: new Date(row.created_at).toISOString(),
        deleted_at: new Date(row.deleted_at).toISOString(),
      })),
    ];

    return items.sort(
      (a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime()
    );
  }

  public async restoreItem(
    resourceType: "conversation" | "project",
    resourceId: string
  ): Promise<{ success: boolean; message: string }> {
    if (resourceType === "conversation") {
      const res = await this.pool.query(
        "UPDATE public.conversations SET deleted_at = NULL WHERE id = $1 RETURNING id",
        [resourceId]
      );
      if (!res.rowCount || res.rowCount === 0) {
        throw new NotFoundError("Conversa não encontrada para restauração.");
      }
    } else {
      const res = await this.pool.query(
        "UPDATE public.projects SET deleted_at = NULL WHERE id = $1 RETURNING id",
        [resourceId]
      );
      if (!res.rowCount || res.rowCount === 0) {
        throw new NotFoundError("Projeto não encontrado para restauração.");
      }
      await this.pool.query(
        "UPDATE public.conversations SET deleted_at = NULL WHERE project_id = $1",
        [resourceId]
      );
    }

    await getAuditService().log({
      action: "RESTORE_RESOURCE",
      resourceType,
      resourceId,
    });

    return {
      success: true,
      message: `${
        resourceType === "conversation" ? "Conversa" : "Projeto"
      } restaurado(a) com sucesso.`,
    };
  }

  public async getAuditLogs(limit = 100, offset = 0): Promise<AuditLogEntry[]> {
    return getAuditService().getLogs(limit, offset);
  }
}

/**
 * Implementação em memória para testes e modo offline
 */
export class InMemoryAdminService implements IAdminService {
  private inMemoryAuth: InMemoryAuthService;
  private serverMetricsHistory: SystemResourceHistoryEntry[] = [];

  constructor(authService: InMemoryAuthService) {
    this.inMemoryAuth = authService;
    this.seedInitialMetrics();
  }

  private seedInitialMetrics(): void {
    const now = Date.now();
    for (let i = 4; i >= 0; i--) {
      const timestamp = new Date(now - i * 5 * 60 * 1000).toISOString();
      this.serverMetricsHistory.push({
        id: crypto.randomUUID(),
        cpu_usage_percent: Math.min(100, Math.max(5, 15 + Math.floor(Math.sin(i) * 10) + (i % 3) * 5)),
        cpu_cores: 4,
        memory_total_bytes: 16 * 1024 * 1024 * 1024,
        memory_used_bytes: (6 + (i % 2)) * 1024 * 1024 * 1024,
        memory_usage_percent: 38 + (i % 4) * 3,
        disk_total_bytes: 256 * 1024 * 1024 * 1024,
        disk_used_bytes: 64 * 1024 * 1024 * 1024,
        disk_usage_percent: 25,
        uptime_seconds: 86400 - i * 300,
        created_at: timestamp,
      });
    }
  }

  public async getMetrics(): Promise<AdminMetricsResponse> {
    const users = this.inMemoryAuth.getUsersList();
    const now = Date.now();
    const threeMinMs = 3 * 60 * 1000;

    let onlineUsers = 0;
    let totalAlunos = 0;
    let totalFuncionarios = 0;

    for (const u of users) {
      if (u.last_seen_at && now - new Date(u.last_seen_at).getTime() <= threeMinMs) {
        onlineUsers++;
      }
      if (u.user_type === "funcionario") {
        totalFuncionarios++;
      } else {
        totalAlunos++;
      }
    }

    const deletedItems = await this.getDeletedItems();
    const deletedConversations = deletedItems.filter(
      (item) => item.resource_type === "conversation"
    ).length;
    const deletedProjects = deletedItems.filter(
      (item) => item.resource_type === "project"
    ).length;

    return {
      total_users: users.length,
      total_alunos: totalAlunos,
      total_funcionarios: totalFuncionarios,
      online_users: onlineUsers,
      total_conversations: 0,
      deleted_conversations: deletedConversations,
      deleted_projects: deletedProjects,
      total_messages: 0,
      total_prompt_tokens: 0,
      total_completion_tokens: 0,
      total_tokens: 0,
    };
  }

  public async getUsers(): Promise<AdminUserSummary[]> {
    const users = this.inMemoryAuth.getUsersList();
    const now = Date.now();
    const threeMinMs = 3 * 60 * 1000;

    return users.map((u) => {
      const isOnline = Boolean(
        u.last_seen_at && now - new Date(u.last_seen_at).getTime() <= threeMinMs
      );
      const isSuperAdmin = Boolean(u.is_superadmin);
      const isAdmin = Boolean(isSuperAdmin || u.is_admin);

      return {
        id: u.id,
        name: u.name || u.email,
        email: u.email,
        user_type: u.user_type || "aluno",
        ra: u.ra,
        cpf: u.cpf,
        nif: u.nif,
        is_admin: isAdmin,
        is_superadmin: isSuperAdmin,
        is_blocked: Boolean(u.is_blocked),
        is_online: isOnline,
        last_seen_at: u.last_seen_at || new Date().toISOString(),
        created_at: u.created_at || new Date().toISOString(),
        total_conversations: 0,
        total_messages: 0,
        total_prompt_tokens: 0,
        total_completion_tokens: 0,
        total_tokens: 0,
      };
    });
  }

  public async updateUserRole(
    adminUserId: string,
    targetUserId: string,
    isAdmin: boolean
  ): Promise<AdminUserSummary> {
    const users = this.inMemoryAuth.getUsersList();
    const targetUser = users.find((u) => u.id === targetUserId);

    if (!targetUser) {
      throw new NotFoundError("Usuário alvo não encontrado.");
    }

    const isTargetSuperAdmin = Boolean(targetUser.is_superadmin);
    if (isTargetSuperAdmin && !isAdmin) {
      throw new ForbiddenError(
        "Não é permitido revogar a permissão do administrador principal."
      );
    }

    this.inMemoryAuth.setUserAdmin(targetUserId, isAdmin);

    await getAuditService().log({
      userId: adminUserId,
      action: isAdmin ? "ADMIN_GRANT" : "ADMIN_REVOKE",
      resourceType: "user",
      resourceId: targetUserId,
      details: { targetEmail: targetUser.email, is_admin: isAdmin },
    });

    const all = await this.getUsers();
    return all.find((u) => u.id === targetUserId)!;
  }

  public async blockUser(
    adminUserId: string,
    targetUserId: string,
    isBlocked: boolean
  ): Promise<AdminUserSummary> {
    const users = this.inMemoryAuth.getUsersList();
    const targetUser = users.find((u) => u.id === targetUserId);

    if (!targetUser) {
      throw new NotFoundError("Usuário alvo não encontrado.");
    }

    const isTargetSuperAdmin = Boolean(targetUser.is_superadmin);
    if (isTargetSuperAdmin && isBlocked) {
      throw new ForbiddenError(
        "Não é permitido bloquear o administrador principal."
      );
    }

    this.inMemoryAuth.setUserBlocked(targetUserId, isBlocked);

    await getAuditService().log({
      userId: adminUserId,
      action: isBlocked ? "USER_BLOCK" : "USER_UNBLOCK",
      resourceType: "user",
      resourceId: targetUserId,
      details: { targetEmail: targetUser.email, is_blocked: isBlocked },
    });

    const all = await this.getUsers();
    return all.find((u) => u.id === targetUserId)!;
  }

  public async getSystemResources(): Promise<SystemResourcesResponse> {
    return collectSystemResources();
  }

  public async saveSystemResourceMetric(
    data?: SystemResourcesResponse
  ): Promise<SystemResourceHistoryEntry> {
    const res = data || (await collectSystemResources());
    const entry: SystemResourceHistoryEntry = {
      id: crypto.randomUUID(),
      cpu_usage_percent: res.cpu.usage_percent,
      cpu_cores: res.cpu.cores,
      memory_total_bytes: res.memory.total_bytes,
      memory_used_bytes: res.memory.used_bytes,
      memory_usage_percent: res.memory.usage_percent,
      disk_total_bytes: res.disk.total_bytes,
      disk_used_bytes: res.disk.used_bytes,
      disk_usage_percent: res.disk.usage_percent,
      uptime_seconds: res.uptime_seconds,
      created_at: res.timestamp || new Date().toISOString(),
    };
    this.serverMetricsHistory.push(entry);
    if (this.serverMetricsHistory.length > 1000) {
      this.serverMetricsHistory.shift();
    }
    return entry;
  }

  public async getSystemResourceHistory(
    limit = 5,
    hours?: number
  ): Promise<SystemResourceHistoryEntry[]> {
    let list = [...this.serverMetricsHistory];
    if (hours && hours > 0) {
      const cutoff = Date.now() - hours * 60 * 60 * 1000;
      list = list.filter((item) => new Date(item.created_at).getTime() >= cutoff);
    }
    const safeLimit = Math.max(1, Math.min(1000, limit));
    return list.slice(-safeLimit);
  }

  public async getTokenAnalytics(): Promise<TokenAnalyticsResponse> {
    const repo = defaultConversationService.getRepository();
    let messages: DatabaseMessage[] = [];
    if (repo instanceof InMemoryConversationRepository) {
      messages = repo.getAllMessages();
    }

    const dateMap = new Map<
      string,
      { prompt: number; completion: number; count: number }
    >();

    for (const msg of messages) {
      const dateStr = (msg.created_at || new Date().toISOString()).slice(0, 10);
      const current = dateMap.get(dateStr) || {
        prompt: 0,
        completion: 0,
        count: 0,
      };
      current.prompt +=
        msg.prompt_tokens ?? (msg.role === "user" ? msg.tokens ?? 0 : 0);
      current.completion +=
        msg.completion_tokens ?? (msg.role === "assistant" ? msg.tokens ?? 0 : 0);
      current.count++;
      dateMap.set(dateStr, current);
    }

    const dailyUsage: TokenDailyUsage[] = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let peakDay: { date: string; total_tokens: number } | null = null;

    const sortedDates = Array.from(dateMap.keys()).sort();
    for (const date of sortedDates) {
      const item = dateMap.get(date)!;
      const total = item.prompt + item.completion;
      totalPromptTokens += item.prompt;
      totalCompletionTokens += item.completion;

      if (!peakDay || total > peakDay.total_tokens) {
        if (total > 0) {
          peakDay = { date, total_tokens: total };
        }
      }

      dailyUsage.push({
        date,
        prompt_tokens: item.prompt,
        completion_tokens: item.completion,
        total_tokens: total,
        messages_count: item.count,
      });
    }

    const totalTokens = totalPromptTokens + totalCompletionTokens;
    const promptPercentage =
      totalTokens > 0 ? Math.round((totalPromptTokens / totalTokens) * 100) : 0;
    const completionPercentage =
      totalTokens > 0 ? Math.round((totalCompletionTokens / totalTokens) * 100) : 0;

    return {
      total_tokens: totalTokens,
      total_prompt_tokens: totalPromptTokens,
      total_completion_tokens: totalCompletionTokens,
      prompt_percentage: promptPercentage,
      completion_percentage: completionPercentage,
      peak_day: peakDay,
      daily_usage: dailyUsage,
    };
  }

  public async getDeletedItems(): Promise<AdminDeletedItem[]> {
    const items: AdminDeletedItem[] = [];
    const users = this.inMemoryAuth.getUsersList();
    const userMap = new Map(users.map((u) => [u.id, u]));

    const convRepo = defaultConversationService.getRepository();
    if (convRepo instanceof InMemoryConversationRepository) {
      for (const conv of convRepo.getAllConversations()) {
        if (conv.deleted_at) {
          const user = userMap.get(conv.user_id);
          items.push({
            id: conv.id,
            resource_type: "conversation",
            title: conv.title,
            user_id: conv.user_id,
            user_email: user?.email,
            user_name: user?.name || user?.email,
            created_at: conv.created_at,
            deleted_at: conv.deleted_at,
          });
        }
      }
    }

    const projRepo = defaultProjectService.getRepository();
    if (projRepo instanceof InMemoryProjectRepository) {
      for (const proj of projRepo.getAllProjects()) {
        if (proj.deleted_at) {
          const user = userMap.get(proj.user_id);
          items.push({
            id: proj.id,
            resource_type: "project",
            title: proj.name,
            user_id: proj.user_id,
            user_email: user?.email,
            user_name: user?.name || user?.email,
            created_at: proj.created_at,
            deleted_at: proj.deleted_at,
          });
        }
      }
    }

    return items.sort(
      (a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime()
    );
  }

  public async restoreItem(
    resourceType: "conversation" | "project",
    resourceId: string
  ): Promise<{ success: boolean; message: string }> {
    if (resourceType === "conversation") {
      const convRepo = defaultConversationService.getRepository();
      if (convRepo instanceof InMemoryConversationRepository) {
        const restored = convRepo.restoreConversation(resourceId);
        if (!restored) {
          throw new NotFoundError("Conversa não encontrada para restauração.");
        }
      }
    } else {
      const projRepo = defaultProjectService.getRepository();
      if (projRepo instanceof InMemoryProjectRepository) {
        const restored = projRepo.restoreProject(resourceId);
        if (!restored) {
          throw new NotFoundError("Projeto não encontrado para restauração.");
        }
      }
      const convRepo = defaultConversationService.getRepository();
      if (convRepo instanceof InMemoryConversationRepository) {
        for (const c of convRepo.getAllConversations()) {
          if (c.project_id === resourceId && c.deleted_at) {
            convRepo.restoreConversation(c.id);
          }
        }
      }
    }

    await getAuditService().log({
      action: "RESTORE_RESOURCE",
      resourceType,
      resourceId,
    });

    return {
      success: true,
      message: `${
        resourceType === "conversation" ? "Conversa" : "Projeto"
      } restaurado(a) com sucesso.`,
    };
  }

  public async getAuditLogs(limit = 100, offset = 0): Promise<AuditLogEntry[]> {
    return getAuditService().getLogs(limit, offset);
  }
}

// Instância padrão do serviço de administração
let defaultAdminServiceInstance: IAdminService;

function createDefaultAdminService(): IAdminService {
  if (env.DATABASE_URL) {
    const pool = getDbPool();
    if (pool) {
      return new PostgresAdminService(pool);
    }
  }

  const auth = getAuthService();
  if (auth instanceof InMemoryAuthService) {
    return new InMemoryAdminService(auth);
  }

  // Fallback
  return new InMemoryAdminService(new InMemoryAuthService());
}

export function getAdminService(): IAdminService {
  if (!defaultAdminServiceInstance) {
    defaultAdminServiceInstance = createDefaultAdminService();
  }
  return defaultAdminServiceInstance;
}

export function setAdminServiceForTesting(service: IAdminService): void {
  defaultAdminServiceInstance = service;
}
