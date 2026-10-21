import type { Metadata } from 'next';
import { PageIntro } from '@/components/record/ui';
import { SignIn } from '@/components/workspace/sign-in';
import '../workspace.css';

export const metadata: Metadata = {
  title: 'Sign in · Evidence workspace',
  description: 'Sign in to a private evidence workspace with Google or with a one-time link sent by email.',
  alternates: { canonical: '/institutional/workspace/sign-in' },
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <main id="main" className="shell shell--narrow page ws">
      <PageIntro eyebrow="Institutional · Accounts" title="Sign in" lede="Sign in with Google, or with an email address and password. Any account with a verified email address can use Deep Analysis with the AI layer. Evidence workspaces stay private: access to a workspace is granted by the operator to named accounts." />
      <SignIn />
    </main>
  );
}
