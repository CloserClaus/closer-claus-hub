import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  DollarSign, 
  UserPlus, 
  Phone, 
  FileText, 
  TrendingUp,
  AlertTriangle 
} from "lucide-react";

interface Activity {
  id: string;
  type: 'deal' | 'user' | 'call' | 'contract' | 'commission' | 'dispute';
  title: string;
  description: string;
  timestamp: string;
}

interface ActivityFeedProps {
  activities: Activity[];
}

const iconMap = {
  deal: TrendingUp,
  user: UserPlus,
  call: Phone,
  contract: FileText,
  commission: DollarSign,
  dispute: AlertTriangle,
};

const colorMap = {
  deal: 'text-primary',
  user: 'text-success',
  call: 'text-blue-500',
  contract: 'text-purple-500',
  commission: 'text-success',
  dispute: 'text-warning',
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No recent activity
          </p>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => {
              const Icon = iconMap[activity.type];
              const colorClass = colorMap[activity.type];
              
              return (
                <div key={activity.id} className="flex gap-3">
                  <div className={`shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center`}>
                    <Icon className={`h-4 w-4 ${colorClass}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {activity.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {activity.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
