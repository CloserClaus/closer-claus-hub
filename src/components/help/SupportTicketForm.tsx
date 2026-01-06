import { useState } from "react";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface SupportTicketFormProps {
  onClose: () => void;
  onBack: () => void;
}

export function SupportTicketForm({ onClose, onBack }: SupportTicketFormProps) {
  const { user, profile } = useAuth();
  const [email, setEmail] = useState(profile?.email || user?.email || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from("support_tickets").insert({
        user_id: user.id,
        user_email: email,
        title,
        description,
      }).select("id").single();

      if (error) throw error;

      // Send email notifications
      supabase.functions.invoke("send-support-email", {
        body: {
          userEmail: email,
          userName: profile?.full_name || "User",
          title,
          description,
          ticketId: data.id,
        },
      }).catch(console.error);

      toast.success("Support request submitted! We'll get back to you soon.");
      onClose();
    } catch (error) {
      console.error("Error submitting support ticket:", error);
      toast.error("Failed to submit support request");
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
        <h3 className="font-semibold">Contact Support</h3>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Your Email</label>
        <Input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Subject</label>
        <Input
          placeholder="Brief title for your request"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Description</label>
        <Textarea
          placeholder="Tell us how we can help..."
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
            Sending...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Send Request
          </>
        )}
      </Button>
    </form>
  );
}
