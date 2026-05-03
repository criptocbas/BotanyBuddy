import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "grokgarden:install-dismissed";

export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState<boolean>(() =>
    typeof window !== "undefined" && !!localStorage.getItem(DISMISS_KEY),
  );

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!event || hidden) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  const install = async () => {
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") setHidden(true);
  };

  return (
    <div className="rounded-xl border border-leaf-200 bg-leaf-50 dark:bg-leaf-900/30 dark:border-leaf-800 p-3 flex items-center gap-3 mb-3">
      <div className="flex-1 text-sm">
        <div className="font-medium">Install Grok Garden</div>
        <div className="text-muted-foreground text-xs">
          Add it to your home screen for quick access and reminders.
        </div>
      </div>
      <Button size="sm" onClick={install}>
        <Download className="h-4 w-4" /> Install
      </Button>
      <Button size="icon" variant="ghost" onClick={dismiss} aria-label="Dismiss">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
