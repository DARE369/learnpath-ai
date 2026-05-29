import type { AppProps } from "next/app";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "../styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  if (!googleClientId) {
    return <Component {...pageProps} />;
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <Component {...pageProps} />
    </GoogleOAuthProvider>
  );
}
