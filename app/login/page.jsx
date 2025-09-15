import LoginClient from './LoginClient';

export const dynamic = 'force-dynamic';

export default function Page({ searchParams }) {
  // Pass error codes and callback url to the client component
  const error = searchParams?.error;
  const callbackUrl = searchParams?.callbackUrl;

  return <LoginClient error={error} callbackUrl={callbackUrl} />;
}
