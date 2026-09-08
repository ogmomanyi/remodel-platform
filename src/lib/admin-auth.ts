import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return cookieStore.get('admin_auth')?.value === 'true';
}

export async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    redirect('/admin-login');
  }
}
