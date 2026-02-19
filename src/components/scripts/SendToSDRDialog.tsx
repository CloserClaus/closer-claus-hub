import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Send, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

interface SDRMember {
  user_id: string;
  full_name: string | null;
  email: string;
}

interface ObjectionItem {
  category: string;
  phase: string;
  objection: string;
  meaning: string;
  understanding: string;
  strategy: string;
  what_to_say: string;
  if_they_resist: string;
  if_they_engage: string;
  return_to_beat: string;
}

interface SendToSDRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scriptTitle: string;
  scriptContent: string;
  playbookContent?: string | null;
  objectionPlaybook?: ObjectionItem[] | null;
}

export function SendToSDRDialog({
  open,
  onOpenChange,
  scriptTitle,
  scriptContent,
  playbookContent,
  objectionPlaybook,
}: SendToSDRDialogProps) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [sdrs, setSdrs] = useState<SDRMember[]>([]);
  const [selectedSdrIds, setSelectedSdrIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (open && currentWorkspace?.id) {
      fetchSDRs();
    }
  }, [open, currentWorkspace?.id]);

  const fetchSDRs = async () => {
    if (!currentWorkspace?.id) return;
    setIsLoading(true);

    const { data: members, error } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", currentWorkspace.id)
      .is("removed_at", null)
      .limit(5);

    if (error || !members) {
      console.error("Error fetching SDRs:", error);
      setIsLoading(false);
      return;
    }

    const userIds = members.map((m) => m.user_id);
    if (userIds.length === 0) {
      setSdrs([]);
      setIsLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    setSdrs(
      (profiles || []).map((p) => ({
        user_id: p.id,
        full_name: p.full_name,
        email: p.email,
      }))
    );
    setIsLoading(false);
  };

  const toggleSDR = (userId: string) => {
    setSelectedSdrIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSend = async () => {
    if (!currentWorkspace?.id || !user?.id || selectedSdrIds.length === 0) return;

    setIsSending(true);

    try {
      // 1. Create a new call_script in the workspace's Dialer Scripts
      const { error: scriptError } = await supabase
        .from("call_scripts")
        .insert({
          workspace_id: currentWorkspace.id,
          title: scriptTitle,
          content: scriptContent,
          is_default: false,
          created_by: user.id,
        });

      if (scriptError) {
        console.error("Error creating call script:", scriptError);
        toast.error("Failed to add script to Dialer");
        setIsSending(false);
        return;
      }

      // 2. Create training material: Strategy context -> Conversation flow -> Objection handling
      let trainingContent = `## 1. Strategy Context (How to Think)\n\n`;
      trainingContent += playbookContent || 'No strategy content available.';
      trainingContent += `\n\n---\n\n## 2. Conversation Flow (What to Say)\n\n${scriptContent}`;
      if (objectionPlaybook && objectionPlaybook.length > 0) {
        trainingContent += `\n\n---\n\n## 3. Objection Handling\n\n`;
        const phases = ['Likely First Objections', 'Common Mid-Call Objections', 'Late-Stage Objections'];
        for (const phase of phases) {
          const items = objectionPlaybook.filter(o => o.phase === phase);
          if (items.length === 0) continue;
          trainingContent += `### ${phase}\n\n`;
          for (const item of items) {
            trainingContent += `**"${item.objection}"**\n`;
            trainingContent += `- *Category:* ${item.category}\n`;
            trainingContent += `- *What this means:* ${item.meaning}\n`;
            trainingContent += `- *Strategy:* ${item.strategy}\n`;
            trainingContent += `- *What to say:* "${item.what_to_say}"\n`;
            trainingContent += `- *If they resist:* "${item.if_they_resist}"\n`;
            trainingContent += `- *If they engage:* "${item.if_they_engage}"\n`;
            trainingContent += `- *Return to:* ${item.return_to_beat}\n\n`;
          }
        }
      }

      const { error: trainingError } = await supabase
        .from("training_materials")
        .insert({
          workspace_id: currentWorkspace.id,
          title: scriptTitle,
          description: "Script generated from Script Builder",
          content_type: "document",
          content: trainingContent,
          created_by: user.id,
        } as any);

      if (trainingError) {
        console.error("Error creating training material:", trainingError);
        // Non-blocking — script was already added to dialer
      }

      // 3. Send notifications to selected SDRs
      const workspaceName = currentWorkspace.name || "Your agency";

      const scriptNotifications = selectedSdrIds.map((sdrId) => ({
        user_id: sdrId,
        workspace_id: currentWorkspace.id,
        title: "New Call Script Assigned",
        message: `New call script assigned by ${workspaceName}: "${scriptTitle}"`,
        type: "script_assigned",
        is_read: false,
      }));

      const trainingNotifications = selectedSdrIds.map((sdrId) => ({
        user_id: sdrId,
        workspace_id: currentWorkspace.id,
        title: "New Training Material",
        message: `New training assigned: script, strategy & objection playbook for "${scriptTitle}"`,
        type: "training_assigned",
        is_read: false,
      }));

      const { error: notifError } = await supabase
        .from("notifications")
        .insert([...scriptNotifications, ...trainingNotifications]);

      if (notifError) {
        console.error("Error sending notifications:", notifError);
      }

      toast.success("Script successfully assigned.");
      setSelectedSdrIds([]);
      onOpenChange(false);
    } catch (err) {
      console.error("Send to SDR error:", err);
      toast.error("Failed to send script");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send to SDR
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-3">
            Select SDRs to receive this script in their Dialer and Training tabs.
          </p>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : sdrs.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No SDRs in this workspace</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-3">
                {sdrs.map((sdr) => (
                  <div
                    key={sdr.user_id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      id={`sdr-${sdr.user_id}`}
                      checked={selectedSdrIds.includes(sdr.user_id)}
                      onCheckedChange={() => toggleSDR(sdr.user_id)}
                    />
                    <Label
                      htmlFor={`sdr-${sdr.user_id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <p className="text-sm font-medium">
                        {sdr.full_name || "Unnamed SDR"}
                      </p>
                      <p className="text-xs text-muted-foreground">{sdr.email}</p>
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || selectedSdrIds.length === 0}
            className="gap-2"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send ({selectedSdrIds.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
