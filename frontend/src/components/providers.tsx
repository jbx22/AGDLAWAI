"use client";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProfileProvider } from "@/contexts/UserProfileContext";
import { DirectionBridge } from "@/components/direction-bridge";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DirectionBridge />
      <AuthProvider>
          <UserProfileProvider>{children}</UserProfileProvider>
      </AuthProvider>
    </>
  );
}
