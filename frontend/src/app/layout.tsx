import type { Metadata } from "next";
import { EB_Garamond, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const arabicSans = Noto_Sans_Arabic({
    variable: "--font-arabic-sans",
    subsets: ["arabic"],
    weight: ["400", "500", "600", "700", "800"],
});

const ebGaramond = EB_Garamond({
    variable: "--font-eb-garamond",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
    metadataBase: new URL("https://jbl-dun.vercel.app"),
    title: "AGD LAW AI | Arabic AI for International Business Law",
    description:
        "AI legal infrastructure built for the Arabic world, helping Arabic speakers navigate GCC, US, and European business contracts with confidence.",
    icons: {
        icon: [
            { url: "/icon.svg", type: "image/svg+xml" },
            { url: "/favicon.ico" },
        ],
        apple: "/apple-touch-icon.png",
    },
    openGraph: {
        type: "website",
        url: "https://jbl-dun.vercel.app",
        siteName: "AGD LAW AI",
        title: "AGD LAW AI | Arabic AI for International Business Law",
        description:
            "Cross-border Arabic business contract intelligence for GCC, US, and European agreements.",
        images: [
            {
                url: "/link-image.jpg",
                width: 1200,
                height: 651,
                alt: "AGD LAW AI",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "AGD LAW AI | Arabic AI for International Business Law",
        description:
            "Cross-border Arabic business contract intelligence for GCC, US, and European agreements.",
        images: ["/link-image.jpg"],
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" dir="ltr" suppressHydrationWarning>
            <head>
                <meta name="theme-color" content="#1a1a2e" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1, viewport-fit=cover"
                />
                <link rel="manifest" href="/manifest.json" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <meta name="apple-mobile-web-app-title" content="AGD LAW AI" />
                <meta name="mobile-web-app-capable" content="yes" />
                <meta name="application-name" content="AGD LAW AI" />
            </head>
            <body
                className={`${arabicSans.variable} ${ebGaramond.variable} font-sans antialiased`}
            >
                <Providers>{children}</Providers>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
// Force-unregister old service workers to prevent stale-HTML caching issues
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(regs) {
        regs.forEach(function(reg) { reg.unregister(); });
    });
}
`,
                    }}
                />
            </body>
        </html>
    );
}

