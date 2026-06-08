import { Search } from "lucide-react";
import { SearchForm } from "./search-form";

export const metadata = { title: "Search candidates | Antarix" };

export default function CompanySearchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Search className="h-7 w-7" />
          Search candidates
        </h1>
        <p className="text-muted-foreground">
          Filter by skill, score, batch year, and location. Only public profiles
          are searchable.
        </p>
      </div>
      <SearchForm />
    </div>
  );
}
