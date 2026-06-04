import { Html, Head, Main, NextScript } from "next/document";

// Runs before first paint so the correct theme class is on <html> immediately —
// no flash of the wrong theme. Defaults to dark; flips to light when the stored
// preference (or the OS, when preference is "system") asks for it.
const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var dark=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',dark);e.style.colorScheme=dark?'dark':'light';}catch(_){document.documentElement.classList.add('dark');}})();`;

export default function Document() {
  return (
    <Html lang="en" className="dark">
      <Head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
