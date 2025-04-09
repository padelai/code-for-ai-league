import { userManager } from "@/lib/auth";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const apiClient = {
  fetch: async (url: string, options: RequestInit = {}): Promise<Response> => {
    const user = await userManager.getUser();
    if (!user?.access_token) {
      throw new ApiError(401, "No access token available");
    }

    url = "http://localhost:8080" + url;
    // url = "https://api.padel.piar.ai" + url;
    console.log("Requesting: ", url);

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${user.access_token}`,
      },
    });

    if (response.status === 401) {
      // Token might be expired, try to refresh
      try {
        await userManager.signinSilent();
        // Retry the request
        return apiClient.fetch(url, options);
      } catch (error) {
        // If refresh fails, redirect to login
        userManager.signinRedirect();
        throw new ApiError(401, "Session expired");
      }
    }

    if (!response.ok) {
      throw new ApiError(response.status, `API error: ${response.statusText}`);
    }

    return response;
  },
};
