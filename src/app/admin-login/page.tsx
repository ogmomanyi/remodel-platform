import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from '@/lib/admin-auth';

function safeNextPath(value: string | undefined) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/admin-dashboard';
}

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string; message?: string }> }) {
  const params = await searchParams;

  async function signIn(formData: FormData) {
    'use server';

    const password = String(formData.get('password') || '');
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      redirect('/admin-login?message=Admin authentication is not configured');
    }

    if (password !== adminPassword) {
      redirect('/admin-login?message=Invalid password');
    }

    const cookieStore = await cookies();
    const session = createAdminSessionToken();

    cookieStore.set(ADMIN_SESSION_COOKIE, session.value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: session.maxAge,
      path: '/',
    });

    // Remove the old forgeable cookie during migration.
    cookieStore.delete('admin_auth');

    redirect(safeNextPath(params.next));
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="text-slate-400 hover:text-white inline-block mb-4">← Back to Home</Link>
          <h1 className="text-2xl font-bold text-white">Kota Designs Admin</h1>
          <p className="text-slate-400 text-sm mt-2">Secure team dashboard access</p>
        </div>

        <form action={signIn} className="bg-slate-800 p-8 rounded-lg shadow-md border border-slate-700">
          {params.message && <p className="mb-4 text-sm text-red-300" role="alert">{params.message}</p>}
          <label className="block text-sm font-medium text-slate-200 mb-2" htmlFor="admin-password">Admin password</label>
          <input
            id="admin-password"
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2 mb-4 placeholder-slate-400"
            placeholder="Enter admin password"
          />
          <button type="submit" className="w-full bg-white text-slate-900 font-semibold p-2 rounded hover:bg-slate-100 transition">
            Access Admin Dashboard
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/client-login" className="text-sm text-slate-400 hover:text-white">Client login →</Link>
        </div>
      </div>
    </main>
  );
}
