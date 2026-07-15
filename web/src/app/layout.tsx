import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "我tm票呢?!",
  description: "只是一个看票的 · Live Telemetry",
};

const themeInitScript = `
(function(){
  try {
    var k='ticket-monitor-theme';
    var t=localStorage.getItem(k);
    if(t!=='light'&&t!=='dark'){
      t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';
    }
    var r=document.documentElement;
    r.classList.remove('light','dark');
    r.classList.add(t);
    r.setAttribute('data-theme',t);
    r.style.colorScheme=t;
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-background text-foreground min-h-full font-sans">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
