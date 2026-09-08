import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import fs from 'fs';
import path from 'path';

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function parseEmails(value: string) {
  return value.split(/[\n,;]/).map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export default async function NewProjectPage() {
  await requireAdmin();

  async function createProject(formData: FormData) {
    'use server';
    await requireAdmin();

    const clientName = String(formData.get('client_name') || '').trim();
    const projectCode = String(formData.get('project_code') || '').trim().toUpperCase();
    const emails = parseEmails(String(formData.get('allowed_emails') || ''));
    const projectSlug = slugify(String(formData.get('slug') || clientName));
    const description = String(formData.get('description') || '').trim();

    if (!clientName || !projectCode || !projectSlug) {
      redirect('/admin-dashboard/new-project?error=Please complete the required fields');
    }

    const projectsDir = path.join(process.cwd(), 'src/content/projects');
    const projectDir = path.join(projectsDir, projectSlug);
    if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir, { recursive: true });
    if (fs.existsSync(projectDir)) redirect('/admin-dashboard/new-project?error=Project slug already exists');

    fs.mkdirSync(projectDir, { recursive: true });
    const proposal = `---\nclient_name: ${JSON.stringify(clientName)}\nproject_code: ${JSON.stringify(projectCode)}\nstatus: "draft"\nallowed_emails: ${JSON.stringify(emails)}\nmaterials_required: []\ncarpentry_labor_hours: 0\n---\n\n# ${clientName}\n\n## Project vision\n\n${description || 'Add the project vision and design brief in the Design Studio.'}\n\n## Design direction\n\nAdd design options, materials and visualisations from the Design Studio.\n`;
    fs.writeFileSync(path.join(projectDir, 'proposal.mdx'), proposal, 'utf8');
    revalidatePath('/admin-dashboard');
    redirect(`/admin-dashboard/${projectSlug}/edit`);
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/admin-dashboard" className="text-sm text-slate-600 hover:text-black">← Back to dashboard</Link>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-7 mt-4">
          <h1 className="text-2xl font-bold text-gray-900">Create a project</h1>
          <p className="text-gray-500 mt-1 mb-7">Set up the client and project brief. You can build the spaces, visuals and presentation next.</p>
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
