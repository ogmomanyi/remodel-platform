"use server";

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function approveProposal(projectCode: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be logged in to approve a proposal.");
  }

  const { error } = await supabase
    .from('project_approvals')
    .upsert({
      project_code: projectCode,
      status: 'approved',
      approved_by: user.email,
      approved_at: new Date().toISOString()
    });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/', 'layout');
}
