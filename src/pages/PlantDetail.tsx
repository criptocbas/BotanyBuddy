import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  Droplet,
  Loader2,
  MoreVertical,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PhotoUploader } from "@/components/plants/PhotoUploader";
import { PhotoHistory } from "@/components/plants/PhotoHistory";
import { CareLogList } from "@/components/plants/CareLogList";
import { LogActionDialog } from "@/components/plants/LogActionDialog";
import { GrokAdvicePanel } from "@/components/plants/GrokAdvicePanel";
import { StatusPill } from "@/components/plants/StatusPill";
import { usePlant, usePlants } from "@/hooks/usePlants";
import { derivePlantStatus } from "@/lib/reminders";
import { toast } from "sonner";
import { fmtDate } from "@/lib/utils";
import {
  ensureNotificationPermission,
  scheduleLocalReminder,
} from "@/lib/reminders";

export default function PlantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { deletePlant } = usePlants();
  const {
    plant,
    photos,
    logs,
    advice,
    loading,
    addLog,
    uploadPhoto,
    analyzeWithGrok,
  } = usePlant(id);

  const [analyzing, setAnalyzing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Build a "PlantWithStatus"-shaped object so we can reuse the deriver.
  const status = useMemo(() => {
    if (!plant) return null;
    const latest = advice[0];
    return derivePlantStatus(
      {
        ...plant,
        latest_advice_id: latest?.id ?? null,
        latest_status: latest?.status ?? null,
        latest_summary: latest?.summary ?? null,
        latest_next_action: latest?.next_action ?? null,
        latest_next_action_at: latest?.next_action_at ?? null,
        latest_advice_at: latest?.created_at ?? null,
      },
      logs,
    );
  }, [plant, advice, logs]);

  // After Grok suggests a next-action time, schedule a local notification.
  useEffect(() => {
    const latest = advice[0];
    if (!plant || !latest?.next_action_at) return;
    ensureNotificationPermission().then((perm) => {
      if (perm !== "granted") return;
      scheduleLocalReminder(
        plant.name,
        latest.next_action ?? "Time to check on your plant",
        new Date(latest.next_action_at!),
      );
    });
  }, [plant, advice]);

  if (loading || !plant) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="aspect-[4/3] w-full rounded-xl" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const onUpload = async (file: File) => {
    const photo = await uploadPhoto(file);
    if (!photo) return;
    setAnalyzing(true);
    try {
      await analyzeWithGrok(photo);
      toast.success("Grok updated this plant's status.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAnalyzing(false);
    }
  };

  const onDelete = async () => {
    try {
      await deletePlant(plant.id);
      toast.success(`${plant.name} removed.`);
      navigate("/", { replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const askForReminders = async () => {
    const perm = await ensureNotificationPermission();
    if (perm === "granted") toast.success("Reminders enabled.");
    else toast.message("Notifications were not granted.");
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Plant menu">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove {plant.name}?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will delete all photos, care logs, and Grok analyses for this plant. This can't be undone.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {/* Hero */}
      <Card className="overflow-hidden">
        <div className="aspect-[4/3] w-full bg-leaf-100 dark:bg-leaf-900/40">
          {plant.cover_photo_url ? (
            <img
              src={plant.cover_photo_url}
              alt={plant.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-leaf-500">
              <Sparkles className="h-10 w-10" />
            </div>
          )}
        </div>
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold">{plant.name}</h1>
              <div className="text-sm text-muted-foreground">
                {plant.species ?? "Species not set"} · {plant.pot_type ?? "pot"}
                {" · "}
                {plant.drainage ? "drains" : "no drainage"}
              </div>
            </div>
            {status && <StatusPill status={status} />}
          </div>
          {status?.detail && (
            <p className="text-sm mt-2 text-muted-foreground">{status.detail}</p>
          )}
          <Separator className="my-4" />
          <PhotoUploader onUpload={onUpload} analyzing={analyzing} />
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2">
        <LogActionDialog
          trigger={
            <Button variant="outline" size="lg">
              <Droplet className="h-4 w-4" /> Log watering
            </Button>
          }
          onSubmit={addLog}
          defaultAction="water"
        />
        <Button variant="outline" size="lg" onClick={askForReminders}>
          <Bell className="h-4 w-4" /> Reminders
        </Button>
      </div>

      <Tabs defaultValue="advice">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="advice">Advice</TabsTrigger>
          <TabsTrigger value="history">Care log</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
        </TabsList>

        <TabsContent value="advice" className="space-y-3">
          <GrokAdvicePanel advice={advice[0] ?? null} />
          {advice.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Earlier reads</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {advice.slice(1, 6).map((a) => (
                  <div key={a.id} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant={
                          a.status === "Healthy"
                            ? "good"
                            : a.status?.startsWith("Needs water")
                            ? "warn"
                            : a.status === "Unclear"
                            ? "neutral"
                            : "bad"
                        }
                      >
                        {a.status ?? "—"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(a.created_at)}
                      </span>
                    </div>
                    {a.summary && <p className="mt-1">{a.summary}</p>}
                    {a.next_action && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Next: {a.next_action}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Care log</CardTitle>
              <LogActionDialog
                trigger={
                  <Button size="sm" variant="ghost">
                    Add entry
                  </Button>
                }
                onSubmit={addLog}
              />
            </CardHeader>
            <CardContent>
              <CareLogList logs={logs} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <PhotoHistory photos={photos} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {analyzing && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 glass rounded-full px-4 py-2 text-sm shadow-lg flex items-center gap-2 z-30">
          <Loader2 className="h-4 w-4 animate-spin" /> Asking Grok…
        </div>
      )}
    </div>
  );
}
