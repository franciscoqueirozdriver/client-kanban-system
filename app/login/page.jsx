import LoginClient from "./LoginClient.jsx";

export const dynamic = "force-dynamic";

export default function LoginPage({ searchParams }) {
  // Using the new spec's variable names and structure
  const error = (searchParams?.error ?? "").toString();
  const callbackUrl = (searchParams?.callbackUrl ?? "").toString(); // NextAuth uses callbackUrl by default

  return <LoginClient error={error} callbackUrl={callbackUrl} />;
}
