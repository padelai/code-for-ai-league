// lib/auth.ts
import { UserManager, WebStorageStateStore } from "oidc-client-ts";

export const userManager = new UserManager({
  authority: "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_BIsIlkwmE",
  client_id: "3qmlaqabrf6out8gehg8r1o1n3",
  redirect_uri: `${window.location.origin}/auth/login-callback`,
  response_type: "code",
  scope: "openid profile email",
  loadUserInfo: true,
  // Using sessionStorage to store tokens
  stateStore: new WebStorageStateStore({ store: window.sessionStorage }),

  // Optionally configure automatic silent renewal
  automaticSilentRenew: true,
});

// Optional: Set up event listeners for debugging/logging
userManager.events.addUserLoaded((user) => {
  console.log("User loaded:", user);
});

userManager.events.addSilentRenewError((error) => {
  console.error("Silent renew error:", error);
});
