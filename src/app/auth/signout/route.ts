import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // Check if a user's logged in
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    await supabase.auth.signOut();
  }

  // Revalidate the root path to clear any cached data
  revalidatePath('/', 'layout');

  // Redirect to the login page
  return NextResponse.redirect(new URL('/login', req.url), {
    status: 302,
  });
}
