"use server";

import { createClient } from '@/utils/supabase/server';
import { getProjectByCode, userCanAccessProject } from '@/lib/projects';
import { revalidatePath } from 'next/cache';

export async function approveProposal(projectCode: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    throw new Error('You must be logged in to approve a proposal.');
  }

  const project = getProjectByCode(projectCode);
  if (!project) {
    throw new Error('Project not found.');
  }

  if (!userCanAccessProject(project, user.email)) {
    throw new Error('You are not authorized to approve this proposal.');
  }

  const { error } = await supabase
    .from('project_approvals')
    .upsert({
      project_code: project.project_code,
      status: 'approved',
      approved_by: user.email,
      approved_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error('Unable to record approval.');
  }

  revalidatePath(`/${project.slug}`);
  revalidatePath('/client-dashboard');
  revalidatePath('/admin-dashboard');
}
