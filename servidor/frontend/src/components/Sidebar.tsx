import React, { useState } from "react";
import {
  MessageSquare,
  Plus,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  LogOut,
  Trash2,
  Edit2,
  Folder,
  FolderInput,
  Layers,
  Sparkles,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { Conversation, Project, User } from "../types";

interface SidebarProps {
  projects: Project[];
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: (projectId?: string | null) => void;
  onOpenProjectModal: (projectToEdit?: Project | null) => void;
  onDeleteProject: (projectId: string) => void;
  onOpenRenameModal: (conversation: Conversation) => void;
  onDeleteConversation: (conversationId: string) => void;
  user: User | null;
  onLogout: () => void;
  onOpenProfileModal?: () => void;
  onOpenAdmin?: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  projects,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onOpenProjectModal,
  onDeleteProject,
  onOpenRenameModal,
  onDeleteConversation,
  user,
  onLogout,
  onOpenProfileModal,
  onOpenAdmin,
  isOpenMobile,
  onCloseMobile,
}) => {
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const toggleProject = (projectId: string) => {
    setCollapsedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  // Separa conversas por projeto
  const unassignedConversations = conversations.filter((c) => !c.project_id);

  return (
    <>
      {/* Overlay para Mobile */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 bg-slate-900 border-r border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out ${isOpenMobile ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
      >
        {/* Topo / Logo */}
        <div className="p-4 border-b border-slate-800/60 flex items-center justify-between">
          <div className="flex flex-col items-center gap-3 w-full">
            <img
              src="/logo-senai.png"
              alt="SENAI"
              className="w-full h-auto object-contain rounded"
            />

            <div className="text-center">
              <h2 className="font-bold text-sm tracking-tight text-white leading-tight">
                Escola SENAI "Antonio A. Lobbe"
              </h2>

              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Servidor Didático - IA
              </span>
            </div>
          </div>
        </div>

        {/* Botão Novo Chat e Painel Administrativo */}
        <div className="p-3 pb-2 space-y-2">
          <button
            onClick={() => {
              onNewChat(null);
              onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-all shadow-md shadow-brand-600/20 cursor-pointer"
          >
            <Plus size={18} />
            <span>Novo Chat</span>
          </button>

          {Boolean(user?.is_admin || user?.is_superadmin) && onOpenAdmin && (
            <button
              onClick={() => {
                onOpenAdmin();
                onCloseMobile();
              }}
              className="w-full flex items-center justify-center gap-2 bg-slate-800/90 hover:bg-slate-800 text-amber-300 hover:text-amber-200 border border-amber-500/30 hover:border-amber-500/50 font-medium py-2 px-3 rounded-xl text-xs transition-all cursor-pointer shadow-sm"
              title="Acessar o Painel de Controle de Administrador"
            >
              <ShieldCheck size={15} className="text-amber-400" />
              <span>Painel Administrativo</span>
            </button>
          )}
        </div>

        {/* Lista com Rolagem */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
          {/* Seção de Projetos */}
          <div>
            <div className="flex items-center justify-between px-2 py-1 mb-1">
              <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
                <Layers size={13} />
                Projetos ({projects.length})
              </span>
              <button
                onClick={() => onOpenProjectModal(null)}
                title="Criar novo projeto"
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <FolderPlus size={14} />
              </button>
            </div>

            {projects.length === 0 ? (
              <p className="text-xs text-slate-500 px-2 py-1 italic">
                Nenhum projeto criado ainda
              </p>
            ) : (
              <div className="space-y-1">
                {projects.map((project) => {
                  const isCollapsed = collapsedProjects[project.id];
                  const projectChats = conversations.filter(
                    (c) => c.project_id === project.id
                  );

                  return (
                    <div key={project.id} className="rounded-xl overflow-hidden">
                      {/* Cabeçalho do Projeto */}
                      <div className="group flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-800/60 rounded-xl transition-colors text-xs text-slate-200">
                        <button
                          onClick={() => toggleProject(project.id)}
                          className="flex items-center gap-2 flex-1 text-left truncate cursor-pointer"
                        >
                          {isCollapsed ? (
                            <ChevronRight size={14} className="text-slate-500 shrink-0" />
                          ) : (
                            <ChevronDown size={14} className="text-slate-500 shrink-0" />
                          )}
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: project.color }}
                          />
                          <span className="font-medium truncate">{project.name}</span>
                          <span className="text-[10px] text-slate-500 ml-auto mr-1">
                            {projectChats.length}
                          </span>
                        </button>

                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                          <button
                            onClick={() => {
                              onNewChat(project.id);
                              onCloseMobile();
                            }}
                            title="Novo chat neste projeto"
                            className="p-1 text-slate-400 hover:text-brand-400 hover:bg-slate-800 rounded transition-colors"
                          >
                            <Plus size={13} />
                          </button>
                          <button
                            onClick={() => onOpenProjectModal(project)}
                            title="Editar projeto"
                            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => onDeleteProject(project.id)}
                            title="Excluir projeto"
                            className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Chats deste Projeto */}
                      {!isCollapsed && (
                        <div className="pl-6 pr-1 py-0.5 space-y-0.5 border-l-2 border-slate-800/80 ml-3 mt-0.5 mb-1">
                          {projectChats.length === 0 ? (
                            <p className="text-[11px] text-slate-500 py-1 italic">
                              Vazio
                            </p>
                          ) : (
                            projectChats.map((chat) => (
                              <ChatItem
                                key={chat.id}
                                chat={chat}
                                isActive={chat.id === activeConversationId}
                                onSelect={() => {
                                  onSelectConversation(chat.id);
                                  onCloseMobile();
                                }}
                                onRename={() => onOpenRenameModal(chat)}
                                onDelete={() => onDeleteConversation(chat.id)}
                                activeMenuId={activeMenuId}
                                setActiveMenuId={setActiveMenuId}
                              />
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Seção de Chats Avulsos */}
          <div>
            <div className="px-2 py-1 mb-1">
              <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
                <MessageSquare size={13} />
                Chats Gerais ({unassignedConversations.length})
              </span>
            </div>

            {unassignedConversations.length === 0 ? (
              <p className="text-xs text-slate-500 px-2 py-1 italic">
                Nenhum chat geral
              </p>
            ) : (
              <div className="space-y-0.5">
                {unassignedConversations.map((chat) => (
                  <ChatItem
                    key={chat.id}
                    chat={chat}
                    isActive={chat.id === activeConversationId}
                    onSelect={() => {
                      onSelectConversation(chat.id);
                      onCloseMobile();
                    }}
                    onRename={() => onOpenRenameModal(chat)}
                    onDelete={() => onDeleteConversation(chat.id)}
                    activeMenuId={activeMenuId}
                    setActiveMenuId={setActiveMenuId}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé / Perfil do Usuário */}
        <div className="p-3 border-t border-slate-800/60 bg-slate-900/60 flex items-center justify-between">
          <div
            onClick={onOpenProfileModal}
            title="Ver perfil e alterar senha"
            className="flex items-center gap-2.5 truncate flex-1 mr-2 p-1 -m-1 rounded-xl hover:bg-slate-800/70 transition-colors cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 group-hover:border-brand-500/50 flex items-center justify-center font-bold text-xs text-brand-400 shrink-0 transition-colors">
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="truncate">
              <p className="text-xs font-medium text-white group-hover:text-brand-300 transition-colors truncate">
                {user?.name || "Usuário"}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {user?.email || ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            {onOpenProfileModal && (
              <button
                onClick={onOpenProfileModal}
                title="Área do Usuário / Segurança"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <UserIcon size={15} />
              </button>
            )}

            <button
              onClick={onLogout}
              title="Sair da conta"
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

interface ChatItemProps {
  chat: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
  activeMenuId: string | null;
  setActiveMenuId: (id: string | null) => void;
}

const ChatItem: React.FC<ChatItemProps> = ({
  chat,
  isActive,
  onSelect,
  onRename,
  onDelete,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${isActive
        ? "bg-slate-800 text-white font-medium"
        : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
        }`}
    >
      <div className="flex items-center gap-2 truncate flex-1 mr-1">
        <MessageSquare
          size={14}
          className={isActive ? "text-brand-400 shrink-0" : "text-slate-500 shrink-0"}
        />
        <span className="truncate">{chat.title}</span>
      </div>

      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRename();
          }}
          title="Mover para projeto ou renomear"
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded"
        >
          <FolderInput size={12} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Excluir conversa"
          className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-700/60 rounded"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

