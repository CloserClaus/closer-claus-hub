import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ChartDataPoint {
  name: string;
  value: number;
  value2?: number;
}

interface AnalyticsChartProps {
  title: string;
  description?: string;
  data: ChartDataPoint[];
  type?: 'area' | 'bar';
  color?: string;
  secondaryColor?: string;
  valueFormatter?: (value: number) => string;
  showSecondary?: boolean;
  secondaryLabel?: string;
  primaryLabel?: string;
}

export function AnalyticsChart({
  title,
  description,
  data,
  type = 'area',
  color = 'hsl(var(--primary))',
  secondaryColor = 'hsl(var(--secondary))',
  valueFormatter = (v) => v.toString(),
  showSecondary = false,
  primaryLabel = 'Value',
  secondaryLabel = 'Secondary'
}: AnalyticsChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm text-muted-foreground">
              {entry.name}: {valueFormatter(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {type === 'area' ? (
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                  {showSecondary && (
                    <linearGradient id="colorValue2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={secondaryColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={secondaryColor} stopOpacity={0} />
                    </linearGradient>
                  )}
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={valueFormatter}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  name={primaryLabel}
                  stroke={color}
                  strokeWidth={2}
                  fill="url(#colorValue)"
                />
                {showSecondary && (
                  <Area
                    type="monotone"
                    dataKey="value2"
                    name={secondaryLabel}
                    stroke={secondaryColor}
                    strokeWidth={2}
                    fill="url(#colorValue2)"
                  />
                )}
              </AreaChart>
            ) : (
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={valueFormatter}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="value" 
                  name={primaryLabel}
                  fill={color} 
                  radius={[4, 4, 0, 0]} 
                />
                {showSecondary && (
                  <Bar 
                    dataKey="value2" 
                    name={secondaryLabel}
                    fill={secondaryColor} 
                    radius={[4, 4, 0, 0]} 
                  />
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
