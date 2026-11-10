export type UserType = "aluno" | "funcionario";

export interface User {
  id: string;
  email: string;
  name?: string;
  user_type?: UserType;
  ra?: string;
  cpf?: string;
  nif?: string;
  role?: string;
  is_admin?: boolean;
  is_superadmin?: boolean;
  is_blocked?: boolean;
  last_seen_at?: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  project_id?: string | null;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "system" | "user" | "assistant";
  content: string;
  tokens?: number;
  created_at: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: DatabaseMessage[];
}

export interface OllamaModel {
  name: string;
  size?: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  user_type?: UserType;
  ra?: string;
  cpf?: string;
  nif?: string;
  deleted_at?: string | null;
  is_admin: boolean;
  is_superadmin?: boolean;
  is_blocked?: boolean;
  is_online: boolean;
  last_seen_at: string;
  created_at: string;
  total_conversations: number;
  total_messages: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
}

export interface AdminMetrics {
  total_users: number;
  total_alunos: number;
  total_funcionarios: number;
  online_users: number;
  total_conversations: number;
  deleted_conversations: number;
  deleted_projects: number;
  total_messages: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
}

export interface AdminDeletedItem {
  id: string;
  resource_type: "conversation" | "project";
  title: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  created_at: string;
  deleted_at: string;
}

export interface AuditLogEntry {
  id: string;
  user_id?: string | null;
  user_email?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  details?: Record<string, unknown>;
  ip_address?: string | null;
  created_at: string;
}

export interface SystemCpuInfo {
  usage_percent: number;
  cores: number;
  model: string;
  load_avg: number[];
}

export interface SystemMemoryInfo {
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  usage_percent: number;
}

export interface SystemDiskInfo {
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  usage_percent: number;
}

export interface SystemResources {
  cpu: SystemCpuInfo;
  memory: SystemMemoryInfo;
  disk: SystemDiskInfo;
  uptime_seconds: number;
  platform: string;
  hostname: string;
  timestamp: string;
}

export interface SystemResourceHistoryEntry {
  id: string;
  cpu_usage_percent: number;
  cpu_cores: number;
  memory_total_bytes: number;
  memory_used_bytes: number;
  memory_usage_percent: number;
  disk_total_bytes: number;
  disk_used_bytes: number;
  disk_usage_percent: number;
  uptime_seconds: number;
  created_at: string;
}

export interface TokenDailyUsage {
  date: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  messages_count: number;
}

export interface TokenAnalytics {
  total_tokens: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  prompt_percentage: number;
  completion_percentage: number;
  peak_day: {
    date: string;
    total_tokens: number;
  } | null;
  daily_usage: TokenDailyUsage[];
}
