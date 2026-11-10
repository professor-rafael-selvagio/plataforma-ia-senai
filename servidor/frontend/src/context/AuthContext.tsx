import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "../types";
import { api } from "../services/api";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    name?: string;
    user_type?: "aluno" | "funcionario";
    ra?: string;
    cpf?: string;
    nif?: string;
  }) => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(api.getSavedUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (api.isAuthenticated()) {
        try {
          const currentUser = await api.auth.me();
          setUser(currentUser);
        } catch {
          api.clearSession();
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    checkAuth();

    const handleExpired = () => {
      setUser(null);
    };

    window.addEventListener("auth-expired", handleExpired);
    return () => window.removeEventListener("auth-expired", handleExpired);
  }, []);

  // Heartbeat periódico a cada 60s enquanto estiver autenticado
  useEffect(() => {
    if (!user) return;

    api.auth.heartbeat();
    const interval = setInterval(() => {
      api.auth.heartbeat();
    }, 60000);

    return () => clearInterval(interval);
  }, [user]);

  const login = async (email: string, password: string) => {
    const data = await api.auth.login(email, password);
    setUser(data.user);
  };

  const register = async (data: {
    email: string;
    password: string;
    name?: string;
    user_type?: "aluno" | "funcionario";
    ra?: string;
    cpf?: string;
    nif?: string;
  }) => {
    const res = await api.auth.register(data);
    setUser(res.user);
  };

  const updateProfile = async (name: string) => {
    const updatedUser = await api.auth.updateProfile(name);
    setUser(updatedUser);
  };

  const logout = () => {
    api.clearSession();
    setUser(null);
  };

  const isAdmin = Boolean(
    user?.is_admin || user?.is_superadmin
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin,
        isLoading,
        login,
        register,
        updateProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser utilizado dentro de um AuthProvider");
  }
  return context;
};

