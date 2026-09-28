import Link from "next/link";
import { SagolikMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <SagolikMark className="h-8 text-brand" />
      <h1 className="mt-6 text-[24px] font-semibold tracking-[-0.02em]">This page does not exist.</h1>
      <p className="mt-2 max-w-sm text-[14px] text-muted">The address may be mistyped, or the record may belong to another organization or environment.</p>
      <div className="mt-6 flex gap-4 text-[14px]">
        <Link href="/" className="text-link hover:underline">
          Home
        </Link>
        <Link href="/console" className="text-link hover:underline">
          Console
        </Link>
        <Link href="/docs" className="text-link hover:underline">
          Documentation
        </Link>
      </div>
    </div>
  );
}
