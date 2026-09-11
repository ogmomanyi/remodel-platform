import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ message?: string; error?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const supabase = createAdminClient();
  const { data: clients, error } = await supabase.from('project_members').select('email, role, project_id, projects:project_id(project_code, slug, client_name)').order('email');
  if (error) throw new Error(`Could not load clients: ${error.message}`);

  async function createClientAccount(formData: FormData) {
    'use server';
    await requireAdmin();
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const password = String(formData.get('password') || '');
    const clientName = String(formData.get('client_name') || '').trim();
    const projectId = String(formData.get('project_id') || '').trim();

    if (!email || !password || !projectId) redirect('/admin-dashboard/clients?error=Email%2C%20password%20and%20project%20are%20required');
    if (password.length < 8) redirect('/admin-dashboard/clients?error=Password%20must%20be%20at%20least%208%20characters');

    const admin = createAdminClient();
    const { data: userData, error: userError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { client_name: clientName || undefined } });
    if (userError && !userError.message.toLowerCase().includes('already been registered')) {
      redirect(`/admin-dashboard/clients?error=${encodeURIComponent(userError.message)}`);
    }

    const resolvedProjectId = projectId;
    const { error: memberError } = await admin.from('project_members').upsert({ project_id: resolvedProjectId, email, role: 'client' }, { onConflict: 'project_id,email' });
    if (memberError) redirect(`/admin-dashboard/clients?error=${encodeURIComponent(`Account created/exists, but project access failed: ${memberError.message}`)}`);

    await admin.from('project_events').insert({ project_id: resolvedProjectId, event_type: 'client_access_granted', actor_email: 'admin', metadata: { email, user_id: userData.user?.id ?? null } });
    redirect(`/admin-dashboard/clients?message=${encodeURIComponent(userError ? 'Client already existed; project access updated.' : 'Client account created and project access granted.')}`);
  }

  const { data: projects, error: projectError } = await supabase.from('projects').select('id, client_name, project_code, slug').order('created_at', { ascending: false });
  if (projectError) throw new Error(`Could not load projects: ${projectError.message}`);

  return <main className="min-h-screen bg-slate-100 p-6 md:p-8"><div className="max-w-6xl mx-auto">
    <div className="flex items-center justify-between mb-7"><div><Link href="/admin-dashboard" className="text-sm text-slate-600 hover:text-black">← Dashboard</Link><h1 className="text-3xl font-bold text-gray-900 mt-2">Client access</h1><p className="text-gray-500 mt-1">Create client logins and grant them access to a project.</p></div><Link href="/admin-dashboard/new-project" className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm">New project</Link></div>
    {(params.error || params.message) && <div className={`mb-6 rounded-lg border px-4 py-3 text-sm ${params.error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>{params.error || params.message}</div>}
    <div className="grid lg:grid-cols-[1fr_1.25fr] gap-6">
      <section className="bg-white rounded-xl border border-gray-200 p-6"><h2 className="text-lg font-semibold">Create / connect client</h2><p className="text-sm text-slate-500 mt-1 mb-5">The password is sent to Supabase over the secure request and is not stored by Kota.</p><form action={createClientAccount} className="space-y-4">
        <Field label="Client name" name="client_name" placeholder="John Smith" />
        <Field label="Email" name="email" type="email" placeholder="john@example.com" required />
        <Field label="Password" name="password" type="password" placeholder="At least 8 characters" required />
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Project <span className="text-red-500">*</span></label><select name="project_id" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="">Select project</option>{(projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.client_name} · {project.project_code}</option>)}</select></div>
        <button type="submit" className="w-full rounded-lg bg-slate-900 text-white px-4 py-2.5 text-sm font-medium">Create client login & grant access</button>
      </form></section>
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden"><div className="px-6 py-5 border-b border-gray-200"><h2 className="text-lg font-semibold">Project access</h2><p className="text-sm text-slate-500 mt-1">Current client-to-project assignments.</p></div>{(clients ?? []).length ? <div className="divide-y divide-gray-200">{clients?.map((client, index) => <div key={`${client.email}-${client.project_id}-${index}`} className="px-6 py-4 flex items-center justify-between gap-4"><div><p className="font-medium text-gray-900 break-all">{client.email}</p><p className="text-sm text-slate-500 mt-1">{Array.isArray(client.projects) ? client.projects.map((p) => `${p.client_name} · ${p.project_code}`).join(', ') : client.projects ? `${(client.projects as { client_name: string; project_code: string }).client_name} · ${(client.projects as { client_name: string; project_code: string }).project_code}` : 'Project'}</p></div><span className="text-xs rounded-full bg-slate-100 px-3 py-1 uppercase">{client.role}</span></div>)}</div> : <div className="p-10 text-center text-sm text-slate-500">No client access records yet.</div>}</section>
    </div>
  </div></main>;
}

function Field({ label, name, placeholder, required, type = 'text' }: { label: string; name: string; placeholder?: string; required?: boolean; type?: string }) { return <div><label className="block text-sm font-medium text-gray-700 mb-1">{label}{required && <span className="text-red-500"> *</span>}</label><input name={name} type={type} required={required} placeholder={placeholder} autoComplete={type === 'password' ? 'new-password' : type === 'email' ? 'email' : 'name'} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>; }
