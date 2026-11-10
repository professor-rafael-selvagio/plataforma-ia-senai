import React, { useEffect, useState, useMemo } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  Activity,
  ArrowLeft,
  RefreshCw,
  Search,
  Cpu,
  Zap,
  MessageSquare,
  Lock,
  UserCheck,
  UserX,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  Trash2,
  RotateCcw,
  History,
  GraduationCap,
  Briefcase,
  FileText,
  FolderKanban,
  Check,
  Server,
  HardDrive,
  Ban,
  Unlock,
  TrendingUp,
  BarChart2,
  Database,
  X,
} from "lucide-react";
import {
  AdminDeletedItem,
  AdminMetrics,
  AdminUser,
  AuditLogEntry,
  SystemResourceHistoryEntry,
  SystemResources,
  TokenAnalytics,
} from "../types";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { ConfirmModal } from "../components/ConfirmModal";
import { ResourceLineChart, ChartDataPoint } from "../components/ResourceLineChart";

interface AdminDashboardProps {
  onBackToChat: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToChat }) => {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "overview" | "users" | "trash" | "audit" | "resources"
  >("overview");

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [deletedItems, setDeletedItems] = useState<AdminDeletedItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const [systemResources, setSystemResources] = useState<SystemResources | null>(null);
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyPeriod, setHistoryPeriod] = useState<"5m" | "1h" | "6h" | "24h" | "7d">("5m");
  const [fullHistory, setFullHistory] = useState<SystemResourceHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [tokenAnalytics, setTokenAnalytics] = useState<TokenAnalytics | null>(null);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "online" | "admins" | "alunos" | "funcionarios" | "bloqueados"
  >("all");
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Modal de Confirmação e Alertas do Painel
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "warning" | "success" | "info";
    isAlert?: boolean;
    onConfirm?: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: "",
    message: "",
  });

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [metricsData, usersData, deletedData, auditData] = await Promise.all([
        api.admin.getMetrics(),
        api.admin.getUsers(),
        api.admin.getDeleted(),
        api.admin.getAuditLogs(150),
      ]);
      setMetrics(metricsData);
      setUsers(usersData);
      setDeletedItems(deletedData);
      setAuditLogs(auditData);
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Erro ao carregar dados do painel.",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadData();
      const interval = setInterval(() => {
        loadData(true);
      }, 20000);
      return () => clearInterval(interval);
    }
  }, [isAdmin]);

  // Se o usuário não for admin, bloqueia estritamente a visualização mesmo se tiver o link
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 text-center">
        <div className="w-full max-w-md bg-slate-900/90 border border-red-500/30 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
            <Lock size={28} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito</h2>
          <p className="text-sm text-slate-400 mb-6">
            Esta área é exclusiva para administradores autorizados do sistema SENAI. Seu usuário não possui permissão para acessar este painel.
          </p>
          <button
            onClick={onBackToChat}
            className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition-all shadow-lg shadow-brand-600/20 cursor-pointer"
          >
            Retornar à Área de Chat
          </button>
        </div>
      </div>
    );
  }

  const handleToggleAdminRole = (targetUser: AdminUser) => {
    if (targetUser.is_superadmin && targetUser.is_admin) {
      setModalConfig({
        isOpen: true,
        title: "Ação Não Permitida",
        message: "Não é permitido revogar a permissão do Administrador Principal.",
        variant: "danger",
        isAlert: true,
        confirmText: "Entendido",
      });
      return;
    }

    const newRole = !targetUser.is_admin;
    const actionText = newRole ? "conceder" : "revogar";
    setModalConfig({
      isOpen: true,
      title: newRole ? "Conceder Permissão de Admin" : "Revogar Permissão de Admin",
      message: `Deseja realmente ${actionText} a permissão de Administrador para "${targetUser.name || targetUser.email}"?`,
      variant: newRole ? "warning" : "danger",
      confirmText: newRole ? "Conceder Permissão" : "Revogar Permissão",
      cancelText: "Cancelar",
      onConfirm: async () => {
        setActionUserId(targetUser.id);
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          const updated = await api.admin.updateUserRole(targetUser.id, newRole);
          setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
          setNotification({
            type: "success",
            message: newRole
              ? `Permissão de Administrador concedida com sucesso para ${targetUser.name || targetUser.email}!`
              : `Permissão de Administrador revogada para ${targetUser.name || targetUser.email}.`,
          });
          loadData(true);
        } catch (err: unknown) {
          setNotification({
            type: "error",
            message: err instanceof Error ? err.message : "Erro ao atualizar permissão.",
          });
        } finally {
          setActionUserId(null);
        }
      },
    });
  };

  const handleRestoreItem = (item: AdminDeletedItem) => {
    setModalConfig({
      isOpen: true,
      title: "Restaurar Item da Lixeira",
      message: `Deseja restaurar ${item.resource_type === "conversation" ? "a conversa" : "o projeto"} "${item.title}"? O item voltará a ficar ativo imediatamente.`,
      variant: "success",
      confirmText: "Restaurar Agora",
      cancelText: "Cancelar",
      onConfirm: async () => {
        setRestoringId(item.id);
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          const msg = await api.admin.restoreItem(item.resource_type, item.id);
          setNotification({
            type: "success",
            message: msg || "Item restaurado com sucesso!",
          });
          setDeletedItems((prev) => prev.filter((i) => i.id !== item.id));
          loadData(true);
        } catch (err: unknown) {
          setNotification({
            type: "error",
            message: err instanceof Error ? err.message : "Falha ao restaurar item da lixeira.",
          });
        } finally {
          setRestoringId(null);
        }
      },
    });
  };

  const initializeResourcesWithHistory = async () => {
    setIsLoadingResources(true);
    try {
      // 1. Busca as últimas 5 medições (de 5 em 5 minutos) gravadas no banco de dados
      const pastMeasures = await api.admin.getSystemResourceHistory(5);
      const initialPoints: ChartDataPoint[] = pastMeasures.map((entry) => ({
        timeLabel: new Date(entry.created_at).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        cpu: entry.cpu_usage_percent,
        memory: entry.memory_usage_percent,
        disk: entry.disk_usage_percent,
        rawDate: entry.created_at,
        isInitial: true,
      }));

      // 2. Busca o estado atual ao vivo do servidor
      const current = await api.admin.getSystemResources();
      setSystemResources(current);

      const livePoint: ChartDataPoint = {
        timeLabel: new Date(current.timestamp).toLocaleTimeString("pt-BR"),
        cpu: current.cpu.usage_percent,
        memory: current.memory.usage_percent,
        disk: current.disk.usage_percent,
        rawDate: current.timestamp,
        isInitial: false,
      };

      setChartData([...initialPoints, livePoint]);
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Erro ao carregar recursos do servidor.",
      });
    } finally {
      setIsLoadingResources(false);
    }
  };

  const pollSystemResources = async () => {
    try {
      const res = await api.admin.getSystemResources();
      setSystemResources(res);

      const newPoint: ChartDataPoint = {
        timeLabel: new Date(res.timestamp).toLocaleTimeString("pt-BR"),
        cpu: res.cpu.usage_percent,
        memory: res.memory.usage_percent,
        disk: res.disk.usage_percent,
        rawDate: res.timestamp,
        isInitial: false,
      };

      setChartData((prev) => {
        const updated = [...prev, newPoint];
        // Mantém as medições iniciais e até 35 pontos no gráfico
        if (updated.length > 35) {
          return updated.slice(updated.length - 35);
        }
        return updated;
      });
    } catch {
      // Falhas pontuais no polling de 10s não bloqueiam a tela
    }
  };

  useEffect(() => {
    if (isAdmin && activeTab === "resources") {
      initializeResourcesWithHistory();
      // Lê as informações a cada 10 segundos
      const interval = setInterval(() => {
        pollSystemResources();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, activeTab]);

  const loadFullHistory = async (period: "5m" | "1h" | "6h" | "24h" | "7d") => {
    setHistoryPeriod(period);
    setIsLoadingHistory(true);
    try {
      let limit = 50;
      let hours: number | undefined = undefined;
      if (period === "5m") {
        limit = 5;
      } else if (period === "1h") {
        hours = 1;
        limit = 60;
      } else if (period === "6h") {
        hours = 6;
        limit = 200;
      } else if (period === "24h") {
        hours = 24;
        limit = 500;
      } else if (period === "7d") {
        hours = 168;
        limit = 1000;
      }
      const data = await api.admin.getSystemResourceHistory(limit, hours);
      setFullHistory(data);
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Erro ao carregar histórico de recursos do banco.",
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleOpenHistoryModal = () => {
    setIsHistoryModalOpen(true);
    loadFullHistory(historyPeriod);
  };

  const historyChartData: ChartDataPoint[] = useMemo(() => {
    return fullHistory.map((item) => ({
      timeLabel: new Date(item.created_at).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        day: historyPeriod === "24h" || historyPeriod === "7d" ? "2-digit" : undefined,
        month: historyPeriod === "7d" ? "2-digit" : undefined,
      }),
      cpu: item.cpu_usage_percent,
      memory: item.memory_usage_percent,
      disk: item.disk_usage_percent,
      rawDate: item.created_at,
      isInitial: true,
    }));
  }, [fullHistory, historyPeriod]);

  const handleOpenTokenAnalytics = async () => {
    setIsTokenModalOpen(true);
    setIsLoadingTokens(true);
    try {
      const data = await api.admin.getTokenAnalytics();
      setTokenAnalytics(data);
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Erro ao carregar análise de tokens.",
      });
    } finally {
      setIsLoadingTokens(false);
    }
  };

  const handleToggleBlockUser = (targetUser: AdminUser) => {
    if (targetUser.is_superadmin) {
      setModalConfig({
        isOpen: true,
        title: "Ação Não Permitida",
        message: "Não é permitido bloquear o Administrador Principal.",
        variant: "danger",
        isAlert: true,
        confirmText: "Entendido",
      });
      return;
    }

    const shouldBlock = !targetUser.is_blocked;
    const actionVerb = shouldBlock ? "bloquear o acesso de" : "desbloquear o acesso de";
    setModalConfig({
      isOpen: true,
      title: shouldBlock ? "Bloquear Usuário" : "Desbloquear Usuário",
      message: `Deseja realmente ${actionVerb} "${targetUser.name || targetUser.email}"? ${
        shouldBlock
          ? "O usuário perderá o acesso imediato ao sistema e novas tentativas de login serão bloqueadas."
          : "O usuário terá o acesso restabelecido e poderá voltar a entrar no sistema normalmente."
      }`,
      variant: shouldBlock ? "danger" : "success",
      confirmText: shouldBlock ? "Confirmar Bloqueio" : "Confirmar Desbloqueio",
      cancelText: "Cancelar",
      onConfirm: async () => {
        setBlockingUserId(targetUser.id);
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          const updated = await api.admin.blockUser(targetUser.id, shouldBlock);
          setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
          setNotification({
            type: "success",
            message: shouldBlock
              ? `Usuário ${targetUser.name || targetUser.email} foi bloqueado com sucesso!`
              : `Usuário ${targetUser.name || targetUser.email} foi desbloqueado com sucesso!`,
          });
          loadData(true);
        } catch (err: unknown) {
          setNotification({
            type: "error",
            message:
              err instanceof Error ? err.message : "Erro ao alterar bloqueio do usuário.",
          });
        } finally {
          setBlockingUserId(null);
        }
      },
    });
  };

  const formatBytesGB = (bytes: number = 0) => {
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  };

  const formatUptime = (seconds: number = 0) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);
    return parts.join(" ");
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const query = searchQuery.toLowerCase().trim();
      const matchSearch =
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        (u.ra && u.ra.toLowerCase().includes(query)) ||
        (u.nif && u.nif.toLowerCase().includes(query)) ||
        (u.cpf && u.cpf.toLowerCase().includes(query));

      if (!matchSearch) return false;

      if (statusFilter === "online") return u.is_online;
      if (statusFilter === "admins") return u.is_admin;
      if (statusFilter === "alunos") return (u.user_type || "aluno") === "aluno";
      if (statusFilter === "funcionarios") return u.user_type === "funcionario";
      if (statusFilter === "bloqueados") return Boolean(u.is_blocked);
      return true;
    });
  }, [users, searchQuery, statusFilter]);

  const formatNumber = (num: number = 0) => {
    return new Intl.NumberFormat("pt-BR").format(num);
  };

  const formatDateTime = (isoDate?: string) => {
    if (!isoDate) return "-";
    const date = new Date(isoDate);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatLastSeen = (isoDate?: string, isOnline?: boolean) => {
    if (isOnline) return "Online agora";
    if (!isoDate) return "Nunca acessou";
    const date = new Date(isoDate);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "Há menos de 1 min";
    if (diffMin < 60) return `Visto há ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Visto há ${diffHours}h`;
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-100 flex flex-col overflow-y-auto">
      {/* Topo e Barra de Navegação Fixos com Rolagem Suave Abaixo */}
      <div className="sticky top-0 z-30 shrink-0 bg-slate-950/90 backdrop-blur-md">
        {/* Topo / Barra de Navegação Superior */}
        <header className="border-b border-slate-800/80 bg-slate-900/70 px-4 md:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
              title="Voltar para a área de chats"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Voltar ao Chat</span>
            </button>

            <div className="h-5 w-px bg-slate-800 hidden sm:block" />

            <div className="flex items-center gap-2.5">
              <img
                src="/logo-senai.png"
                alt="SENAI"
                className="h-7 w-auto object-contain rounded"
              />
              <div>
                <h1 className="text-base font-bold text-white flex items-center gap-2 leading-tight">
                  Painel Administrativo
                  <span className="px-2 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-[10px] uppercase font-semibold">
                    SENAI 6.01
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400">
                  Gestão Institucional, Lixeira Exclusiva e Trilha de Auditoria
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing || isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>

            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-rose-400 flex items-center justify-center font-bold text-xs text-white shadow-md shadow-brand-600/20">
              {user?.name ? user.name.charAt(0).toUpperCase() : "A"}
            </div>
          </div>
        </header>

        {/* Navegação por Abas */}
        <div className="border-b border-slate-800/80 bg-slate-900/50 px-4 md:px-8">
          <div className="flex gap-2 overflow-x-auto py-2">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === "overview"
                  ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Activity size={15} />
              Visão Geral & Métricas
            </button>

            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === "users"
                  ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Users size={15} />
              Usuários ({users.length})
            </button>

            <button
              onClick={() => setActiveTab("trash")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === "trash"
                  ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Trash2 size={15} />
              Lixeira do Sistema ({deletedItems.length})
              {deletedItems.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("audit")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === "audit"
                  ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <History size={15} />
              Trilha de Auditoria ({auditLogs.length})
            </button>

            <button
              onClick={() => setActiveTab("resources")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === "resources"
                  ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Server size={15} />
              Recursos do Servidor
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal com Rolagem Suave */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto space-y-6 pb-20">
        {/* Notificações de Ação */}
        {notification && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between text-sm ${
              notification.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "success" ? (
                <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle size={18} className="shrink-0 text-red-400" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

        {/* ABA 1: VISÃO GERAL */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Cards de Métricas Principais (Clicáveis) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total de Usuários */}
              <div
                onClick={() => {
                  setActiveTab("users");
                  setStatusFilter("all");
                }}
                className="bg-slate-900/60 border border-slate-800/80 hover:border-blue-500/50 hover:bg-slate-900/90 rounded-2xl p-5 backdrop-blur-sm cursor-pointer transition-all group"
                title="Clique para gerenciar usuários cadastrados"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-400 group-hover:text-blue-300 uppercase tracking-wider transition-colors">
                    Usuários Cadastrados
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users size={16} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white">
                  {formatNumber(metrics?.total_users)}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-sky-400">
                      <GraduationCap size={12} /> {metrics?.total_alunos || 0} Alunos
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 text-purple-400">
                      <Briefcase size={12} /> {metrics?.total_funcionarios || 0} Funcs
                    </span>
                  </div>
                  <span className="text-[10px] text-blue-400 group-hover:translate-x-0.5 transition-transform font-medium">
                    Ver todos →
                  </span>
                </div>
              </div>

              {/* Usuários Online */}
              <div
                onClick={() => {
                  setActiveTab("users");
                  setStatusFilter("online");
                }}
                className="bg-slate-900/60 border border-slate-800/80 hover:border-emerald-500/50 hover:bg-slate-900/90 rounded-2xl p-5 backdrop-blur-sm cursor-pointer transition-all group"
                title="Clique para ver os usuários online agora"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-400 group-hover:text-emerald-300 uppercase tracking-wider transition-colors">
                    Online Agora
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Activity size={16} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                  </span>
                  {formatNumber(metrics?.online_users)}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                  <p className="text-[11px] text-slate-500">
                    Ativos nos últimos 3 min
                  </p>
                  <span className="text-[10px] text-emerald-400 group-hover:translate-x-0.5 transition-transform font-medium">
                    Filtrar online →
                  </span>
                </div>
              </div>

              {/* Tokens Consumidos */}
              <div
                onClick={handleOpenTokenAnalytics}
                className="bg-slate-900/60 border border-slate-800/80 hover:border-brand-500/50 hover:bg-slate-900/90 rounded-2xl p-5 backdrop-blur-sm cursor-pointer transition-all group"
                title="Clique para ver gráficos de entrada vs saída e dia de pico"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-400 group-hover:text-brand-300 uppercase tracking-wider transition-colors">
                    Tokens Totais
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <BarChart2 size={16} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white">
                  {formatNumber(metrics?.total_tokens)}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span title="Tokens de Entrada (Prompt)" className="text-indigo-300">
                      Entrada: {formatNumber(metrics?.total_prompt_tokens)}
                    </span>
                    <span>•</span>
                    <span title="Tokens de Saída (Geração)" className="text-brand-400">
                      Saída: {formatNumber(metrics?.total_completion_tokens)}
                    </span>
                  </div>
                  <span className="text-[10px] text-brand-400 group-hover:translate-x-0.5 transition-transform font-medium">
                    Gráficos →
                  </span>
                </div>
              </div>

              {/* Lixeira do Sistema */}
              <div
                onClick={() => setActiveTab("trash")}
                className="bg-slate-900/60 border border-slate-800/80 hover:border-amber-500/50 hover:bg-slate-900/90 rounded-2xl p-5 backdrop-blur-sm cursor-pointer transition-all group"
                title="Clique para abrir a lixeira do sistema"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-400 group-hover:text-amber-300 uppercase tracking-wider transition-colors">
                    Itens na Lixeira
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Trash2 size={16} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-amber-400">
                  {formatNumber(deletedItems.length)}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>{metrics?.deleted_conversations || 0} Chats</span>
                    <span>•</span>
                    <span>{metrics?.deleted_projects || 0} Projetos</span>
                  </div>
                  <span className="text-[10px] text-amber-400 group-hover:translate-x-0.5 transition-transform font-medium">
                    Abrir lixeira →
                  </span>
                </div>
              </div>
            </div>

            {/* Informações Institucionais do Sistema */}
            <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sparkles size={16} className="text-brand-400" />
                  Ambiente de Inteligência Artificial Didática SENAI
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Sistema dedicado para aprendizagem com modelos abertos (Llama, DeepSeek, Qwen) executados em servidor local. Exclusões no sistema utilizam exclusão lógica (*soft delete*), garantindo conformidade e trilha de auditoria para fins pedagógicos.
                </p>
              </div>
              <button
                onClick={() => setActiveTab("trash")}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors flex items-center gap-2 shrink-0 cursor-pointer"
              >
                <Trash2 size={14} className="text-amber-400" />
                Explorar Lixeira ({deletedItems.length})
              </button>
            </div>
          </div>
        )}

        {/* ABA 2: USUÁRIOS & PERMISSÕES */}
        {activeTab === "users" && (
          <div className="space-y-4">
            {/* Barra de Filtros e Busca */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-slate-900/60 border border-slate-800/80 p-3 rounded-2xl">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome, e-mail, RA, NIF ou CPF..."
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === "all"
                      ? "bg-brand-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Todos ({users.length})
                </button>
                <button
                  onClick={() => setStatusFilter("online")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === "online"
                      ? "bg-brand-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Online ({users.filter((u) => u.is_online).length})
                </button>
                <button
                  onClick={() => setStatusFilter("admins")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === "admins"
                      ? "bg-brand-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Admins ({users.filter((u) => u.is_admin).length})
                </button>
                <button
                  onClick={() => setStatusFilter("alunos")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === "alunos"
                      ? "bg-brand-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Alunos
                </button>
                <button
                  onClick={() => setStatusFilter("funcionarios")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === "funcionarios"
                      ? "bg-brand-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Funcionários
                </button>
                <button
                  onClick={() => setStatusFilter("bloqueados")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    statusFilter === "bloqueados"
                      ? "bg-red-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Bloqueados ({users.filter((u) => u.is_blocked).length})
                </button>
              </div>
            </div>

            {/* Tabela de Usuários */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Usuário</th>
                      <th className="py-3 px-4">Perfil</th>
                      <th className="py-3 px-4">Documento</th>
                      <th className="py-3 px-4">Status / Último Acesso</th>
                      <th className="py-3 px-4">Tokens Entrada / Saída</th>
                      <th className="py-3 px-4 text-center">Permissão Admin</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          Nenhum usuário encontrado com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isSuperAdmin = Boolean(u.is_superadmin);

                        return (
                          <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                            {/* Nome & Email */}
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-white">{u.name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                {u.email}
                              </div>
                            </td>

                            {/* Perfil */}
                            <td className="py-3.5 px-4">
                              {u.user_type === "funcionario" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 border border-purple-500/20 text-purple-400">
                                  <Briefcase size={10} /> Funcionário
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 border border-sky-500/20 text-sky-400">
                                  <GraduationCap size={10} /> Aluno
                                </span>
                              )}
                            </td>

                            {/* RA / NIF / CPF */}
                            <td className="py-3.5 px-4 font-mono text-[11px]">
                              {u.nif && (
                                <span className="text-purple-300" title="NIF">
                                  NIF: {u.nif}
                                </span>
                              )}
                              {u.ra && (
                                <span className="text-sky-300" title="RA">
                                  RA: {u.ra}
                                </span>
                              )}
                              {u.cpf && (
                                <span className="text-slate-400" title="CPF">
                                  CPF: {u.cpf}
                                </span>
                              )}
                              {!u.nif && !u.ra && !u.cpf && (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {u.is_blocked ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/20 border border-red-500/40 text-red-300">
                                    <Ban size={10} /> Bloqueado
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`w-2 h-2 rounded-full ${
                                        u.is_online
                                          ? "bg-emerald-400 ring-2 ring-emerald-500/30"
                                          : "bg-slate-600"
                                      }`}
                                    />
                                    <span className={u.is_online ? "text-emerald-400 font-medium" : "text-slate-400"}>
                                      {formatLastSeen(u.last_seen_at, u.is_online)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Tokens */}
                            <td className="py-3.5 px-4 font-mono text-[11px]">
                              <span className="text-slate-300" title="Tokens Entrada">
                                {formatNumber(u.total_prompt_tokens)}
                              </span>{" "}
                              /{" "}
                              <span className="text-brand-400" title="Tokens Saída">
                                {formatNumber(u.total_completion_tokens)}
                              </span>
                            </td>

                            {/* Admin Badge */}
                            <td className="py-3.5 px-4 text-center">
                              {u.is_admin ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/10 border border-brand-500/20 text-brand-400">
                                  <ShieldCheck size={12} />
                                  Admin
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[11px]">Usuário</span>
                              )}
                            </td>

                            {/* Ações */}
                            <td className="py-3.5 px-4 text-right">
                              {isSuperAdmin ? (
                                <span className="text-[10px] text-brand-400/80 font-medium">
                                  Superadmin
                                </span>
                              ) : (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleToggleAdminRole(u)}
                                    disabled={actionUserId === u.id || blockingUserId === u.id}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                                      u.is_admin
                                        ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                                        : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                                    }`}
                                  >
                                    {actionUserId === u.id ? (
                                      <RefreshCw size={12} className="animate-spin inline mr-1" />
                                    ) : null}
                                    {u.is_admin ? "Revogar Admin" : "Tornar Admin"}
                                  </button>

                                  <button
                                    onClick={() => handleToggleBlockUser(u)}
                                    disabled={blockingUserId === u.id || actionUserId === u.id}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                                      u.is_blocked
                                        ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                        : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                    }`}
                                    title={u.is_blocked ? "Desbloquear acesso do usuário" : "Bloquear acesso do usuário"}
                                  >
                                    {blockingUserId === u.id ? (
                                      <RefreshCw size={12} className="animate-spin inline" />
                                    ) : u.is_blocked ? (
                                      <Unlock size={12} />
                                    ) : (
                                      <Ban size={12} />
                                    )}
                                    <span>{u.is_blocked ? "Desbloquear" : "Bloquear"}</span>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ABA 3: LIXEIRA DO SISTEMA (EXCLUSIVA ADMIN) */}
        {activeTab === "trash" && (
          <div className="space-y-4">
            <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Trash2 size={16} className="text-amber-400" />
                  Lixeira do Sistema (Exclusiva para Administradores)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Itens marcados com exclusão lógica (*soft delete*). Podem ser restaurados instantaneamente sem perda de mensagens.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                {deletedItems.length} itens encontrados
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Título / Nome</th>
                      <th className="py-3 px-4">Proprietário</th>
                      <th className="py-3 px-4">Data da Exclusão</th>
                      <th className="py-3 px-4 text-right">Restauração</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {deletedItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-500">
                          <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500/40" />
                          A lixeira está vazia. Nenhum chat ou projeto excluído no momento.
                        </td>
                      </tr>
                    ) : (
                      deletedItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4">
                            {item.resource_type === "conversation" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-400">
                                <MessageSquare size={11} /> Conversa
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                                <FolderKanban size={11} /> Projeto
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-white">
                            {item.title}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-slate-300">{item.user_name || item.user_email}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {item.user_email}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                            {formatDateTime(item.deleted_at)}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleRestoreItem(item)}
                              disabled={restoringId === item.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all flex items-center gap-1.5 ml-auto cursor-pointer"
                            >
                              <RotateCcw
                                size={12}
                                className={restoringId === item.id ? "animate-spin" : ""}
                              />
                              Restaurar Item
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ABA 4: TRILHA DE AUDITORIA */}
        {activeTab === "audit" && (
          <div className="space-y-4">
            <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <History size={16} className="text-brand-400" />
                  Trilha de Auditoria do Sistema (*Audit Logs*)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Histórico completo de autenticações, cadastros, exclusões e concessões de privilégios.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                {auditLogs.length} registros recentes
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Ação</th>
                      <th className="py-3 px-4">Usuário</th>
                      <th className="py-3 px-4">Recurso / ID</th>
                      <th className="py-3 px-4">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-500">
                          Nenhum registro de auditoria capturado até o momento.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => {
                        let badgeColor = "bg-slate-800 text-slate-300 border-slate-700";
                        if (log.action.includes("REGISTER") || log.action.includes("GRANT")) {
                          badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                        } else if (log.action.includes("DELETE") || log.action.includes("REVOKE")) {
                          badgeColor = "bg-red-500/10 text-red-400 border-red-500/20";
                        } else if (log.action.includes("RESTORE")) {
                          badgeColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                        } else if (log.action.includes("LOGIN")) {
                          badgeColor = "bg-purple-500/10 text-purple-400 border-purple-500/20";
                        }

                        return (
                          <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                              {formatDateTime(log.created_at)}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border ${badgeColor}`}
                              >
                                {log.action}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px]">
                              {log.user_email || log.user_id || "Sistema"}
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-slate-300 capitalize">{log.resource_type}</span>
                              {log.resource_id && (
                                <span className="block text-[10px] text-slate-500 font-mono truncate max-w-[150px]">
                                  {log.resource_id}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-400 truncate max-w-xs">
                              {log.details ? JSON.stringify(log.details) : "-"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ABA 5: RECURSOS DO SERVIDOR */}
        {activeTab === "resources" && (
          <div className="space-y-6">
            {/* Topo / Status */}
            <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Server size={18} className="text-brand-400" />
                  Monitoramento de Recursos do Servidor
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Consumo de processamento (CPU), memória RAM e armazenamento no host em tempo real.
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <span className="text-emerald-400 font-medium">Tempo Real (10s)</span>
                </div>
                <button
                  onClick={handleOpenHistoryModal}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 border border-brand-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Acessar histórico de leituras salvas a cada 5 minutos no banco de dados"
                >
                  <Database size={13} />
                  <span>Histórico do Banco (5 min)</span>
                </button>
                <button
                  onClick={() => initializeResourcesWithHistory()}
                  disabled={isLoadingResources}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={12} className={isLoadingResources ? "animate-spin" : ""} />
                  Atualizar
                </button>
              </div>
            </div>

            {isLoadingResources && !systemResources ? (
              <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw size={28} className="animate-spin text-brand-400" />
                <p className="text-xs">Lendo sensores do servidor...</p>
              </div>
            ) : systemResources ? (
              <div className="space-y-6">
                {/* Grid de Métricas de Hardware */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Card CPU */}
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                            <Cpu size={16} />
                          </div>
                          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                            Processamento (CPU)
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {systemResources.cpu.cores} núcleos
                        </span>
                      </div>

                      <div className="flex items-baseline gap-2 mb-3">
                        <div
                          className={`text-3xl font-extrabold ${
                            systemResources.cpu.usage_percent >= 85
                              ? "text-red-400"
                              : systemResources.cpu.usage_percent >= 60
                              ? "text-amber-400"
                              : "text-emerald-400"
                          }`}
                        >
                          {systemResources.cpu.usage_percent}%
                        </div>
                        <span className="text-xs text-slate-400">em uso</span>
                      </div>

                      {/* Barra de Progresso */}
                      <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden mb-4">
                        <div
                          style={{ width: `${Math.min(100, systemResources.cpu.usage_percent)}%` }}
                          className={`h-full transition-all duration-500 ${
                            systemResources.cpu.usage_percent >= 85
                              ? "bg-red-500"
                              : systemResources.cpu.usage_percent >= 60
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400">
                      <div className="flex justify-between">
                        <span>Modelo:</span>
                        <span
                          className="text-slate-200 font-medium truncate max-w-[170px]"
                          title={systemResources.cpu.model}
                        >
                          {systemResources.cpu.model}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Carga (1m / 5m / 15m):</span>
                        <span className="text-slate-200 font-mono">
                          {systemResources.cpu.load_avg.map((v) => v.toFixed(2)).join(" / ")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Memória RAM */}
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                            <Zap size={16} />
                          </div>
                          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                            Memória RAM
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          Total: {formatBytesGB(systemResources.memory.total_bytes)}
                        </span>
                      </div>

                      <div className="flex items-baseline gap-2 mb-3">
                        <div
                          className={`text-3xl font-extrabold ${
                            systemResources.memory.usage_percent >= 85
                              ? "text-red-400"
                              : systemResources.memory.usage_percent >= 70
                              ? "text-amber-400"
                              : "text-purple-400"
                          }`}
                        >
                          {systemResources.memory.usage_percent}%
                        </div>
                        <span className="text-xs text-slate-400">
                          ({formatBytesGB(systemResources.memory.used_bytes)} usada)
                        </span>
                      </div>

                      {/* Barra de Progresso */}
                      <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden mb-4">
                        <div
                          style={{
                            width: `${Math.min(100, systemResources.memory.usage_percent)}%`,
                          }}
                          className={`h-full transition-all duration-500 ${
                            systemResources.memory.usage_percent >= 85
                              ? "bg-red-500"
                              : systemResources.memory.usage_percent >= 70
                              ? "bg-amber-500"
                              : "bg-purple-500"
                          }`}
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400">
                      <div className="flex justify-between">
                        <span>Memória Livre:</span>
                        <span className="text-emerald-400 font-medium">
                          {formatBytesGB(systemResources.memory.free_bytes)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Memória Alocada:</span>
                        <span className="text-slate-200 font-medium">
                          {formatBytesGB(systemResources.memory.used_bytes)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Armazenamento (Disco) */}
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                            <HardDrive size={16} />
                          </div>
                          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                            Disco / Armazenamento
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          Total: {formatBytesGB(systemResources.disk.total_bytes)}
                        </span>
                      </div>

                      <div className="flex items-baseline gap-2 mb-3">
                        <div
                          className={`text-3xl font-extrabold ${
                            systemResources.disk.usage_percent >= 90
                              ? "text-red-400"
                              : systemResources.disk.usage_percent >= 75
                              ? "text-amber-400"
                              : "text-amber-300"
                          }`}
                        >
                          {systemResources.disk.usage_percent}%
                        </div>
                        <span className="text-xs text-slate-400">
                          ({formatBytesGB(systemResources.disk.used_bytes)} ocupado)
                        </span>
                      </div>

                      {/* Barra de Progresso */}
                      <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden mb-4">
                        <div
                          style={{ width: `${Math.min(100, systemResources.disk.usage_percent)}%` }}
                          className={`h-full transition-all duration-500 ${
                            systemResources.disk.usage_percent >= 90
                              ? "bg-red-500"
                              : systemResources.disk.usage_percent >= 75
                              ? "bg-amber-500"
                              : "bg-amber-500"
                          }`}
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400">
                      <div className="flex justify-between">
                        <span>Espaço Disponível:</span>
                        <span className="text-emerald-400 font-medium">
                          {formatBytesGB(systemResources.disk.free_bytes)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Espaço Utilizado:</span>
                        <span className="text-slate-200 font-medium">
                          {formatBytesGB(systemResources.disk.used_bytes)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card de Informações do Sistema e Uptime */}
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center">
                      <Clock size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Tempo Ligado (Uptime)
                      </span>
                      <div className="text-base font-bold text-white font-mono mt-0.5">
                        {formatUptime(systemResources.uptime_seconds)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Plataforma</span>
                      <span className="text-slate-200 font-medium">{systemResources.platform}</span>
                    </div>
                    <div className="h-6 w-px bg-slate-800" />
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Hostname</span>
                      <span className="text-slate-200 font-mono">{systemResources.hostname}</span>
                    </div>
                    <div className="h-6 w-px bg-slate-800" />
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Última Leitura</span>
                      <span className="text-slate-200 font-mono">
                        {new Date(systemResources.timestamp).toLocaleTimeString("pt-BR")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Gráfico de Linha em Tempo Real (Leitura a cada 10s) */}
                <ResourceLineChart
                  data={chartData}
                  title="Gráfico de Linha em Tempo Real (Leitura a cada 10s)"
                  subtitle="Iniciado com as últimas 5 medições de 5 minutos do banco e atualizado continuamente a cada 10 segundos."
                />
              </div>
            ) : null}
          </div>
        )}
      </main>

      {/* MODAL: ANÁLISE DETALHADA DE TOKENS (ENTRADA VS SAÍDA E DIA DE PICO) */}
      {isTokenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-2xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Topo do Modal */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center">
                  <BarChart2 size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Análise Detalhada de Tokens</h2>
                  <p className="text-xs text-slate-400">
                    Comparativo Entrada (Prompt) vs Saída (Geração) e Picos de Consumo
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTokenModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {isLoadingTokens ? (
              <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw size={24} className="animate-spin text-brand-400" />
                <p className="text-xs">Carregando métricas de tokens...</p>
              </div>
            ) : tokenAnalytics ? (
              <div className="space-y-6">
                {/* Cards Principais */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase">
                      Tokens Totais
                    </span>
                    <div className="text-xl font-bold text-white mt-1">
                      {formatNumber(tokenAnalytics.total_tokens)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">Volume acumulado</div>
                  </div>

                  <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/20">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-indigo-400 uppercase">
                        Entrada (Prompt)
                      </span>
                      <span className="text-xs font-mono font-bold text-indigo-400">
                        {tokenAnalytics.prompt_percentage}%
                      </span>
                    </div>
                    <div className="text-xl font-bold text-indigo-200 mt-1">
                      {formatNumber(tokenAnalytics.total_prompt_tokens)}
                    </div>
                    <div className="text-[11px] text-indigo-400/70 mt-1">
                      Perguntas e contexto enviados
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-rose-950/30 border border-brand-500/20">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-brand-400 uppercase">
                        Saída (Geração)
                      </span>
                      <span className="text-xs font-mono font-bold text-brand-400">
                        {tokenAnalytics.completion_percentage}%
                      </span>
                    </div>
                    <div className="text-xl font-bold text-rose-200 mt-1">
                      {formatNumber(tokenAnalytics.total_completion_tokens)}
                    </div>
                    <div className="text-[11px] text-brand-400/70 mt-1">
                      Respostas geradas pelos modelos
                    </div>
                  </div>
                </div>

                {/* Barra Proporcional */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs text-slate-300 font-medium">
                    <span>Proporção Entrada vs Saída</span>
                    <span className="text-slate-400 font-mono">
                      {tokenAnalytics.prompt_percentage}% / {tokenAnalytics.completion_percentage}%
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex">
                    <div
                      style={{ width: `${tokenAnalytics.prompt_percentage}%` }}
                      className="bg-indigo-500 h-full transition-all"
                      title={`Entrada: ${tokenAnalytics.prompt_percentage}%`}
                    />
                    <div
                      style={{ width: `${tokenAnalytics.completion_percentage}%` }}
                      className="bg-brand-500 h-full transition-all"
                      title={`Saída: ${tokenAnalytics.completion_percentage}%`}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" /> Entrada
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-brand-500" /> Saída
                    </span>
                  </div>
                </div>

                {/* Card do Dia de Pico */}
                {tokenAnalytics.peak_day && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-brand-500/10 to-transparent border border-amber-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                        <TrendingUp size={18} />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                          Dia com Maior Consumo (Pico)
                        </span>
                        <div className="text-base font-bold text-white mt-0.5">
                          {tokenAnalytics.peak_day.date.split("-").reverse().join("/")}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-amber-400 font-mono">
                        {formatNumber(tokenAnalytics.peak_day.total_tokens)} tokens
                      </div>
                      <div className="text-[11px] text-slate-400">Recorde de uso diário</div>
                    </div>
                  </div>
                )}

                {/* Histórico Diário */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Histórico Diário de Uso ({tokenAnalytics.daily_usage.length} dias registrados)
                  </h3>
                  {tokenAnalytics.daily_usage.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">
                      Nenhuma mensagem registrada no período.
                    </p>
                  ) : (
                    <div className="border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 text-[11px] border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">Data</th>
                            <th className="py-2.5 px-3">Mensagens</th>
                            <th className="py-2.5 px-3 text-indigo-400">Entrada</th>
                            <th className="py-2.5 px-3 text-brand-400">Saída</th>
                            <th className="py-2.5 px-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                          {tokenAnalytics.daily_usage.map((d) => (
                            <tr key={d.date} className="hover:bg-slate-800/30">
                              <td className="py-2.5 px-3 text-slate-300">
                                {d.date.split("-").reverse().join("/")}
                              </td>
                              <td className="py-2.5 px-3 text-slate-400">
                                {formatNumber(d.messages_count)}
                              </td>
                              <td className="py-2.5 px-3 text-indigo-300">
                                {formatNumber(d.prompt_tokens)}
                              </td>
                              <td className="py-2.5 px-3 text-rose-300">
                                {formatNumber(d.completion_tokens)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-white">
                                {formatNumber(d.total_tokens)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* MODAL: HISTÓRICO COMPLETO DE RECURSOS PERSISTIDO NO BANCO (5 EM 5 MIN) */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Topo do Modal */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center">
                  <Database size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Histórico Persistido dos Recursos do Servidor
                  </h2>
                  <p className="text-xs text-slate-400">
                    Acesso aos dados gravados no banco de dados a cada 5 minutos
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Seletor de Período do Histórico */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400 font-medium mr-1">Filtrar período:</span>
                {(
                  [
                    { key: "5m", label: "5 Medições (~25 min)" },
                    { key: "1h", label: "Última 1 hora" },
                    { key: "6h", label: "Últimas 6 horas" },
                    { key: "24h", label: "Últimas 24 horas" },
                    { key: "7d", label: "Últimos 7 dias" },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => loadFullHistory(p.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      historyPeriod === p.key
                        ? "bg-brand-600 text-white shadow-sm"
                        : "bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => loadFullHistory(historyPeriod)}
                disabled={isLoadingHistory}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <RefreshCw size={12} className={isLoadingHistory ? "animate-spin" : ""} />
                Recarregar
              </button>
            </div>

            {isLoadingHistory ? (
              <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw size={28} className="animate-spin text-brand-400" />
                <p className="text-xs">Carregando medições históricas do banco...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Métricas Resumidas do Período */}
                {fullHistory.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl">
                      <span className="text-slate-400 block text-[11px]">Medições no Período</span>
                      <span className="text-base font-bold text-white font-mono">
                        {fullHistory.length} registros
                      </span>
                    </div>

                    <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl">
                      <span className="text-slate-400 block text-[11px]">Média de CPU</span>
                      <span className="text-base font-bold text-sky-400 font-mono">
                        {(
                          fullHistory.reduce((acc, h) => acc + h.cpu_usage_percent, 0) /
                          fullHistory.length
                        ).toFixed(1)}
                        %
                      </span>
                    </div>

                    <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl">
                      <span className="text-slate-400 block text-[11px]">Pico de CPU</span>
                      <span className="text-base font-bold text-red-400 font-mono">
                        {Math.max(...fullHistory.map((h) => h.cpu_usage_percent))}%
                      </span>
                    </div>

                    <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl">
                      <span className="text-slate-400 block text-[11px]">Média de Memória</span>
                      <span className="text-base font-bold text-purple-400 font-mono">
                        {(
                          fullHistory.reduce((acc, h) => acc + h.memory_usage_percent, 0) /
                          fullHistory.length
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                  </div>
                )}

                {/* Gráfico de Linha do Histórico */}
                <ResourceLineChart
                  data={historyChartData}
                  title={`Gráfico Histórico (${fullHistory.length} medições registradas)`}
                  subtitle="Evolução de processamento, memória RAM e disco gravados pelo coletor a cada 5 minutos."
                />

                {/* Tabela com Todos os Registros Históricos */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Lista de Registros no Banco ({fullHistory.length})</span>
                    <span className="text-slate-500 font-normal normal-case">
                      Ordem cronológica mais recente no topo
                    </span>
                  </h3>

                  {fullHistory.length === 0 ? (
                    <div className="text-center py-10 bg-slate-950/40 border border-slate-800/80 rounded-xl text-slate-400 text-xs">
                      Nenhuma medição encontrada para o período selecionado.
                    </div>
                  ) : (
                    <div className="border border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 text-[11px] border-b border-slate-800 sticky top-0 z-10">
                          <tr>
                            <th className="py-2.5 px-3">Data e Hora</th>
                            <th className="py-2.5 px-3 text-sky-400">CPU (%)</th>
                            <th className="py-2.5 px-3 text-purple-400">Memória RAM (%)</th>
                            <th className="py-2.5 px-3 text-purple-300">RAM (Usada / Total)</th>
                            <th className="py-2.5 px-3 text-amber-400">Disco (%)</th>
                            <th className="py-2.5 px-3 text-right">Uptime</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                          {[...fullHistory].reverse().map((entry) => (
                            <tr key={entry.id} className="hover:bg-slate-800/30">
                              <td className="py-2.5 px-3 text-slate-300">
                                {new Date(entry.created_at).toLocaleString("pt-BR")}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-sky-300">
                                {entry.cpu_usage_percent}%
                              </td>
                              <td className="py-2.5 px-3 font-bold text-purple-300">
                                {entry.memory_usage_percent}%
                              </td>
                              <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                                {entry.memory_used_bytes && entry.memory_total_bytes
                                  ? `${formatBytesGB(entry.memory_used_bytes)} / ${formatBytesGB(
                                      entry.memory_total_bytes
                                    )}`
                                  : "-"}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-amber-300">
                                {entry.disk_usage_percent}%
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-400">
                                {formatUptime(entry.uptime_seconds)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Reutilizável de Confirmação e Alertas */}
      <ConfirmModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
        variant={modalConfig.variant}
        isAlert={modalConfig.isAlert}
      />
    </div>
  );
};
