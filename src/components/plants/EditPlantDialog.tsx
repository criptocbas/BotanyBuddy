import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Plant } from "@/lib/types";
import { toast } from "sonner";

interface Props {
  trigger: ReactNode;
  plant: Plant;
  onSave: (patch: Partial<Plant>) => Promise<void>;
}

export function EditPlantDialog({ trigger, plant, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState(plant.name);
  const [species, setSpecies] = useState(plant.species ?? "");
  const [potType, setPotType] = useState(plant.pot_type ?? "plastic");
  const [drainage, setDrainage] = useState<"yes" | "no">(plant.drainage ? "yes" : "no");
  const [light, setLight] = useState(plant.light ?? "");
  const [location, setLocation] = useState(plant.location ?? "");
  const [notes, setNotes] = useState(plant.notes ?? "");
  const [waterDays, setWaterDays] = useState<string>(
    plant.watering_interval_days != null ? String(plant.watering_interval_days) : "",
  );
  const [fertDays, setFertDays] = useState<string>(
    plant.fertilizing_interval_days != null
      ? String(plant.fertilizing_interval_days)
      : "",
  );

  // Keep local form in sync if the upstream plant changes (e.g. realtime edit).
  useEffect(() => {
    if (!open) {
      setName(plant.name);
      setSpecies(plant.species ?? "");
      setPotType(plant.pot_type ?? "plastic");
      setDrainage(plant.drainage ? "yes" : "no");
      setLight(plant.light ?? "");
      setLocation(plant.location ?? "");
      setNotes(plant.notes ?? "");
      setWaterDays(
        plant.watering_interval_days != null ? String(plant.watering_interval_days) : "",
      );
      setFertDays(
        plant.fertilizing_interval_days != null
          ? String(plant.fertilizing_interval_days)
          : "",
      );
    }
  }, [plant, open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name can't be empty.");
      return;
    }
    setBusy(true);
    try {
      await onSave({
        name: name.trim(),
        species: species.trim() || null,
        pot_type: potType || null,
        drainage: drainage === "yes",
        light: light.trim() || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
        watering_interval_days: waterDays ? Number(waterDays) : null,
        fertilizing_interval_days: fertDays ? Number(fertDays) : null,
      });
      toast.success("Plant updated.");
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit plant</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ed-name">Name</Label>
            <Input
              id="ed-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ed-species">Species</Label>
            <Input
              id="ed-species"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              placeholder="e.g. Pothos / Maranta"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Pot</Label>
              <Select value={potType} onValueChange={setPotType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="plastic">Plastic</SelectItem>
                  <SelectItem value="terracotta">Terracotta</SelectItem>
                  <SelectItem value="ceramic">Ceramic</SelectItem>
                  <SelectItem value="self-watering">Self-watering</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Drainage hole?</Label>
              <Select value={drainage} onValueChange={(v) => setDrainage(v as "yes" | "no")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ed-light">Light</Label>
              <Input
                id="ed-light"
                value={light}
                onChange={(e) => setLight(e.target.value)}
                placeholder="bright indirect"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ed-location">Location</Label>
              <Input
                id="ed-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="kitchen window"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ed-water">Water every (days)</Label>
              <Input
                id="ed-water"
                type="number"
                min={1}
                max={120}
                value={waterDays}
                onChange={(e) => setWaterDays(e.target.value)}
                placeholder="auto"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ed-fert">Fertilize every (days)</Label>
              <Input
                id="ed-fert"
                type="number"
                min={7}
                max={365}
                value={fertDays}
                onChange={(e) => setFertDays(e.target.value)}
                placeholder="30"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ed-notes">Notes</Label>
            <Textarea
              id="ed-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
