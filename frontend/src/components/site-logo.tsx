import Link from "next/link";

interface SiteLogoProps {
    size?: "sm" | "md" | "lg" | "xl";
    className?: string;
    animate?: boolean;
    asLink?: boolean;
}

export function SiteLogo({
    size = "md",
    className = "",
    animate = false,
    asLink = false,
}: SiteLogoProps) {
    const markSize =
        size === "sm" ? 28 : size === "md" ? 34 : size === "lg" ? 48 : 64;
    const titleSize =
        size === "sm" ? "text-sm" : size === "md" ? "text-lg" : size === "lg" ? "text-2xl" : "text-4xl";
    const arabicSize =
        size === "sm" ? "text-[8px]" : size === "md" ? "text-[10px]" : size === "lg" ? "text-xs" : "text-sm";

    const logo = (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className="relative flex-shrink-0">
                <svg
                    width={markSize}
                    height={markSize}
                    viewBox="0 0 64 64"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                >
                    <path
                        d="M4 56L32 8L60 56H4Z"
                        fill="#1a1a2e"
                        stroke="#c9a84c"
                        strokeWidth="2"
                    />
                    <path
                        d="M14 56L32 22L50 56H14Z"
                        fill="#16213e"
                        stroke="#c9a84c"
                        strokeWidth="1.5"
                    />
                    <path d="M26 28L32 20L38 28H26Z" fill="#c9a84c" />
                    <line x1="2" y1="56" x2="62" y2="56" stroke="#1a1a2e" strokeWidth="2.5" />
                </svg>
            </div>
            <div className={`flex flex-col ${animate ? "sidebar-fade-in" : ""}`}>
                <h1 className={`font-bold tracking-tight leading-none ${titleSize}`}>
                    <span className="text-[#1a1a2e]">JBL</span>
                    <span className="text-[#c9a84c]"> BIZ LAW</span>
                </h1>
                <span className={`text-[#c9a84c] font-medium tracking-wider ${arabicSize}`}>
                    جبل بيز لو
                </span>
            </div>
        </div>
    );

    if (asLink) {
        return (
            <Link href="/" className="cursor-pointer transition-opacity hover:opacity-80">
                {logo}
            </Link>
        );
    }

    return logo;
}
