/**
 * Definições de tipos para o Backend Ollama
 */

export interface OllamaModelDetails {
  format?: string;
  family?: string;
  families?: string[];
  parameter_size?: string;
  quantization_level?: string;
}

export interface OllamaModel {
  name: string;
  model?: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: OllamaModelDetails;
}

export interface OllamaTagsResponse {
  models: OllamaModel[];
}

export interface OllamaGenerationOptions {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  num_predict?: number;
  stop?: string[];
  seed?: number;
}

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  template?: string;
  context?: number[];
  options?: OllamaGenerationOptions;
  stream?: boolean;
  keep_alive?: string | number;
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[];
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  options?: OllamaGenerationOptions;
  stream?: boolean;
  keep_alive?: string | number;
}

export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: OllamaChatMessage;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export type UserType = "aluno" | "funcionario";

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  user_type?: UserType;
  ra?: string;
  cpf?: string;
  nif?: string;
  is_admin?: boolean;
  is_superadmin?: boolean;
  is_blocked?: boolean;
  last_seen_at?: string;
  deleted_at?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  color: string;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  project_id?: string | null;
  title: string;
  model: string;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithConversations extends Project {
  conversations: Conversation[];
}

export interface DatabaseMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "system" | "user" | "assistant";
  content: string;
  tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  deleted_at?: string | null;
  created_at: string;
}

export interface ConversationWithMessages extends Conversation {
  messages: DatabaseMessage[];
}

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  user_type?: UserType;
  ra?: string;
  cpf?: string;
  nif?: string;
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

export interface AdminMetricsResponse {
  total_users: number;
  total_alunos: number;
  total_funcionarios: number;
  online_users: number;
  total_conversations: number;
  total_messages: number;
  deleted_conversations: number;
  deleted_projects: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
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

export interface RestoreItemInput {
  resource_type: "conversation" | "project";
  resource_id: string;
}

export interface UpdateUserRoleInput {
  is_admin: boolean;
}

export interface BlockUserInput {
  is_blocked: boolean;
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

export interface SystemResourcesResponse {
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

export interface TokenAnalyticsResponse {
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

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

