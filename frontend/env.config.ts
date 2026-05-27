export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
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
