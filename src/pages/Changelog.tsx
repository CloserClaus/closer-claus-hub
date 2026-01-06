import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, Calendar, Users } from "lucide-react";

interface CompletedFeature {
  id: string;
  title: string;
  description: string;
  target_audience: string;
  updated_at: string;
}

export default function Changelog() {
  const [features, setFeatures] = useState<CompletedFeature[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompletedFeatures();
  }, []);

  const fetchCompletedFeatures = async () => {
    try {
      const { data, error } = await supabase
        .from("feature_requests")
        .select("id, title, description, target_audience, updated_at")
        .eq("status", "completed")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setFeatures(data || []);
    } catch (error) {
      console.error("Error fetching changelog:", error);
    } finally {
      setLoading(false);
    }
  };

  const getAudienceLabel = (audience: string) => {
    switch (audience) {
      case "agency":
        return "For Agencies";
      case "sdr":
        return "For SDRs";
      default:
        return "For Everyone";
    }
  };

  // Group features by month
  const groupedFeatures = features.reduce((acc, feature) => {
    const monthKey = format(new Date(feature.updated_at), "MMMM yyyy");
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(feature);
    return acc;
  }, {} as Record<string, CompletedFeature[]>);

  return (
    <DashboardLayout>
      <DashboardHeader title="Changelog" />

      <div className="p-4 md:p-6 space-y-6">
        <p className="text-muted-foreground">
          See what's new! Features completed based on your requests.
        </p>

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : Object.keys(groupedFeatures).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No completed features yet</h3>
              <p className="text-muted-foreground">
                Check back soon! We're working on your requests.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedFeatures).map(([month, monthFeatures]) => (
              <div key={month}>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">{month}</h2>
                </div>
                <div className="space-y-4 border-l-2 border-primary/20 pl-6 ml-2">
                  {monthFeatures.map((feature) => (
                    <Card key={feature.id} className="relative">
                      <div className="absolute -left-[30px] top-6 h-3 w-3 rounded-full bg-primary" />
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-4">
                          <CardTitle className="text-lg">{feature.title}</CardTitle>
                          <Badge variant="outline" className="shrink-0">
                            <Users className="h-3 w-3 mr-1" />
                            {getAudienceLabel(feature.target_audience)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {feature.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-3">
                          Completed {format(new Date(feature.updated_at), "MMM d, yyyy")}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
