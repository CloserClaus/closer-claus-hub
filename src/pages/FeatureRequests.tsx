import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, ThumbsUp, User, Calendar, Lightbulb } from "lucide-react";

interface FeatureRequest {
  id: string;
  user_id: string;
  user_role: string;
  title: string;
  description: string;
  target_audience: string;
  status: string;
  upvotes_count: number;
  created_at: string;
  user_name?: string;
  has_upvoted?: boolean;
}

export default function FeatureRequests() {
  const { user, userRole } = useAuth();
  const [featureRequests, setFeatureRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [upvotingId, setUpvotingId] = useState<string | null>(null);

  useEffect(() => {
    fetchFeatureRequests();
  }, [user]);

  const fetchFeatureRequests = async () => {
    if (!user) return;

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
        .select("id, full_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      // Check which features the current user has upvoted
      const { data: upvotes } = await supabase
        .from("feature_upvotes")
        .select("feature_id")
        .eq("user_id", user.id);

      const upvotedSet = new Set(upvotes?.map((u) => u.feature_id) || []);

      const enrichedRequests = requests?.map((request) => ({
        ...request,
        user_name: profileMap.get(request.user_id)?.full_name,
        has_upvoted: upvotedSet.has(request.id),
      }));

      setFeatureRequests(enrichedRequests || []);
    } catch (error) {
      console.error("Error fetching feature requests:", error);
      toast.error("Failed to fetch feature requests");
    } finally {
      setLoading(false);
    }
  };

  const toggleUpvote = async (featureId: string, hasUpvoted: boolean) => {
    if (!user) return;

    setUpvotingId(featureId);
    try {
      if (hasUpvoted) {
        const { error } = await supabase
          .from("feature_upvotes")
          .delete()
          .eq("feature_id", featureId)
          .eq("user_id", user.id);

        if (error) throw error;

        setFeatureRequests((prev) =>
          prev.map((r) =>
            r.id === featureId
              ? { ...r, has_upvoted: false, upvotes_count: r.upvotes_count - 1 }
              : r
          ).sort((a, b) => b.upvotes_count - a.upvotes_count)
        );
      } else {
        const { error } = await supabase.from("feature_upvotes").insert({
          feature_id: featureId,
          user_id: user.id,
        });

        if (error) throw error;

        setFeatureRequests((prev) =>
          prev.map((r) =>
            r.id === featureId
              ? { ...r, has_upvoted: true, upvotes_count: r.upvotes_count + 1 }
              : r
          ).sort((a, b) => b.upvotes_count - a.upvotes_count)
        );
      }
    } catch (error) {
      console.error("Error toggling upvote:", error);
      toast.error("Failed to update vote");
    } finally {
      setUpvotingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending Review</Badge>;
      case "planned":
        return <Badge className="bg-blue-500">Planned</Badge>;
      case "in_progress":
        return <Badge className="bg-amber-500">In Progress</Badge>;
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "rejected":
        return <Badge variant="destructive">Not Planned</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getAudienceBadge = (audience: string) => {
    switch (audience) {
      case "agency":
        return <Badge variant="outline">For Agencies</Badge>;
      case "sdr":
        return <Badge variant="outline">For SDRs</Badge>;
      default:
        return <Badge variant="outline">For Everyone</Badge>;
    }
  };

  const filteredRequests = featureRequests.filter((request) => {
    if (filter === "all") return true;
    if (filter === "my-votes") return request.has_upvoted;
    if (filter === "agency") return request.target_audience === "agency" || request.target_audience === "all";
    if (filter === "sdr") return request.target_audience === "sdr" || request.target_audience === "all";
    return true;
  });

  return (
    <DashboardLayout>
      <DashboardHeader title="Feature Requests" />

      <div className="p-4 md:p-6 space-y-6">
        <p className="text-muted-foreground -mt-4">Vote on features you'd like to see built. Top voted features get prioritized.</p>
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">All Features</TabsTrigger>
            <TabsTrigger value="my-votes">My Votes</TabsTrigger>
            {userRole === "agency_owner" && (
              <TabsTrigger value="agency">For Agencies</TabsTrigger>
            )}
            {userRole === "sdr" && (
              <TabsTrigger value="sdr">For SDRs</TabsTrigger>
            )}
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No feature requests yet</h3>
              <p className="text-muted-foreground">
                Use the help widget to request new features!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <Card key={request.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-4">
                    <Button
                      variant={request.has_upvoted ? "default" : "outline"}
                      size="sm"
                      className="flex-col h-auto py-2 px-3 min-w-[60px]"
                      onClick={() => toggleUpvote(request.id, request.has_upvoted || false)}
                      disabled={upvotingId === request.id}
                    >
                      {upvotingId === request.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <ThumbsUp className="h-4 w-4 mb-1" />
                          <span className="text-xs font-bold">{request.upvotes_count}</span>
                        </>
                      )}
                    </Button>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <CardTitle className="text-lg">{request.title}</CardTitle>
                        {getAudienceBadge(request.target_audience)}
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {request.description}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {request.user_name || "Anonymous"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(request.created_at), "MMM d, yyyy")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
