import { ArrowDownUp, MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GroupMode, SortMode } from "@/hooks/useUiPrefs";

interface Props {
  sort: SortMode;
  group: GroupMode;
  onSort: (s: SortMode) => void;
  onGroup: (g: GroupMode) => void;
}

export function SortControl({ sort, group, onSort, onGroup }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Select value={sort} onValueChange={(v) => onSort(v as SortMode)}>
        <SelectTrigger className="h-9 w-auto gap-2 px-3">
          <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="smart">Action needed first</SelectItem>
          <SelectItem value="name">Name (A–Z)</SelectItem>
          <SelectItem value="recent">Recently added</SelectItem>
        </SelectContent>
      </Select>
      <Select value={group} onValueChange={(v) => onGroup(v as GroupMode)}>
        <SelectTrigger className="h-9 w-auto gap-2 px-3">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No grouping</SelectItem>
          <SelectItem value="location">By location</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
