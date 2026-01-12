import { useState, useEffect } from "react";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  Loader2, 
  ChevronUp, 
  Plus, 
  Sparkles, 
  Rocket, 
  Calendar,
  Target,
  Clock,
  CheckCircle2,
  Bell,
  BellOff,
  ThumbsUp,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  upvotes_count: number;
  status: string;
  target_audience: string;
  progress_percentage: number;
  updated_at: string;
  has_upvoted: boolean;
  is_following?: boolean;
  followers_count?: number;
}

interface FeatureHubProps {
  onClose: () => void;
  onBack: () => void;
}

export function FeatureHub({ onClose, onBack }: FeatureHubProps) {
  const { user, userRole, profile } = useAuth();
  const [features, setFeatures] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("browse");
  const [roadmapTab, setRoadmapTab] = useState("planned");
  
  // New feature form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchFeatures();
  }, [user, userRole]);

  const fetchFeatures = async () => {
    if (!user) return;
    
    try {
      const { data: featuresData, error } = await supabase
        .from("feature_requests")
        .select("*")
        .order("upvotes_count", { ascending: false });

      if (error) throw error;

      // Check which features the user has upvoted
      const { data: upvotes } = await supabase
        .from("feature_upvotes")
        .select("feature_id")
        .eq("user_id", user.id);

      const upvotedIds = new Set(upvotes?.map(u => u.feature_id) || []);

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

      setFeatures(
        (featuresData || []).map(f => ({
          ...f,
          progress_percentage: f.progress_percentage || 0,
          has_upvoted: upvotedIds.has(f.id),
          is_following: followedSet.has(f.id),
          followers_count: followerCountMap.get(f.id) || 0,
        }))
      );
    } catch (error) {
      console.error("Error fetching features:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUpvote = async (featureId: string, hasUpvoted: boolean) => {
    if (!user) return;
    setActionLoading(featureId);

    try {
      if (hasUpvoted) {
        await supabase
          .from("feature_upvotes")
          .delete()
          .eq("feature_id", featureId)
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("feature_upvotes")
          .insert({ feature_id: featureId, user_id: user.id });
      }

      setFeatures(prev =>
        prev
          .map(f =>
            f.id === featureId
              ? {
                  ...f,
                  upvotes_count: hasUpvoted ? f.upvotes_count - 1 : f.upvotes_count + 1,
                  has_upvoted: !hasUpvoted,
                }
              : f
          )
          .sort((a, b) => b.upvotes_count - a.upvotes_count)
      );
    } catch (error) {
      console.error("Error toggling upvote:", error);
      toast.error("Failed to update vote");
    } finally {
      setActionLoading(null);
    }
  };

  const toggleFollow = async (featureId: string, isFollowing: boolean) => {
    if (!user) return;
    setActionLoading(featureId);

    try {
      if (isFollowing) {
        await supabase
          .from("feature_followers")
          .delete()
          .eq("feature_id", featureId)
          .eq("user_id", user.id);
        toast.success("Unfollowed feature");
      } else {
        await supabase
          .from("feature_followers")
          .insert({ feature_id: featureId, user_id: user.id });
        toast.success("You'll be notified when this feature is updated");
      }

      setFeatures(prev =>
        prev.map(f =>
          f.id === featureId
            ? { ...f, is_following: !isFollowing, followers_count: isFollowing ? (f.followers_count || 1) - 1 : (f.followers_count || 0) + 1 }
            : f
        )
      );
    } catch (error) {
      console.error("Error toggling follow:", error);
      toast.error("Failed to update notification preference");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmitFeature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userRole) return;

    setIsSubmitting(true);
    try {
      const targetAudience = userRole === "sdr" ? "sdr" : userRole === "agency_owner" ? "agency" : "all";
      
      const { error } = await supabase.from("feature_requests").insert({
        user_id: user.id,
        user_role: userRole,
        title,
        description,
        target_audience: targetAudience,
      });

      if (error) throw error;

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

      toast.success("Feature request submitted!");
      setTitle("");
      setDescription("");
      setActiveTab("browse");
      fetchFeatures();
    } catch (error) {
      console.error("Error submitting feature request:", error);
      toast.error("Failed to submit feature request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "planned":
        return <Badge variant="secondary" className="text-xs">Planned</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-500 text-xs">In Progress</Badge>;
      case "completed":
        return <Badge className="bg-green-500 text-xs">Completed</Badge>;
      default:
        return null;
    }
  };

  const browseFeatures = features.filter(f => ["pending", "planned", "in_progress"].includes(f.status));
  const roadmapFeatures = features.filter(f => f.status === roadmapTab);
  const changelogFeatures = features.filter(f => f.status === "completed");

  // Group changelog by month
  const groupedChangelog = changelogFeatures.reduce((acc, feature) => {
    const monthKey = format(new Date(feature.updated_at), "MMMM yyyy");
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(feature);
    return acc;
  }, {} as Record<string, FeatureRequest[]>);

  const plannedCount = features.filter(f => f.status === "planned").length;
  const inProgressCount = features.filter(f => f.status === "in_progress").length;
  const completedCount = features.filter(f => f.status === "completed").length;

  return (
    <div className="flex flex-col h-[480px]">
      <div className="flex items-center gap-2 p-4 border-b">
        <Button type="button" variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold">Features & Updates</h3>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-4 mx-4 mt-2" style={{ width: "calc(100% - 2rem)" }}>
          <TabsTrigger value="browse" className="text-xs px-2">
            <Sparkles className="h-3 w-3 mr-1" />
            Vote
          </TabsTrigger>
          <TabsTrigger value="roadmap" className="text-xs px-2">
            <Rocket className="h-3 w-3 mr-1" />
            Roadmap
          </TabsTrigger>
          <TabsTrigger value="changelog" className="text-xs px-2">
            <Calendar className="h-3 w-3 mr-1" />
            Updates
          </TabsTrigger>
          <TabsTrigger value="suggest" className="text-xs px-2">
            <Plus className="h-3 w-3 mr-1" />
            New
          </TabsTrigger>
        </TabsList>

        {/* Browse & Vote Tab */}
        <TabsContent value="browse" className="flex-1 m-0 p-4 pt-2 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : browseFeatures.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Sparkles className="h-8 w-8 mb-2" />
              <p>No feature requests yet.</p>
              <p className="text-sm">Be the first to suggest one!</p>
            </div>
          ) : (
            <ScrollArea className="h-[340px]">
              <div className="space-y-2 pr-4">
                {browseFeatures.map((feature) => (
                  <div
                    key={feature.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <Button
                      variant={feature.has_upvoted ? "default" : "outline"}
                      size="sm"
                      className="flex flex-col h-auto py-1 px-2 min-w-[40px]"
                      onClick={() => toggleUpvote(feature.id, feature.has_upvoted)}
                      disabled={actionLoading === feature.id}
                    >
                      {actionLoading === feature.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ChevronUp className="h-3 w-3" />
                      )}
                      <span className="text-xs font-semibold">{feature.upvotes_count}</span>
                    </Button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-sm truncate">{feature.title}</h4>
                        {getStatusBadge(feature.status)}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Roadmap Tab */}
        <TabsContent value="roadmap" className="flex-1 m-0 p-4 pt-2 overflow-hidden">
          <div className="flex gap-1 mb-3">
            <Button 
              variant={roadmapTab === "planned" ? "default" : "ghost"} 
              size="sm" 
              className="text-xs h-7"
              onClick={() => setRoadmapTab("planned")}
            >
              <Target className="h-3 w-3 mr-1" />
              Planned ({plannedCount})
            </Button>
            <Button 
              variant={roadmapTab === "in_progress" ? "default" : "ghost"} 
              size="sm" 
              className="text-xs h-7"
              onClick={() => setRoadmapTab("in_progress")}
            >
              <Clock className="h-3 w-3 mr-1" />
              Building ({inProgressCount})
            </Button>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center h-[280px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : roadmapFeatures.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[280px] text-center text-muted-foreground">
              <Rocket className="h-8 w-8 mb-2" />
              <p>No features {roadmapTab === "planned" ? "planned" : "in progress"} yet.</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2 pr-4">
                {roadmapFeatures.map((feature) => (
                  <div
                    key={feature.id}
                    className="p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm">{feature.title}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {feature.description}
                        </p>
                        {feature.status === "in_progress" && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">Progress</span>
                              <span>{feature.progress_percentage}%</span>
                            </div>
                            <Progress value={feature.progress_percentage} className="h-1.5" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button
                          variant={feature.has_upvoted ? "default" : "outline"}
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => toggleUpvote(feature.id, feature.has_upvoted)}
                          disabled={actionLoading === feature.id}
                        >
                          <ThumbsUp className="h-3 w-3 mr-1" />
                          <span className="text-xs">{feature.upvotes_count}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => toggleFollow(feature.id, feature.is_following || false)}
                          disabled={actionLoading === feature.id}
                        >
                          {feature.is_following ? (
                            <BellOff className="h-3 w-3" />
                          ) : (
                            <Bell className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Changelog Tab */}
        <TabsContent value="changelog" className="flex-1 m-0 p-4 pt-2 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-[340px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : Object.keys(groupedChangelog).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[340px] text-center text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mb-2" />
              <p>No completed features yet.</p>
              <p className="text-sm">Check back soon!</p>
            </div>
          ) : (
            <ScrollArea className="h-[340px]">
              <div className="space-y-4 pr-4">
                {Object.entries(groupedChangelog).map(([month, monthFeatures]) => (
                  <div key={month}>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-semibold">{month}</h4>
                    </div>
                    <div className="space-y-2 border-l-2 border-primary/20 pl-4 ml-2">
                      {monthFeatures.map((feature) => (
                        <div key={feature.id} className="relative">
                          <div className="absolute -left-[18px] top-2 h-2 w-2 rounded-full bg-primary" />
                          <div className="p-2 rounded-lg border bg-card">
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <h5 className="font-medium text-sm">{feature.title}</h5>
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                  {feature.description}
                                </p>
                              </div>
                              <Badge variant="outline" className="text-xs shrink-0">
                                <Users className="h-3 w-3 mr-1" />
                                {feature.target_audience === "agency" ? "Agencies" : feature.target_audience === "sdr" ? "SDRs" : "All"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Suggest New Tab */}
        <TabsContent value="suggest" className="flex-1 m-0 p-4 pt-2 overflow-hidden">
          <form onSubmit={handleSubmitFeature} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Feature Title</label>
              <Input
                placeholder="What feature would you like?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Description</label>
              <Textarea
                placeholder="Describe the feature and why it would be helpful..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
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
                "Submit Feature Request"
              )}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
