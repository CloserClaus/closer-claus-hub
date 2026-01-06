import { useState, useEffect } from "react";
import { ArrowLeft, Loader2, ChevronUp, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
  has_upvoted: boolean;
}

interface FeatureRequestPanelProps {
  onClose: () => void;
  onBack: () => void;
}

export function FeatureRequestPanel({ onClose, onBack }: FeatureRequestPanelProps) {
  const { user, userRole, profile } = useAuth();
  const [features, setFeatures] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [upvotingId, setUpvotingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("browse");
  
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
      // Fetch features relevant to user's role
      const audienceFilter = userRole === "sdr" 
        ? ["all", "sdr"] 
        : userRole === "agency_owner" 
          ? ["all", "agency"] 
          : ["all", "agency", "sdr"];

      const { data: featuresData, error } = await supabase
        .from("feature_requests")
        .select("*")
        .in("target_audience", audienceFilter)
        .in("status", ["pending", "planned", "in_progress"])
        .order("upvotes_count", { ascending: false });

      if (error) throw error;

      // Check which features the user has upvoted
      const { data: upvotes } = await supabase
        .from("feature_upvotes")
        .select("feature_id")
        .eq("user_id", user.id);

      const upvotedIds = new Set(upvotes?.map(u => u.feature_id) || []);

      setFeatures(
        (featuresData || []).map(f => ({
          ...f,
          has_upvoted: upvotedIds.has(f.id),
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
    setUpvotingId(featureId);

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

      // Update local state
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
      setUpvotingId(null);
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
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-[400px]">
      <div className="flex items-center gap-2 p-4 border-b">
        <Button type="button" variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold">Feature Requests</h3>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 mx-4 mt-2" style={{ width: "calc(100% - 2rem)" }}>
          <TabsTrigger value="browse">
            <Sparkles className="h-4 w-4 mr-1" />
            Browse & Vote
          </TabsTrigger>
          <TabsTrigger value="suggest">
            <Plus className="h-4 w-4 mr-1" />
            Suggest New
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="flex-1 m-0 p-4 pt-2">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : features.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Sparkles className="h-8 w-8 mb-2" />
              <p>No feature requests yet.</p>
              <p className="text-sm">Be the first to suggest one!</p>
            </div>
          ) : (
            <ScrollArea className="h-[280px]">
              <div className="space-y-2 pr-4">
                {features.map((feature) => (
                  <div
                    key={feature.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <Button
                      variant={feature.has_upvoted ? "default" : "outline"}
                      size="sm"
                      className="flex flex-col h-auto py-1 px-2 min-w-[40px]"
                      onClick={() => toggleUpvote(feature.id, feature.has_upvoted)}
                      disabled={upvotingId === feature.id}
                    >
                      {upvotingId === feature.id ? (
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

        <TabsContent value="suggest" className="flex-1 m-0 p-4 pt-2">
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
                rows={4}
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
