import LoginClient from './LoginClient';

export const dynamic = 'force-dynamic';

export default function Page({ searchParams }) {
  const error = (searchParams?.error ?? '').toString();
  // The user's spec uses 'next', but NextAuth's default is 'callbackUrl'.
  // I will check for both to be safe and robust.
  const next = (searchParams?.next ?? searchParams?.callbackUrl ?? '').toString();

  return <LoginClient error={error} next={next} />;
}
