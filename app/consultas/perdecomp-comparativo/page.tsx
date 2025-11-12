import ClientPerdecompComparativo from './ClientPerdecompComparativo';

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default function Page({ searchParams }: PageProps) {
  const raw = searchParams?.q;
  const q = Array.isArray(raw) ? raw[0] ?? '' : (raw ?? '');

  return <ClientPerdecompComparativo initialQ={q} />;
}
