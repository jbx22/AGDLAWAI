"use client";
import { SessionProvider } from "next-auth/react";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProfileProvider } from "@/contexts/UserProfileContext";
import { DirectionBridge } from "@/components/direction-bridge";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DirectionBridge />
      <AuthProvider>
        <UserProfileProvider>{children}</UserProfileProvider>
      </AuthProvider>
    </SessionProvider>
  );
}
