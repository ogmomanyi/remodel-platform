import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  
  // Clear admin auth cookie
  cookieStore.delete('admin_auth');
  
  // Revalidate the root path to clear any cached data
  revalidatePath('/', 'layout');
  
  // Redirect to the home page
  return NextResponse.redirect(new URL('/', req.url), {
    status: 302,
  });
}
