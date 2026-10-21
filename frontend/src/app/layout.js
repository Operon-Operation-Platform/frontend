import "../index.css";
import { ThemeProvider } from "../context/ThemeContext";

const faviconPath = process.env.GITHUB_PAGES === "true"
  ? "/novora-frontend/logo.png"
  : "/logo.png";

export const metadata = {
  title: "Operon — AI Agent Operations Platform",
  description: "Create, configure, run, and monitor AI agents that perform authorized business workflows.",
  icons: {
    icon: faviconPath,
    shortcut: faviconPath,
    apple: faviconPath,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href={faviconPath} type="image/png" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-gray-200 antialiased min-h-screen text-[15px]">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
