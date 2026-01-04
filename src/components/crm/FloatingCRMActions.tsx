import { createPortal } from "react-dom";
import { Plus, Upload, CheckSquare, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onImportCSV: () => void;
  onAddLead: () => void;
  onAddDeal: () => void;
  onAddTask: () => void;
};

export function FloatingCRMActions({
  onImportCSV,
  onAddLead,
  onAddDeal,
  onAddTask,
}: Props) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={onImportCSV}
        className="h-10 w-10 rounded-full shadow-lg bg-background hover:bg-muted"
        aria-label="Import CSV"
        title="Import CSV"
      >
        <Upload className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onAddLead}
        className="h-10 w-10 rounded-full shadow-lg bg-background hover:bg-muted"
        aria-label="Add lead"
        title="Add Lead"
      >
        <UserPlus className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onAddDeal}
        className="h-10 w-10 rounded-full shadow-lg bg-background hover:bg-muted"
        aria-label="Add deal"
        title="Add Deal"
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        onClick={onAddTask}
        className="h-10 w-10 rounded-full shadow-lg"
        aria-label="Add task"
        title="Add Task"
      >
        <CheckSquare className="h-4 w-4" />
      </Button>
    </div>,
    document.body
  );
}
