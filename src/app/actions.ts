"use server";

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function approveProposal(projectCode: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('You must be logged in to approve a proposal.');

  const { data: project } = await supabase.from('projects').select('id, slug, project_code').eq('project_code', projectCode).maybeSingle();
  if (!project) throw new Error('Project not found.');

  const { data: member } = await supabase.from('project_members').select('email').eq('project_id', project.id).ilike('email', user.email).maybeSingle();
  if (!member) throw new Error('You are not authorized to approve this proposal.');

  const { data: proposal } = await supabase.from('proposals').select('id, status').eq('project_id', project.id).in('status', ['sent']).order('version', { ascending: false }).limit(1).maybeSingle();
  if (!proposal) throw new Error('There is no proposal awaiting approval.');

  const now = new Date().toISOString();
  const { error } = await supabase.from('proposals').update({ status: 'approved', approved_at: now, approved_by_email: user.email, updated_at: now }).eq('id', proposal.id).eq('status', 'sent');
  if (error) throw new Error(`Unable to record approval: ${error.message}`);

  await supabase.from('projects').update({ status: 'approved', updated_at: now }).eq('id', project.id);
  await supabase.from('project_events').insert({ project_id: project.id, event_type: 'proposal_approved', metadata: { proposal_id: proposal.id, approved_by: user.email, approved_at: now } });

  revalidatePath(`/${project.slug}`);
  revalidatePath('/client-dashboard');
  revalidatePath('/admin-dashboard');
  revalidatePath(`/admin-dashboard/${project.slug}/proposal`);
  revalidatePath(`/admin-dashboard/${project.slug}/edit`);
}
