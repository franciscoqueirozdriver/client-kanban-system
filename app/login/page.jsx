import LoginClient from "./LoginClient";
export const dynamic = "force-dynamic";

export default function Page({ searchParams }) {
  const error = (searchParams?.error ?? "").toString();
  const next  = (searchParams?.callbackUrl ?? searchParams?.next ?? "").toString();
  return <LoginClient error={error} next={next} />;
}
