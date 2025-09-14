import LoginClient from "./LoginClient";
export const dynamic = "force-dynamic";

export default function Page({ searchParams }) {
  const error = (searchParams?.error ?? "").toString();
  // compat: callbackUrl|next
  const next  = (searchParams?.callbackUrl ?? searchParams?.next ?? "").toString();
  return <LoginClient error={error} next={next} />;
}
