import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function parseEmails(value: string) {
  return value.split(/[\n,;]/).map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const params = await searchParams;

  async function createProject(formData: FormData) {
    'use server';
    await requireAdmin();
    const clientName = String(formData.get('client_name') || '').trim();
    const projectCode = String(formData.get('project_code') || '').trim().toUpperCase();
    const emails = parseEmails(String(formData.get('allowed_emails') || ''));
    const projectSlug = slugify(String(formData.get('slug') || clientName));
    const description = String(formData.get('description') || '').trim();

    if (!clientName || !projectCode || !projectSlug) redirect('/admin-dashboard/new-project?error=Please complete the required fields');

    const supabase = createAdminClient();
    const { data: project, error } = await supabase.from('projects').insert({
      project_code: projectCode,
      slug: projectSlug,
      client_name: clientName,
      description,
      status: 'draft',
    }).select('id, slug').single();

    if (error || !project) {
      const message = error?.code === '23505' ? 'Project code or slug already exists' : 'Could not create project. Run the Design Studio migration and configure SUPABASE_SERVICE_ROLE_KEY.';
      redirect(`/admin-dashboard/new-project?error=${encodeURIComponent(message)}`);
    }

    if (emails.length) {
      const { error: memberError } = await supabase.from('project_members').insert(emails.map((email) => ({ project_id: project.id, email, role: 'client' })));
      if (memberError) redirect(`/admin-dashboard/new-project?error=${encodeURIComponent('Project created, but client access could not be saved')}`);
    }

    await supabase.from('project_events').insert({ project_id: project.id, event_type: 'project_created', metadata: { source: 'admin_dashboard' } });
    revalidatePath('/admin-dashboard');
    redirect(`/admin-dashboard/${project.slug}/edit`);
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/admin-dashboard" className="text-sm text-slate-600 hover:text-black">← Back to dashboard</Link>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-7 mt-4">
          <h1 className="text-2xl font-bold text-gray-900">Create a project</h1>
          <p className="text-gray-500 mt-1 mb-7">Start the project record, then build spaces, concepts, visuals and the client presentation.</p>
          {params.error && <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{params.error}</div>}
          <form action={createProject} className="space-y-5">
            <Field label="Client / project name" name="client_name" required placeholder="e.g. Karen Residence Renovation" />
            <Field label="Project code" name="project_code" required placeholder="e.g. PRJ-2026-005" />
            <Field label="Project URL slug" name="slug" placeholder="Leave blank to generate from project name" />
            <Field label="Client email(s)" name="allowed_emails" placeholder="client@example.com, partner@example.com" />
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Initial brief</label><textarea name="description" rows={5} className="w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="What is being renovated? What does the client want to achieve?" /></div>
            <div className="flex justify-end gap-3 pt-3"><Link href="/admin-dashboard" className="px-4 py-2 rounded-lg border border-gray-300">Cancel</Link><button type="submit" className="px-5 py-2 rounded-lg bg-black text-white font-medium">Create project & open Studio</button></div>
          </form>
        </div>
      </div>
    </main>
  );
}

function Field({ label, name, required, placeholder }: { label: string; name: string; required?: boolean; placeholder?: string }) {
  return <div><label className="block text-sm font-medium text-gray-700 mb-1">{label}{required && <span className="text-red-500"> *</span>}</label><input name={name} required={required} placeholder={placeholder} className="w-full rounded-lg border border-gray-300 px-3 py-2" /></div>;
}
