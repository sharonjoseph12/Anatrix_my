import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InsightCard, type InsightType } from "@/components/charts/insight-card";

export default async function InsightsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/insights");

  const { data: insights } = await supabase
    .from("insights")
    .select("id,type,title,description,metric_value,metric_unit,confidence,data_points,recommended_action,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!insights || insights.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            Insights
          </h1>
          <p className="text-muted-foreground">
            Personalized patterns drawn from your activity.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>No insights yet</CardTitle>
            <CardDescription>
              Insights are generated every Monday. Track at least 7 days of
              activity to unlock your first batch.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const peak = insights.find((i) => i.type === "peak_window");
  const workflow = insights.find((i) => i.type === "workflow_pattern");
  const skill = insights.find((i) => i.type === "skill_detection");
  const trend = insights.find((i) => i.type === "productivity_trend");
  const rest = insights.filter(
    (i) => ![peak?.id, workflow?.id, skill?.id, trend?.id].includes(i.id),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-primary" />
          Insights
        </h1>
        <p className="text-muted-foreground">
          {insights.length} insight{insights.length === 1 ? "" : "s"} · refreshed weekly
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {peak && (
          <InsightCard
            id={peak.id}
            type={peak.type as InsightType}
            title={peak.title}
            description={peak.description}
            metricValue={peak.metric_value}
            metricUnit={peak.metric_unit}
            confidence={peak.confidence}
            dataPoints={peak.data_points}
            recommendedAction={peak.recommended_action}
          />
        )}
        {workflow && (
          <InsightCard
            id={workflow.id}
            type={workflow.type as InsightType}
            title={workflow.title}
            description={workflow.description}
            metricValue={workflow.metric_value}
            metricUnit={workflow.metric_unit}
            confidence={workflow.confidence}
            dataPoints={workflow.data_points}
            recommendedAction={workflow.recommended_action}
          />
        )}
        {skill && (
          <InsightCard
            id={skill.id}
            type={skill.type as InsightType}
            title={skill.title}
            description={skill.description}
            metricValue={skill.metric_value}
            metricUnit={skill.metric_unit}
            confidence={skill.confidence}
            dataPoints={skill.data_points}
            recommendedAction={skill.recommended_action}
          />
        )}
        {trend && (
          <InsightCard
            id={trend.id}
            type={trend.type as InsightType}
            title={trend.title}
            description={trend.description}
            metricValue={trend.metric_value}
            metricUnit={trend.metric_unit}
            confidence={trend.confidence}
            dataPoints={trend.data_points}
            recommendedAction={trend.recommended_action}
          />
        )}
      </div>

      {rest.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">More</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {rest.map((i) => (
              <InsightCard
                key={i.id}
                id={i.id}
                type={i.type as InsightType}
                title={i.title}
                description={i.description}
                metricValue={i.metric_value}
                metricUnit={i.metric_unit}
                confidence={i.confidence}
                dataPoints={i.data_points}
                recommendedAction={i.recommended_action}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
