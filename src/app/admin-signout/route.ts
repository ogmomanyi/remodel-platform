import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  cookieStore.delete('admin_auth');
  revalidatePath('/', 'layout');

  return NextResponse.redirect(new URL('/', req.url), { status: 303 });
}
