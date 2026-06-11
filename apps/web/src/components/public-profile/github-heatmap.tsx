import { Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityHeatmap, type HeatmapDay } from "@/components/charts/activity-heatmap";

export function GitHubHeatmap({
  data,
  totalCommits,
}: {
  data: HeatmapDay[];
  totalCommits: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" />
          Recent activity
        </CardTitle>
        <CardDescription>
          {totalCommits.toLocaleString()} commits in the last 365 days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ActivityHeatmap data={data} />
      </CardContent>
    </Card>
  );
}
