"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

function localeFromPathname(pathname: string | null) {
  if (pathname === "/en" || pathname?.startsWith("/en/")) return "en";
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("lang") === "en") return "en";
  }
  return "ar";
}

export function DirectionBridge() {
  const pathname = usePathname();

  useEffect(() => {
    const locale = localeFromPathname(pathname);
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [pathname]);

  return null;
}
