function resolvedApiUrl(): string {
  let url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  // Force HTTPS on any non-localhost origin so browser mixed-content rules
  // are never triggered regardless of how the env var was set in Vercel.
  if (url.startsWith("http://") && !url.includes("localhost") && !url.includes("127.0.0.1")) {
    url = "https://" + url.slice("http://".length);
  }
  return url;
}

export const config = {
  apiUrl: resolvedApiUrl(),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  appName: "LearnPath AI",
  environment: process.env.NODE_ENV || "development",
  features: {
    premiumEnabled: true,
    offlineMode: true,
    googleStudio: true,
  },
};

export function validateConfig() {
  if (!config.supabaseUrl) {
    console.warn("NEXT_PUBLIC_SUPABASE_URL not configured");
  }
  if (!config.supabaseAnonKey) {
    console.warn("NEXT_PUBLIC_SUPABASE_ANON_KEY not configured");
  }
}
