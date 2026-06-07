import Link from "next/link";
import { Users, Lock, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CohortCardProps {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  cohortType: "institutional" | "interest" | "custom";
  isPublic: boolean;
  href?: string;
  action?: React.ReactNode;
}

const TYPE_LABEL: Record<CohortCardProps["cohortType"], string> = {
  institutional: "Institutional",
  interest: "Interest",
  custom: "Custom",
};

export function CohortCard(props: CohortCardProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">{props.name}</CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {props.memberCount} member{props.memberCount === 1 ? "" : "s"}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {TYPE_LABEL[props.cohortType]}
              </Badge>
              {!props.isPublic && (
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Private
                </span>
              )}
            </div>
          </div>
        </div>
        {props.description && (
          <CardDescription className="line-clamp-2">
            {props.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className={cn("mt-auto flex items-center justify-between gap-2")}>
        <Button asChild variant="outline" size="sm">
          <Link href={props.href ?? `/dashboard/cohorts/${props.id}`}>
            View
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
        {props.action}
      </CardContent>
    </Card>
  );
}
