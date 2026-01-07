import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Loader2, 
  ThumbsUp, 
  Bell, 
  BellOff, 
  Calendar, 
  CheckCircle2,
  Clock,
  Lightbulb,
  Rocket,
  Target
} from "lucide-react";

interface RoadmapFeature {
  id: string;
  title: string;
  description: string;
  status: string;
  progress_percentage: number;
  upvotes_count: number;
  target_audience: string;
  created_at: string;
  updated_at: string;
  has_upvoted?: boolean;
  is_following?: boolean;
  followers_count?: number;
}

export default function Roadmap() {
  const { user } = useAuth();
  const [features, setFeatures] = useState<RoadmapFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("planned");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchRoadmapFeatures();
  }, [user]);

  const fetchRoadmapFeatures = async () => {
    try {
      // Get planned, in_progress, and completed features
      const { data: featuresData, error } = await supabase
        .from("feature_requests")
        .select("*")
        .in("status", ["planned", "in_progress", "completed"])
        .order("upvotes_count", { ascending: false });

      if (error) throw error;

      let enrichedFeatures = featuresData || [];

      if (user) {
        // Get user upvotes
        const { data: upvotes } = await supabase
          .from("feature_upvotes")
          .select("feature_id")
          .eq("user_id", user.id);

        const upvotedSet = new Set(upvotes?.map((u) => u.feature_id) || []);

        // Get user follows
        const { data: follows } = await supabase
          .from("feature_followers")
          .select("feature_id")
          .eq("user_id", user.id);

        const followedSet = new Set(follows?.map((f) => f.feature_id) || []);

        // Get follower counts
        const featureIds = featuresData?.map(f => f.id) || [];
        const { data: followerCounts } = await supabase
          .from("feature_followers")
          .select("feature_id")
          .in("feature_id", featureIds);

        const followerCountMap = new Map<string, number>();
        followerCounts?.forEach(fc => {
          followerCountMap.set(fc.feature_id, (followerCountMap.get(fc.feature_id) || 0) + 1);
        });

        enrichedFeatures = (featuresData || []).map(feature => ({
          ...feature,
          progress_percentage: feature.progress_percentage || 0,
          has_upvoted: upvotedSet.has(feature.id),
          is_following: followedSet.has(feature.id),
          followers_count: followerCountMap.get(feature.id) || 0,
        }));
      }

      setFeatures(enrichedFeatures);
    } catch (error) {
      console.error("Error fetching roadmap features:", error);
      toast.error("Failed to load roadmap");
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async (featureId: string, isFollowing: boolean) => {
    if (!user) {
      toast.error("Please sign in to follow features");
      return;
    }

    setActionLoading(featureId);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("feature_followers")
          .delete()
          .eq("feature_id", featureId)
          .eq("user_id", user.id);

        if (error) throw error;

        setFeatures(prev =>
          prev.map(f =>
            f.id === featureId
              ? { ...f, is_following: false, followers_count: (f.followers_count || 1) - 1 }
              : f
          )
        );
        toast.success("You'll no longer receive updates for this feature");
      } else {
        const { error } = await supabase
          .from("feature_followers")
          .insert({ feature_id: featureId, user_id: user.id });

        if (error) throw error;

        setFeatures(prev =>
          prev.map(f =>
            f.id === featureId
              ? { ...f, is_following: true, followers_count: (f.followers_count || 0) + 1 }
              : f
          )
        );
        toast.success("You'll be notified when this feature is updated");
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      toast.error("Failed to update notification preference");
    } finally {
      setActionLoading(null);
    }
  };

  const toggleUpvote = async (featureId: string, hasUpvoted: boolean) => {
    if (!user) {
      toast.error("Please sign in to vote");
      return;
    }

    setActionLoading(featureId);
    try {
      if (hasUpvoted) {
        const { error } = await supabase
          .from("feature_upvotes")
          .delete()
          .eq("feature_id", featureId)
          .eq("user_id", user.id);

        if (error) throw error;

        setFeatures(prev =>
          prev.map(f =>
            f.id === featureId
              ? { ...f, has_upvoted: false, upvotes_count: f.upvotes_count - 1 }
              : f
          )
        );
      } else {
        const { error } = await supabase
          .from("feature_upvotes")
          .insert({ feature_id: featureId, user_id: user.id });

        if (error) throw error;

        setFeatures(prev =>
          prev.map(f =>
            f.id === featureId
              ? { ...f, has_upvoted: true, upvotes_count: f.upvotes_count + 1 }
              : f
          )
        );
      }
    } catch (error) {
      console.error("Error toggling upvote:", error);
      toast.error("Failed to update vote");
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "planned":
        return <Target className="h-4 w-4" />;
      case "in_progress":
        return <Clock className="h-4 w-4" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "planned":
        return "bg-blue-500";
      case "in_progress":
        return "bg-amber-500";
      case "completed":
        return "bg-green-500";
      default:
        return "bg-muted";
    }
  };

  const filteredFeatures = features.filter(f => f.status === activeTab);

  const plannedCount = features.filter(f => f.status === "planned").length;
  const inProgressCount = features.filter(f => f.status === "in_progress").length;
  const completedCount = features.filter(f => f.status === "completed").length;

  return (
    <DashboardLayout>
      <DashboardHeader title="Product Roadmap" />

      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3 -mt-4">
          <Rocket className="h-5 w-5 text-primary" />
          <p className="text-muted-foreground">
            Track our progress on upcoming features. Follow features to get notified when they're released.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Planned</p>
                  <p className="text-2xl font-bold">{plannedCount}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold">{inProgressCount}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{completedCount}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="planned" className="gap-2">
              <Target className="h-4 w-4" />
              Planned ({plannedCount})
            </TabsTrigger>
            <TabsTrigger value="in_progress" className="gap-2">
              <Clock className="h-4 w-4" />
              In Progress ({inProgressCount})
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Completed ({completedCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {loading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredFeatures.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  {getStatusIcon(activeTab)}
                  <h3 className="text-lg font-medium mt-4 mb-2">
                    No {activeTab.replace("_", " ")} features
                  </h3>
                  <p className="text-muted-foreground">
                    {activeTab === "completed" 
                      ? "Completed features will appear here"
                      : "Features will be added to the roadmap soon"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredFeatures.map((feature) => (
                  <Card key={feature.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <Badge className={getStatusColor(feature.status)}>
                              {getStatusIcon(feature.status)}
                              <span className="ml-1 capitalize">
                                {feature.status.replace("_", " ")}
                              </span>
                            </Badge>
                            <Badge variant="outline">
                              {feature.target_audience === "agency" 
                                ? "For Agencies" 
                                : feature.target_audience === "sdr" 
                                  ? "For SDRs" 
                                  : "For Everyone"}
                            </Badge>
                          </div>
                          <CardTitle className="text-lg">{feature.title}</CardTitle>
                          <CardDescription className="mt-2 whitespace-pre-wrap">
                            {feature.description}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant={feature.has_upvoted ? "default" : "outline"}
                            size="sm"
                            className="flex-col h-auto py-2 px-3"
                            onClick={() => toggleUpvote(feature.id, feature.has_upvoted || false)}
                            disabled={actionLoading === feature.id}
                          >
                            <ThumbsUp className="h-4 w-4 mb-1" />
                            <span className="text-xs font-bold">{feature.upvotes_count}</span>
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {feature.status === "in_progress" && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{feature.progress_percentage}%</span>
                          </div>
                          <Progress value={feature.progress_percentage} className="h-2" />
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(feature.updated_at), "MMM d, yyyy")}
                          </span>
                          {(feature.followers_count || 0) > 0 && (
                            <span className="flex items-center gap-1">
                              <Bell className="h-3 w-3" />
                              {feature.followers_count} following
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2"
                          onClick={() => toggleFollow(feature.id, feature.is_following || false)}
                          disabled={actionLoading === feature.id}
                        >
                          {actionLoading === feature.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : feature.is_following ? (
                            <>
                              <BellOff className="h-4 w-4" />
                              Unfollow
                            </>
                          ) : (
                            <>
                              <Bell className="h-4 w-4" />
                              Follow
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
