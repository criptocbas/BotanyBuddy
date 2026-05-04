import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  Droplet,
  MoreVertical,
  Pencil,
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PhotoHistory } from "@/components/plants/PhotoHistory";
import { CareLogList } from "@/components/plants/CareLogList";
import { LogActionDialog } from "@/components/plants/LogActionDialog";
import { GrokAdvicePanel } from "@/components/plants/GrokAdvicePanel";
import { PlantHero } from "@/components/plants/PlantHero";
import { EditPlantDialog } from "@/components/plants/EditPlantDialog";
import { PhotoLightbox } from "@/components/plants/PhotoLightbox";
import { CareStats } from "@/components/plants/CareStats";
import { ChatPanel } from "@/components/plants/ChatPanel";
import { HealthTrend } from "@/components/plants/HealthTrend";
import { JournalTab } from "@/components/plants/JournalTab";
import { usePlant, usePlants } from "@/hooks/usePlants";
import { computeCareStats } from "@/lib/stats";
import { derivePlantStatus } from "@/lib/reminders";
import { haptic } from "@/lib/haptics";
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
    updatePlant,
    analyzeWithGrok,
  } = usePlant(id);

  const [analyzing, setAnalyzing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightboxId, setLightboxId] = useState<string | null>(null);

  const status = useMemo(() => {
    if (!plant) return null;
    const latest = advice[0];
    const lastWaterAt =
      logs.find((l) => l.action_type === "water")?.acted_at ?? null;
    const lastFertilizeAt =
      logs.find((l) => l.action_type === "fertilize")?.acted_at ?? null;
    return derivePlantStatus(
      {
        ...plant,
        latest_advice_id: latest?.id ?? null,
        latest_status: latest?.status ?? null,
        latest_summary: latest?.summary ?? null,
        latest_next_action: latest?.next_action ?? null,
        latest_next_action_at: latest?.next_action_at ?? null,
        latest_advice_at: latest?.created_at ?? null,
        last_watered_at: lastWaterAt,
        last_fertilized_at: lastFertilizeAt,
      },
      lastWaterAt,
    );
  }, [plant, advice, logs]);

  const stats = useMemo(() => computeCareStats(logs, advice), [logs, advice]);

  // Schedule a local notification when Grok suggests a next-action time.
  // (Web push is the durable path; this is a best-effort backup.)
  useEffect(() => {
    const latest = advice[0];
    if (!plant || !latest?.next_action_at) return;
    let cancel: (() => void) | null = null;
    let cancelled = false;
    ensureNotificationPermission().then((perm) => {
      if (cancelled || perm !== "granted") return;
      cancel = scheduleLocalReminder(
        plant.name,
        latest.next_action ?? "Time to check on your plant",
        new Date(latest.next_action_at!),
      );
    });
    return () => {
      cancelled = true;
      cancel?.();
    };
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
      haptic("success");
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
    if (perm === "granted")
      toast.success("Notifications enabled. Turn on push in Settings for reminders even when the app is closed.");
    else toast.message("Notifications were not granted.");
  };

  const onLogQuickWater = async () => {
    haptic("success");
    try {
      await addLog("water");
      toast.success("Watering logged.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const onAddNote = async (notes: string) => {
    await addLog("observation", notes);
  };

  const latestPhoto = photos[0] ?? null;

  return (
    <div className="space-y-4 animate-in fade-in-0 duration-300">
      <header className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <div className="flex items-center gap-1">
          <EditPlantDialog
            plant={plant}
            onSave={updatePlant}
            trigger={
              <Button variant="ghost" size="icon" aria-label="Edit plant">
                <Pencil className="h-5 w-5" />
              </Button>
            }
          />
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
                This will delete all photos, care logs, chat history, and Grok
                analyses for this plant. This can't be undone.
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
        </div>
      </header>

      <PlantHero
        plant={plant}
        latestPhoto={latestPhoto}
        status={status}
        onPhotoClick={() => latestPhoto && setLightboxId(latestPhoto.id)}
        onUpload={onUpload}
        analyzing={analyzing}
      />

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="lg" onClick={onLogQuickWater}>
          <Droplet className="h-4 w-4" /> Water
        </Button>
        <Button variant="outline" size="lg" onClick={askForReminders}>
          <Bell className="h-4 w-4" /> Remind
        </Button>
      </div>

      <CareStats stats={stats} />

      <HealthTrend advice={advice} />

      <Tabs defaultValue="advice">
        <TabsList className="w-full grid grid-cols-5 h-auto px-0.5">
          <TabsTrigger value="advice" className="text-[11px] sm:text-xs px-1">Advice</TabsTrigger>
          <TabsTrigger value="chat" className="text-[11px] sm:text-xs px-1">Chat</TabsTrigger>
          <TabsTrigger value="journal" className="text-[11px] sm:text-xs px-1">Journal</TabsTrigger>
          <TabsTrigger value="history" className="text-[11px] sm:text-xs px-1">Log</TabsTrigger>
          <TabsTrigger value="photos" className="text-[11px] sm:text-xs px-1">Photos</TabsTrigger>
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
                          a.status === "Healthy" || a.status === "Recovering"
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

        <TabsContent value="chat">
          <ChatPanel plantId={plant.id} latestPhoto={latestPhoto} />
        </TabsContent>

        <TabsContent value="journal">
          <JournalTab logs={logs} onAddNote={onAddNote} />
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
              <PhotoHistory
                photos={photos}
                onSelect={(p) => setLightboxId(p.id)}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {lightboxId && (
        <PhotoLightbox
          photos={photos}
          startId={lightboxId}
          advice={advice}
          onClose={() => setLightboxId(null)}
        />
      )}
    </div>
  );
}
