import { DocsNav } from "@/components/docs/docs-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-12 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-8">
            <DocsNav />
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
      <SiteFooter />
    </>
  );
}
