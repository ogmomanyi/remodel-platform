import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string; message?: string }> }) {
  const params = await searchParams;

  async function signIn(formData: FormData) {
    "use server";
    const password = formData.get('password') as string;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return redirect('/admin-login?message=Admin authentication is not configured');
    }

    if (password === adminPassword) {
      const cookieStore = await cookies();
      cookieStore.set('admin_auth', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
      return redirect(params.next || '/admin-dashboard');
    }

    return redirect('/admin-login?message=Invalid password');
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="text-slate-400 hover:text-white inline-block mb-4">
            ← Back to Home
          </Link>
          <h1 className="text-2xl font-bold text-white">Kota Designs Admin</h1>
          <p className="text-slate-400 text-sm mt-2">Team dashboard access</p>
        </div>

        <form action={signIn} className="bg-slate-800 p-8 rounded-lg shadow-md border border-slate-700">
          {params.message && (
            <p className="mb-4 text-sm text-red-300" role="alert">{params.message}</p>
          )}
          <input
            type="password"
            name="password"
            required
            className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2 mb-4 placeholder-slate-400"
            placeholder="Admin password"
          />
          <button
            type="submit"
            className="w-full bg-white text-slate-900 font-semibold p-2 rounded hover:bg-slate-100 transition"
          >
            Access Admin Dashboard
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/client-login" className="text-sm text-slate-400 hover:text-white">
            Client login →
          </Link>
        </div>
      </div>
    </main>
  );
}
