import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface FeatureRequestFormProps {
  onClose: () => void;
  onBack: () => void;
}

export function FeatureRequestForm({ onClose, onBack }: FeatureRequestFormProps) {
  const { user, userRole, profile } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState<string>("all");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userRole) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("feature_requests").insert({
        user_id: user.id,
        user_role: userRole,
        title,
        description,
        target_audience: targetAudience,
      });

      if (error) throw error;

      // Notify admins
      supabase.functions.invoke("notify-admin-feedback", {
        body: {
          type: "feature",
          title,
          description,
          userName: profile?.full_name || "Unknown User",
          userEmail: profile?.email || user.email,
          userRole,
          targetAudience,
        },
      }).catch(console.error);

      toast.success("Feature request submitted! Thanks for your feedback.");
      onClose();
    } catch (error) {
      console.error("Error submitting feature request:", error);
      toast.error("Failed to submit feature request");
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
        <h3 className="font-semibold">Request a Feature</h3>
      </div>

      <div className="space-y-2">
        <Input
          placeholder="Feature title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Textarea
          placeholder="Describe the feature and why it would be helpful..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Who would benefit?</label>
        <Select value={targetAudience} onValueChange={setTargetAudience}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            <SelectItem value="agency">Agency Owners</SelectItem>
            <SelectItem value="sdr">SDRs</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          "Submit Feature Request"
        )}
      </Button>
    </form>
  );
}
