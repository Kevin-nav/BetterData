"use client";

import type { ReactNode } from "react";
import { AdminShell } from "../components/AdminShell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
