import { Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Settings | Antarix" };

export default function CollegeSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Building2 className="h-7 w-7" />
          Settings
        </h1>
        <p className="text-muted-foreground">
          Institution configuration and subscription.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>
            Starter is free. Upgrade for unlimited student imports and
            advanced analytics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Manage your subscription from the billing portal.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
