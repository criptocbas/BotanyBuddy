import { NavLink } from "react-router-dom";
import { Home, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Plants", icon: Home, end: true },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 safe-bottom pointer-events-none">
      <div className="container max-w-2xl px-3 pb-2 pointer-events-auto">
        <div className="glass rounded-2xl shadow-lg border border-border/60 flex items-center justify-around p-1.5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center px-4 py-2 rounded-xl text-[11px] font-medium transition-colors min-w-[88px] active:scale-[0.97]",
                    isActive
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground",
                  )
                }
              >
                <Icon className="h-5 w-5 mb-0.5" />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
