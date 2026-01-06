import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Eye } from "lucide-react";

interface BugReport {
  id: string;
  user_id: string;
  user_role: string;
  title: string;
  description: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  user_email?: string;
  user_name?: string;
}

export function BugReportsTable() {
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBug, setSelectedBug] = useState<BugReport | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchBugReports();
  }, []);

  const fetchBugReports = async () => {
    try {
      const { data: reports, error } = await supabase
        .from("bug_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user info for each report
      const userIds = [...new Set(reports?.map((r) => r.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      const enrichedReports = reports?.map((report) => ({
        ...report,
        user_email: profileMap.get(report.user_id)?.email,
        user_name: profileMap.get(report.user_id)?.full_name,
      }));

      setBugReports(enrichedReports || []);
    } catch (error) {
      console.error("Error fetching bug reports:", error);
      toast.error("Failed to fetch bug reports");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const updates: Record<string, unknown> = { status };
      if (status === "resolved") {
        updates.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("bug_reports")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      setBugReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status, ...(status === "resolved" ? { resolved_at: new Date().toISOString() } : {}) } : r))
      );
      toast.success("Status updated");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const saveNotes = async () => {
    if (!selectedBug) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from("bug_reports")
        .update({ admin_notes: adminNotes })
        .eq("id", selectedBug.id);

      if (error) throw error;

      setBugReports((prev) =>
        prev.map((r) =>
          r.id === selectedBug.id ? { ...r, admin_notes: adminNotes } : r
        )
      );
      toast.success("Notes saved");
      setSelectedBug(null);
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error("Failed to save notes");
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="destructive">Open</Badge>;
      case "in_progress":
        return <Badge className="bg-amber-500">In Progress</Badge>;
      case "resolved":
        return <Badge className="bg-green-500">Resolved</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Submitted By</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bugReports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No bug reports yet
                </TableCell>
              </TableRow>
            ) : (
              bugReports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="font-medium">{report.title}</TableCell>
                  <TableCell>
                    <div>
                      <p>{report.user_name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">{report.user_email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{report.user_role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={report.status}
                      onValueChange={(value) => updateStatus(report.id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue>{getStatusBadge(report.status)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {format(new Date(report.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedBug(report);
                        setAdminNotes(report.admin_notes || "");
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedBug} onOpenChange={() => setSelectedBug(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedBug?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
              <p className="text-sm whitespace-pre-wrap">{selectedBug?.description}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Admin Notes</h4>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add internal notes about this bug..."
                rows={4}
              />
            </div>
            <Button onClick={saveNotes} disabled={updating}>
              {updating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Notes"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
