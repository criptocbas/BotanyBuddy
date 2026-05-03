import { NavLink } from "react-router-dom";
import { Home, Settings, Sprout } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Plants", icon: Home, end: true },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 safe-bottom">
      <div className="container max-w-2xl px-3 pb-2">
        <div className="glass rounded-2xl shadow-lg border border-border/60 flex items-center justify-around p-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center px-4 py-2 rounded-xl text-xs font-medium transition-colors min-w-[88px]",
                    isActive
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                <Icon className="h-5 w-5 mb-1" />
                {item.label}
              </NavLink>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-1 mt-1.5 text-[10px] text-muted-foreground/70">
          <Sprout className="h-3 w-3" /> Grok Garden
        </div>
      </div>
    </nav>
  );
}
