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
import { Loader2, Eye, ThumbsUp } from "lucide-react";

interface FeatureRequest {
  id: string;
  user_id: string;
  user_role: string;
  title: string;
  description: string;
  target_audience: string;
  status: string;
  admin_notes: string | null;
  upvotes_count: number;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

export function FeatureRequestsTable() {
  const [featureRequests, setFeatureRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeature, setSelectedFeature] = useState<FeatureRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchFeatureRequests();
  }, []);

  const fetchFeatureRequests = async () => {
    try {
      const { data: requests, error } = await supabase
        .from("feature_requests")
        .select("*")
        .order("upvotes_count", { ascending: false });

      if (error) throw error;

      // Fetch user info for each request
      const userIds = [...new Set(requests?.map((r) => r.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      const enrichedRequests = requests?.map((request) => ({
        ...request,
        user_email: profileMap.get(request.user_id)?.email,
        user_name: profileMap.get(request.user_id)?.full_name,
      }));

      setFeatureRequests(enrichedRequests || []);
    } catch (error) {
      console.error("Error fetching feature requests:", error);
      toast.error("Failed to fetch feature requests");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from("feature_requests")
        .update({ status })
        .eq("id", id);

      if (error) throw error;

      setFeatureRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
      toast.success("Status updated");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const saveNotes = async () => {
    if (!selectedFeature) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from("feature_requests")
        .update({ admin_notes: adminNotes })
        .eq("id", selectedFeature.id);

      if (error) throw error;

      setFeatureRequests((prev) =>
        prev.map((r) =>
          r.id === selectedFeature.id ? { ...r, admin_notes: adminNotes } : r
        )
      );
      toast.success("Notes saved");
      setSelectedFeature(null);
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error("Failed to save notes");
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "planned":
        return <Badge className="bg-blue-500">Planned</Badge>;
      case "in_progress":
        return <Badge className="bg-amber-500">In Progress</Badge>;
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getAudienceBadge = (audience: string) => {
    switch (audience) {
      case "agency":
        return <Badge variant="outline">Agency</Badge>;
      case "sdr":
        return <Badge variant="outline">SDR</Badge>;
      default:
        return <Badge variant="outline">Everyone</Badge>;
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
              <TableHead>Upvotes</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Audience</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {featureRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No feature requests yet
                </TableCell>
              </TableRow>
            ) : (
              featureRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{request.upvotes_count}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{request.title}</TableCell>
                  <TableCell>
                    <div>
                      <p>{request.user_name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">{request.user_email}</p>
                    </div>
                  </TableCell>
                  <TableCell>{getAudienceBadge(request.target_audience)}</TableCell>
                  <TableCell>
                    <Select
                      value={request.status}
                      onValueChange={(value) => updateStatus(request.id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue>{getStatusBadge(request.status)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="planned">Planned</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {format(new Date(request.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFeature(request);
                        setAdminNotes(request.admin_notes || "");
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

      <Dialog open={!!selectedFeature} onOpenChange={() => setSelectedFeature(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedFeature?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              {getAudienceBadge(selectedFeature?.target_audience || "all")}
              {getStatusBadge(selectedFeature?.status || "pending")}
              <Badge variant="outline" className="flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" />
                {selectedFeature?.upvotes_count} upvotes
              </Badge>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
              <p className="text-sm whitespace-pre-wrap">{selectedFeature?.description}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Admin Notes</h4>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add internal notes about this feature request..."
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
