import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  async function signIn(formData: FormData) {
    'use server';
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return redirect('/login?message=Could not authenticate user');
    }

    return redirect(searchParams.next || '/');
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <form action={signIn} className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2 text-gray-800">Client Login</h1>
        <p className="text-gray-600 mb-6 text-sm">Sign in to view your design proposals.</p>

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
          Sign In
        </button>
      </form>
    </main>
  );
}
