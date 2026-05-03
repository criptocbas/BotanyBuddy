import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-gradient-to-b from-background to-leaf-50/40 dark:to-leaf-950/40">
      <main className="container max-w-2xl pt-4 pb-28 safe-top">{children}</main>
      <BottomNav />
    </div>
  );
}
