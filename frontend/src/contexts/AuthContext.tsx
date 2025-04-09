// contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect } from "react";
import { userManager } from "@/lib/auth";
import type { User } from "oidc-client-ts";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load user on mount
    userManager.getUser().then((user) => {
      setUser(user);
      setIsLoading(false);
    });

    // Subscribe to user changes
    const onUserLoaded = (user: User) => {
      console.log("User loaded:", user);
      setUser(user);
    };
    const onUserUnloaded = () => setUser(null);

    userManager.events.addUserLoaded(onUserLoaded);
    userManager.events.addUserUnloaded(onUserUnloaded);

    return () => {
      userManager.events.removeUserLoaded(onUserLoaded);
      userManager.events.removeUserUnloaded(onUserUnloaded);
    };
  }, []);

  const getAccessToken = async () => {
    const currentUser = await userManager.getUser();
    return currentUser?.access_token ?? null;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user?.access_token,
        isLoading,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
