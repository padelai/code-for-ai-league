// pages/CallbackPage.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { userManager } from "@/lib/auth";

export default function CallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    userManager
      .signinRedirectCallback()
      .then((user) => {
        console.log("Successfully signed in:", user);
        navigate("/dashboard");
      })
      .catch((error) => {
        console.error("Sign-in error:", error);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        navigate("/auth");
      });
  }, [navigate]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
