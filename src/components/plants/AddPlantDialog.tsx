import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { usePlants } from "@/hooks/usePlants";
import { defaultWaterInterval } from "@/lib/reminders";
import { toast } from "sonner";

interface Props {
  trigger: ReactNode;
  onCreated?: (plantId: string) => void;
}

const SPECIES_PRESETS = [
  "Pothos",
  "Snake Plant",
  "Prayer Plant (Maranta)",
  "Calathea",
  "Parlor Palm",
  "Monstera",
  "Fiddle Leaf Fig",
  "ZZ Plant",
  "Philodendron",
  "Spider Plant",
  "Succulent",
  "Cactus",
  "Other",
];

export function AddPlantDialog({ trigger, onCreated }: Props) {
  const { createPlant } = usePlants();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [species, setSpecies] = useState<string>("");
  const [customSpecies, setCustomSpecies] = useState("");
  const [potType, setPotType] = useState<string>("plastic");
  const [drainage, setDrainage] = useState<"yes" | "no">("yes");
  const [light, setLight] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setName(""); setSpecies(""); setCustomSpecies(""); setPotType("plastic");
    setDrainage("yes"); setLight(""); setLocation(""); setNotes("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give your plant a name.");
      return;
    }
    setSubmitting(true);
    try {
      const finalSpecies =
        species === "Other" ? customSpecies.trim() || null : species || null;
      const drains = drainage === "yes";
      const plant = await createPlant({
        name: name.trim(),
        species: finalSpecies,
        pot_type: potType || null,
        drainage: drains,
        light: light || null,
        location: location || null,
        notes: notes || null,
        watering_interval_days: defaultWaterInterval(finalSpecies, drains),
        fertilizing_interval_days: 30,
      });
      toast.success(`${plant.name} added.`);
      reset();
      setOpen(false);
      onCreated?.(plant.id);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a plant</DialogTitle>
          <DialogDescription>
            Quick details now — you can refine and upload photos on the plant's
            page.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kitchen Pothos"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Species</Label>
            <Select value={species} onValueChange={setSpecies}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a species" />
              </SelectTrigger>
              <SelectContent>
                {SPECIES_PRESETS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {species === "Other" && (
              <Input
                value={customSpecies}
                onChange={(e) => setCustomSpecies(e.target.value)}
                placeholder="Type the species"
              />
            )}
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
              <Label htmlFor="light">Light</Label>
              <Input
                id="light"
                value={light}
                onChange={(e) => setLight(e.target.value)}
                placeholder="bright indirect"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="kitchen window"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything Grok should know? e.g. came home from the shop yellowing on bottom leaves."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add plant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
