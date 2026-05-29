"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/contexts/UserProfileContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const router = useRouter();
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login?callbackUrl=/admin");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!authLoading && !profileLoading && profile && profile.role !== "admin" && profile.role !== "super_admin") {
      router.replace("/assistant");
    }
  }, [authLoading, profileLoading, profile, router]);

  if (authLoading || profileLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) return null;

  return <>{children}</>;
}
