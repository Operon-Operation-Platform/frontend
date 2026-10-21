"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getOperonToken } from "../api/operon";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getOperonToken() ? "/operon" : "/login");
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-sm text-slate-600">Redirecting…</p>
    </div>
  );
}
