const getWindowOrigin = () => {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.origin;
};

const sanitizeBaseUrl = (url?: string) => {
  if (!url) {
    return "";
  }
  return url.replace(/\/+$/, "");
};

export const API_BASE_URL =
  sanitizeBaseUrl(import.meta.env.VITE_API_BASE_URL as string | undefined) || getWindowOrigin();

export const resolveApiUrl = (path: string) => {
  if (!API_BASE_URL && !path.startsWith("http")) {
    throw new Error("API base URL is not configured. Set VITE_API_BASE_URL in your environment.");
  }

  if (path.startsWith("http")) {
    return path;
  }

  return `${API_BASE_URL}${path}`;
};

