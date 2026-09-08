import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function ClientLoginPage({ searchParams }: { searchParams: Promise<{ next?: string; message?: string }> }) {
  const params = await searchParams;

  async function signIn(formData: FormData) {
    'use server';
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      redirect(`/client-login?message=${encodeURIComponent('Could not authenticate user')}`);
    }

    const next = params.next && params.next.startsWith('/') && !params.next.startsWith('//')
      ? params.next
      : '/client-dashboard';
    redirect(next);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="text-slate-600 hover:text-slate-900 inline-block mb-4">← Back to Home</Link>
          <h1 className="text-2xl font-bold text-gray-800">Client Login</h1>
          <p className="text-gray-600 text-sm mt-2">Sign in to view your design proposals</p>
        </div>
        <form action={signIn} className="bg-white p-8 rounded-lg shadow-md">
          {params.message && <p className="mb-4 text-sm text-red-600" role="alert">{params.message}</p>}
          <input type="email" name="email" required autoComplete="email" className="w-full border border-gray-300 rounded p-2 mb-4" placeholder="Email address" />
          <input type="password" name="password" required autoComplete="current-password" className="w-full border border-gray-300 rounded p-2 mb-6" placeholder="Password" />
          <button type="submit" className="w-full bg-black text-white font-semibold p-2 rounded hover:bg-gray-800 transition">Sign In</button>
        </form>
        <div className="mt-6 text-center"><Link href="/admin-login" className="text-sm text-slate-600 hover:text-slate-900">Admin login →</Link></div>
      </div>
    </main>
  );
}
