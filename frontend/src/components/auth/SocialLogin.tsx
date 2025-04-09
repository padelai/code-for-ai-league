import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const SocialLogin = () => {
  const cognitoDomain =
    "ballskicker-user-pool.auth.eu-west-2.amazoncognito.com";
  const clientId = "3qmlaqabrf6out8gehg8r1o1n3";
  const redirectUri = "https://padel.piar.ai/auth/login-callback";

  const handleGoogleSignIn = async () => {
    // Construct the authorization URL
    const authUrl =
      `https://${cognitoDomain}/oauth2/authorize?` +
      `client_id=${clientId}&` +
      `response_type=code&` +
      `scope=email+openid+profile&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `identity_provider=Google`;

    // Redirect to the authorization URL
    window.location.href = authUrl;
  };

  const handleAppleSignIn = async () => {
    const authUrl =
      `https://${cognitoDomain}/oauth2/authorize?` +
      `client_id=${clientId}&` +
      `response_type=code&` +
      `scope=email+openid+profile&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `identity_provider=SignInWithApple`;

    window.location.href = authUrl;
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>Choose your preferred sign in method</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignIn}
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Button>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleAppleSignIn}
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M17.569 12.6254C17.597 15.652 20.2179 16.6592 20.247 16.672C20.2239 16.7464 19.8599 17.9563 19.0047 19.2062C18.2787 20.2859 17.5274 21.3563 16.3245 21.3805C15.1474 21.4047 14.7586 20.6725 13.4204 20.6725C12.0821 20.6725 11.6579 21.3563 10.5403 21.4047C9.36217 21.4531 8.4876 20.2617 7.75248 19.1871C6.24367 16.9857 5.0938 13.4507 6.64736 11.0821C7.41772 9.90868 8.71569 9.17451 10.1245 9.15031C11.2511 9.12611 12.3144 9.93294 13.0121 9.93294C13.7099 9.93294 15.0169 8.94674 16.3731 9.12611C16.9575 9.1503 18.5375 9.36611 19.5563 10.9011C19.4617 10.9616 17.5458 12.0562 17.569 12.6254ZM15.2239 8.01772C15.8447 7.25934 16.2599 6.21514 16.1653 5.17094C15.2421 5.21934 14.1243 5.78063 13.4839 6.53901C12.9085 7.20964 12.4041 8.27804 12.5079 9.29804C13.5267 9.37064 14.603 8.77611 15.2239 8.01772Z"
              fill="black"
            />
          </svg>
          Continue with Apple
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with email
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SocialLogin;
