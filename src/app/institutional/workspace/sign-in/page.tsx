import type { Metadata } from 'next';
import { PageIntro } from '@/components/record/ui';
import { SignIn } from '@/components/workspace/sign-in';
import '../workspace.css';

export const metadata: Metadata = {
  title: 'Sign in · Evidence workspace',
  description: 'Sign in to a private evidence workspace with a one-time link sent by email.',
  alternates: { canonical: '/institutional/workspace/sign-in' },
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <main id="main" className="shell shell--narrow page ws">
      <PageIntro eyebrow="Institutional · Private workspaces" title="Sign in" lede="Workspaces are private. Access is granted by the operator to named accounts; signing in alone grants no access." />
      <SignIn />
    </main>
  );
}
