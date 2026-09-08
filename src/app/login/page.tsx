import { redirect } from 'next/navigation';

export default async function LoginRedirect({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = params.next ? `?next=${encodeURIComponent(params.next)}` : '';
  redirect(`/client-login${next}`);
}
