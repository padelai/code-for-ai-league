// pages/AuthPage.tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { userManager } from "@/lib/auth";

export default function AuthPage() {
  const handleGoogleSignIn = () => {
    userManager.signinRedirect({
      extraQueryParams: {
        identity_provider: "Google",
      },
    });
  };

  const handleAppleSignIn = () => {
    userManager.signinRedirect({
      extraQueryParams: {
        identity_provider: "SignInWithApple",
      },
    });
  };

  return (
    <div className="flex h-screen items-center justify-center">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
          >
            Continue with Google
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleAppleSignIn}
          >
            Continue with Apple
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
