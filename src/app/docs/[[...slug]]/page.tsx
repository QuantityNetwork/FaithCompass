import Link from "next/link";
import { notFound } from "next/navigation";
import { DOC_CONTENT } from "@/components/docs/content";
import { ALL_DOCS } from "@/components/docs/nav";

export function generateStaticParams() {
  return ALL_DOCS.map((d) => ({ slug: d.slug ? [d.slug] : [] }));
}

export async function generateMetadata(props: PageProps<"/docs/[[...slug]]">) {
  const { slug = [] } = await props.params;
  const doc = ALL_DOCS.find((d) => d.slug === slug.join("/"));
  return { title: doc ? `${doc.title} — Documentation` : "Documentation", description: doc?.description };
}

export default async function DocPage(props: PageProps<"/docs/[[...slug]]">) {
  const { slug = [] } = await props.params;
  const key = slug.join("/");
  const Content = DOC_CONTENT[key];
  const index = ALL_DOCS.findIndex((d) => d.slug === key);
  if (!Content || index < 0) notFound();
  const doc = ALL_DOCS[index]!;
  const prev = ALL_DOCS[index - 1];
  const next = ALL_DOCS[index + 1];
  const href = (s: string) => (s ? `/docs/${s}` : "/docs");

  return (
    <article className="max-w-3xl">
      <p className="eyebrow">Documentation</p>
      <h1 className="mt-3 text-[34px] font-semibold tracking-[-0.03em]">{doc.title}</h1>
      <p className="mt-3 text-[17px] leading-relaxed text-muted">{doc.description}</p>
      <div className="prose-sgk mt-8 border-t border-line pt-6">
        <Content />
      </div>
      <nav className="mt-14 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
        {prev ? (
          <Link href={href(prev.slug)} className="rounded-lg border border-line px-4 py-3 hover:border-line-strong">
            <span className="text-[12px] text-muted">Previous</span>
            <span className="block text-[14px] font-medium text-fg">{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={href(next.slug)} className="rounded-lg border border-line px-4 py-3 text-right hover:border-line-strong">
            <span className="text-[12px] text-muted">Next</span>
            <span className="block text-[14px] font-medium text-fg">{next.title}</span>
          </Link>
        )}
      </nav>
    </article>
  );
}
