import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface BugReportFormProps {
  onClose: () => void;
  onBack: () => void;
}

export function BugReportForm({ onClose, onBack }: BugReportFormProps) {
  const { user, userRole } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userRole) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("bug_reports").insert({
        user_id: user.id,
        user_role: userRole,
        title,
        description,
      });

      if (error) throw error;

      toast.success("Bug report submitted! We'll look into it.");
      onClose();
    } catch (error) {
      console.error("Error submitting bug report:", error);
      toast.error("Failed to submit bug report");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Button type="button" variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold">Report a Bug</h3>
      </div>

      <div className="space-y-2">
        <Input
          placeholder="Brief title for the bug"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Textarea
          placeholder="Describe what happened and what you expected..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          required
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          "Submit Bug Report"
        )}
      </Button>
    </form>
  );
}
