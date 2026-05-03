import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";
import { ensureNotificationPermission } from "@/lib/reminders";
import { Bell, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Settings() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => setDisplayName(data?.display_name ?? ""));
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated.");
  };

  const enableReminders = async () => {
    const result = await ensureNotificationPermission();
    setPerm(result);
    if (result === "granted") toast.success("Reminders enabled.");
    else toast.message("Notification permission was not granted.");
  };

  return (
    <div className="space-y-4 animate-in fade-in-0 duration-300">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Settings
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="What should we call you?"
            />
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { key: "light", label: "Light", icon: Sun },
                { key: "dark", label: "Dark", icon: Moon },
                { key: "system", label: "System", icon: Monitor },
              ] as Array<{ key: Theme; label: string; icon: typeof Sun }>
            ).map((opt) => {
              const Icon = opt.icon;
              const active = theme === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setTheme(opt.key)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-sm transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background hover:bg-accent",
                  )}
                  aria-pressed={active}
                >
                  <Icon className="h-5 w-5" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reminders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Grok Garden uses your browser's notification system. When you
            install the app and grant permission, you'll get a heads-up at the
            time Grok recommends for the next action.
          </p>
          <Button
            onClick={enableReminders}
            variant={perm === "granted" ? "secondary" : "default"}
          >
            <Bell className="h-4 w-4" />
            {perm === "granted" ? "Reminders on" : "Enable reminders"}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <Button variant="outline" onClick={signOut}>
        <LogOut className="h-4 w-4" /> Sign out
      </Button>

      <p className="text-center text-[11px] text-muted-foreground py-2">
        Grok Garden · v0.1
      </p>
    </div>
  );
}
