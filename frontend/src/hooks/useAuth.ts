import { useState, useEffect, useCallback } from "react";
import { User } from "oidc-client-ts";
import { userManager } from "@/lib/auth";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userManager.getUser().then((user) => {
      setUser(user);
      setLoading(false);
    });

    // Subscribe to user changes
    const onUserLoaded = (user: User) => setUser(user);
    const onUserUnloaded = () => setUser(null);

    userManager.events.addUserLoaded(onUserLoaded);
    userManager.events.addUserUnloaded(onUserUnloaded);

    return () => {
      userManager.events.removeUserLoaded(onUserLoaded);
      userManager.events.removeUserUnloaded(onUserUnloaded);
    };
  }, []);

  const login = useCallback(async (provider: "Google" | "SignInWithApple") => {
    await userManager.signinRedirect({
      extraQueryParams: { identity_provider: provider },
    });
  }, []);

  const logout = useCallback(async () => {
    await userManager.signoutRedirect();
  }, []);

  return {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user?.access_token,
  };
}
