import { AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface KlausConfirmationDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function KlausConfirmationDialog({ message, onConfirm, onCancel }: KlausConfirmationDialogProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-[420px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-background shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">Klaus needs your confirmation</p>
            <p className="text-xs text-muted-foreground mt-0.5">This action will modify your data</p>
          </div>
        </div>
        <div className="px-5 py-3">
          <div className="rounded-lg bg-muted/50 border border-border px-4 py-3">
            <p className="text-sm text-foreground leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-2">
          <Button variant="outline" size="sm" onClick={onCancel} className="px-4">
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm} className="px-4 gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" />
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
