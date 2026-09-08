import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default function ClientLoginPage({ searchParams }: { searchParams: { next?: string } }) {
  async function signIn(formData: FormData) {
    "use server";
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return redirect('/client-login?message=Could not authenticate user');
    }

    // Redirect to the intended project URL, or client dashboard
    return redirect(searchParams.next || '/client-dashboard');
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="text-slate-600 hover:text-slate-900 inline-block mb-4">
            ← Back to Home
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Client Login</h1>
          <p className="text-gray-600 text-sm mt-2">Sign in to view your design proposals</p>
        </div>
        
        <form action={signIn} className="bg-white p-8 rounded-lg shadow-md">
          <input
            type="email"
            name="email"
            required
            className="w-full border border-gray-300 rounded p-2 mb-4"
            placeholder="Email address"
          />
          
          <input
            type="password"
            name="password"
            required
            className="w-full border border-gray-300 rounded p-2 mb-6"
            placeholder="Password"
          />
          
          <button
            type="submit"
            className="w-full bg-black text-white font-semibold p-2 rounded hover:bg-gray-800 transition"
          >
            Sign In as Client
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/admin-login" className="text-sm text-slate-600 hover:text-slate-900">
            Admin login →
          </Link>
        </div>
      </div>
    </main>
  );
}
