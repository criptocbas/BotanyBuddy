import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";
import {
  getPushReadiness,
  subscribeToPush,
  unsubscribeFromPush,
  VAPID_PUBLIC_KEY,
} from "@/lib/push";
import { BellOff, BellRing, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Settings() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [pushReady, setPushReady] = useState({
    supported: false,
    permission: "default" as NotificationPermission,
    subscribed: false,
  });
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => setDisplayName(data?.display_name ?? ""));
  }, [user]);

  useEffect(() => {
    getPushReadiness().then(setPushReady);
  }, []);

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

  const onTogglePush = async () => {
    setPushBusy(true);
    try {
      if (pushReady.subscribed) {
        await unsubscribeFromPush();
        toast.success("Push notifications turned off on this device.");
      } else {
        await subscribeToPush();
        toast.success("Push notifications turned on.");
      }
      setPushReady(await getPushReadiness());
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPushBusy(false);
    }
  };

  const pushDisabledReason =
    !pushReady.supported
      ? "This browser doesn't support push notifications."
      : !VAPID_PUBLIC_KEY
      ? "VITE_VAPID_PUBLIC_KEY is not configured."
      : null;

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
          <CardTitle className="text-base">Push notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Get a notification on this device when a plant needs attention —
            even when the app is closed. On iOS, install Grok Garden to your
            home screen first.
          </p>
          {pushDisabledReason ? (
            <div className="text-xs rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-2 text-amber-800 dark:text-amber-200">
              {pushDisabledReason}
            </div>
          ) : null}
          <Button
            onClick={onTogglePush}
            disabled={pushBusy || !pushReady.supported || !VAPID_PUBLIC_KEY}
            variant={pushReady.subscribed ? "outline" : "default"}
          >
            {pushReady.subscribed ? (
              <>
                <BellOff className="h-4 w-4" /> Turn off on this device
              </>
            ) : (
              <>
                <BellRing className="h-4 w-4" /> Enable push notifications
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <Button variant="outline" onClick={signOut}>
        <LogOut className="h-4 w-4" /> Sign out
      </Button>

      <p className="text-center text-[11px] text-muted-foreground py-2">
        Grok Garden · v0.2
      </p>
    </div>
  );
}
