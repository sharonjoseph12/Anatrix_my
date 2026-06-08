// Minimal layout for the (company) route group. The pre-existing pages
// in this group (analytics, pipeline, search) are pure client components
// and don't need a layout, but Next.js requires a layout to exist for
// a route group whose first leaf is a server component (see
// (company)/ats/page.tsx). Keep this file minimal — the rich shell
// lives in apps/web/src/app/company/layout.tsx for the /company/* URLs.

export default function CompanyGroupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
