import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
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
import { Loader2, Eye, ThumbsUp, Bell } from "lucide-react";

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
  progress_percentage: number;
  created_at: string;
  user_email?: string;
  user_name?: string;
  followers_count?: number;
}

export function FeatureRequestsTable() {
  const [featureRequests, setFeatureRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeature, setSelectedFeature] = useState<FeatureRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [updating, setUpdating] = useState(false);
  const [audienceFilter, setAudienceFilter] = useState<string>("all");

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

      // Get follower counts
      const featureIds = requests?.map(f => f.id) || [];
      const { data: followerCounts } = await supabase
        .from("feature_followers")
        .select("feature_id")
        .in("feature_id", featureIds);

      const followerCountMap = new Map<string, number>();
      followerCounts?.forEach(fc => {
        followerCountMap.set(fc.feature_id, (followerCountMap.get(fc.feature_id) || 0) + 1);
      });

      const enrichedRequests = requests?.map((request) => ({
        ...request,
        progress_percentage: request.progress_percentage || 0,
        user_email: profileMap.get(request.user_id)?.email,
        user_name: profileMap.get(request.user_id)?.full_name,
        followers_count: followerCountMap.get(request.id) || 0,
      }));

      setFeatureRequests(enrichedRequests || []);
    } catch (error) {
      console.error("Error fetching feature requests:", error);
      toast.error("Failed to fetch feature requests");
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = featureRequests.filter((request) => {
    if (audienceFilter === "all") return true;
    return request.target_audience === audienceFilter;
  });

  const updateStatus = async (id: string, status: string) => {
    try {
      const updateData: { status: string; progress_percentage?: number } = { status };
      
      // Auto-set progress based on status
      if (status === "completed") {
        updateData.progress_percentage = 100;
      } else if (status === "planned" || status === "pending" || status === "rejected") {
        updateData.progress_percentage = 0;
      }

      const { error } = await supabase
        .from("feature_requests")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      setFeatureRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updateData } : r))
      );
      toast.success("Status updated");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const openFeatureDetails = (feature: FeatureRequest) => {
    setSelectedFeature(feature);
    setAdminNotes(feature.admin_notes || "");
    setProgressPercentage(feature.progress_percentage || 0);
  };

  const saveChanges = async () => {
    if (!selectedFeature) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from("feature_requests")
        .update({ 
          admin_notes: adminNotes,
          progress_percentage: progressPercentage
        })
        .eq("id", selectedFeature.id);

      if (error) throw error;

      setFeatureRequests((prev) =>
        prev.map((r) =>
          r.id === selectedFeature.id 
            ? { ...r, admin_notes: adminNotes, progress_percentage: progressPercentage } 
            : r
        )
      );
      toast.success("Changes saved");
      setSelectedFeature(null);
    } catch (error) {
      console.error("Error saving changes:", error);
      toast.error("Failed to save changes");
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
      {/* Audience Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { value: "all", label: "All" },
          { value: "agency", label: "Agency" },
          { value: "sdr", label: "SDR" },
        ].map((tab) => (
          <Button
            key={tab.value}
            variant={audienceFilter === tab.value ? "default" : "outline"}
            size="sm"
            onClick={() => setAudienceFilter(tab.value)}
          >
            {tab.label}
            {tab.value !== "all" && (
              <Badge variant="secondary" className="ml-2">
                {featureRequests.filter((r) => 
                  tab.value === "all" ? true : r.target_audience === tab.value
                ).length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Upvotes</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Audience</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Followers</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No feature requests {audienceFilter !== "all" ? `for ${audienceFilter}` : ""} yet
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <div className="flex items-center gap-1 font-bold text-lg">
                      <ThumbsUp className="h-5 w-5 text-primary" />
                      <span>{request.upvotes_count}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">{request.title}</TableCell>
                  <TableCell>
                    <div>
                      <p className="truncate max-w-[120px]">{request.user_name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground truncate max-w-[120px]">{request.user_email}</p>
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
                    {request.status === "in_progress" ? (
                      <div className="flex items-center gap-2 min-w-[80px]">
                        <Progress value={request.progress_percentage} className="h-2 flex-1" />
                        <span className="text-xs">{request.progress_percentage}%</span>
                      </div>
                    ) : request.status === "completed" ? (
                      <span className="text-green-600 font-medium">100%</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Bell className="h-4 w-4" />
                      <span>{request.followers_count}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(request.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openFeatureDetails(request)}
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
            <div className="flex gap-2 flex-wrap">
              {getAudienceBadge(selectedFeature?.target_audience || "all")}
              {getStatusBadge(selectedFeature?.status || "pending")}
              <Badge variant="outline" className="flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" />
                {selectedFeature?.upvotes_count} upvotes
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Bell className="h-3 w-3" />
                {selectedFeature?.followers_count} followers
              </Badge>
            </div>

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
              <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg">{selectedFeature?.description}</p>
            </div>

            {(selectedFeature?.status === "in_progress" || selectedFeature?.status === "planned") && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  Progress Percentage (for Roadmap)
                </Label>
                <div className="flex items-center gap-4 mt-2">
                  <Slider
                    value={[progressPercentage]}
                    onValueChange={([value]) => setProgressPercentage(value)}
                    max={100}
                    step={5}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={progressPercentage}
                    onChange={(e) => setProgressPercentage(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-20"
                    min={0}
                    max={100}
                  />
                  <span className="text-sm">%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  This progress will be shown on the public roadmap page
                </p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Admin Notes</h4>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add internal notes about this feature request..."
                rows={4}
              />
            </div>

            <Button onClick={saveChanges} disabled={updating}>
              {updating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
