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
    title: "جبل بيز لو | منصة ذكاء قانوني وتجاري",
    description:
        "منصة عربية للذكاء القانوني والتجاري تساعد الفرق المهنية على تحليل العقود، تنظيم المستندات، وتسريع المراجعة مع حوكمة واضحة.",
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
        siteName: "جبل بيز لو",
        title: "جبل بيز لو | منصة ذكاء قانوني وتجاري",
        description:
            "منصة عربية للذكاء القانوني والتجاري لتحليل العقود وتنظيم المستندات وتسريع المراجعة.",
        images: [
            {
                url: "/link-image.jpg",
                width: 1200,
                height: 651,
                alt: "JBL BIZ LAW",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "جبل بيز لو | منصة ذكاء قانوني وتجاري",
        description:
            "منصة عربية للذكاء القانوني والتجاري لتحليل العقود وتنظيم المستندات وتسريع المراجعة.",
        images: ["/link-image.jpg"],
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ar" dir="rtl" suppressHydrationWarning>
            <head>
                <meta name="theme-color" content="#1a1a2e" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1, viewport-fit=cover"
                />
                <link rel="manifest" href="/manifest.json" />
            </head>
            <body
                className={`${arabicSans.variable} ${ebGaramond.variable} font-sans antialiased`}
            >
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
