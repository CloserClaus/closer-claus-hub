import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Loader2, Eye, Mail, Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface TicketReply {
  id: string;
  admin_id: string;
  message: string;
  created_at: string;
  admin_name?: string;
}

interface SupportTicket {
  id: string;
  user_id: string;
  user_email: string;
  title: string;
  description: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string;
  replies?: TicketReply[];
}

export function SupportTicketsTable() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user names
      const userIds = [...new Set((data || []).map(t => t.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      setTickets(
        (data || []).map(t => ({
          ...t,
          user_name: profileMap.get(t.user_id) || "Unknown User",
        }))
      );
    } catch (error) {
      console.error("Error fetching support tickets:", error);
      toast.error("Failed to load support tickets");
    } finally {
      setLoading(false);
    }
  };

  const fetchReplies = async (ticketId: string) => {
    try {
      const { data: replies, error } = await supabase
        .from("ticket_replies")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch admin names
      const adminIds = [...new Set((replies || []).map(r => r.admin_id))];
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", adminIds);

      const adminMap = new Map(adminProfiles?.map(p => [p.id, p.full_name]) || []);

      return (replies || []).map(reply => ({
        ...reply,
        admin_name: adminMap.get(reply.admin_id) || "Admin",
      }));
    } catch (error) {
      console.error("Error fetching replies:", error);
      return [];
    }
  };

  const openTicketDetails = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setAdminNotes(ticket.admin_notes || "");
    setReplyMessage("");
    
    const replies = await fetchReplies(ticket.id);
    setSelectedTicket(prev => prev ? { ...prev, replies } : null);
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status })
        .eq("id", id);

      if (error) throw error;

      setTickets(prev =>
        prev.map(t => (t.id === id ? { ...t, status } : t))
      );
      toast.success("Status updated");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const saveNotes = async () => {
    if (!selectedTicket) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ admin_notes: adminNotes })
        .eq("id", selectedTicket.id);

      if (error) throw error;

      setTickets(prev =>
        prev.map(t =>
          t.id === selectedTicket.id ? { ...t, admin_notes: adminNotes } : t
        )
      );
      toast.success("Notes saved");
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error("Failed to save notes");
    } finally {
      setSaving(false);
    }
  };

  const sendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    setSendingReply(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Insert reply into database
      const { data: newReply, error: insertError } = await supabase
        .from("ticket_replies")
        .insert({
          ticket_id: selectedTicket.id,
          admin_id: user.id,
          message: replyMessage.trim(),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Send email notification to user
      const { error: emailError } = await supabase.functions.invoke("send-ticket-reply", {
        body: {
          userEmail: selectedTicket.user_email,
          userName: selectedTicket.user_name,
          ticketTitle: selectedTicket.title,
          replyMessage: replyMessage.trim(),
          ticketId: selectedTicket.id,
        },
      });

      if (emailError) {
        console.error("Failed to send email notification:", emailError);
        toast.warning("Reply saved but email notification failed");
      } else {
        toast.success("Reply sent and user notified via email");
      }

      // Update local state
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const replyWithName = {
        ...newReply,
        admin_name: profile?.full_name || "Admin",
      };

      setSelectedTicket(prev => 
        prev ? { 
          ...prev, 
          replies: [...(prev.replies || []), replyWithName] 
        } : null
      );
      setReplyMessage("");

      // Update status to in_progress if it was open
      if (selectedTicket.status === "open") {
        await updateStatus(selectedTicket.id, "in_progress");
        setSelectedTicket(prev => 
          prev ? { ...prev, status: "in_progress" } : null
        );
      }
    } catch (error) {
      console.error("Error sending reply:", error);
      toast.error("Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="destructive">Open</Badge>;
      case "in_progress":
        return <Badge className="bg-yellow-500">In Progress</Badge>;
      case "resolved":
        return <Badge className="bg-green-500">Resolved</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Subject</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No support tickets yet
              </TableCell>
            </TableRow>
          ) : (
            tickets.map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell className="font-medium max-w-[200px] truncate">
                  {ticket.title}
                </TableCell>
                <TableCell>{ticket.user_name}</TableCell>
                <TableCell>
                  <a
                    href={`mailto:${ticket.user_email}`}
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <Mail className="h-3 w-3" />
                    {ticket.user_email}
                  </a>
                </TableCell>
                <TableCell>
                  <Select
                    value={ticket.status}
                    onValueChange={(value) => updateStatus(ticket.id, value)}
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {format(new Date(ticket.created_at), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openTicketDetails(ticket)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Support Ticket Details</DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">User</p>
                  <p className="font-medium">{selectedTicket.user_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <a
                    href={`mailto:${selectedTicket.user_email}`}
                    className="text-primary hover:underline"
                  >
                    {selectedTicket.user_email}
                  </a>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedTicket.status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p>{format(new Date(selectedTicket.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Subject</p>
                <p className="font-medium">{selectedTicket.title}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p className="whitespace-pre-wrap bg-muted p-3 rounded-lg text-sm">
                  {selectedTicket.description}
                </p>
              </div>

              {/* Replies Section */}
              <div>
                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Replies ({selectedTicket.replies?.length || 0})
                </p>
                {selectedTicket.replies && selectedTicket.replies.length > 0 ? (
                  <div className="space-y-3 max-h-[200px] overflow-y-auto">
                    {selectedTicket.replies.map((reply) => (
                      <div key={reply.id} className="bg-primary/5 border-l-4 border-primary p-3 rounded-r-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{reply.admin_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(reply.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{reply.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No replies yet</p>
                )}
              </div>

              {/* Reply Form */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Send Reply to User</p>
                <Textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your reply... (This will be sent to the user via email)"
                  rows={3}
                />
                <Button 
                  onClick={sendReply} 
                  disabled={sendingReply || !replyMessage.trim()} 
                  className="mt-2"
                >
                  {sendingReply ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Reply & Notify User
                    </>
                  )}
                </Button>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Internal Admin Notes</p>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add internal notes (not visible to user)..."
                  rows={2}
                />
                <Button onClick={saveNotes} disabled={saving} variant="outline" className="mt-2">
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Notes"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
