'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';

const CLIENT_RENDER_ROLES = new Set(['hero', 'support', 'detail', 'after']);

export async function attachPresentationBoardAsset(input: {
  boardId: string;
  assetId: string;
  role: string;
  caption?: string;
}) {
  await requireAdmin();
  const supabase = createAdminClient();

  const [{ data: board, error: boardError }, { data: asset, error: assetError }] = await Promise.all([
    supabase
      .from('presentation_boards')
      .select('id, project_id')
      .eq('id', input.boardId)
      .maybeSingle(),
    supabase
      .from('project_assets')
      .select('id, project_id, kind')
      .eq('id', input.assetId)
      .maybeSingle(),
  ]);

  if (boardError || !board) throw new Error('Board not found.');
  if (assetError || !asset) throw new Error('Asset not found.');
  if (board.project_id !== asset.project_id) throw new Error('Asset belongs to a different project.');

  const { error } = await supabase
    .from('presentation_board_assets')
    .insert({
      board_id: board.id,
      asset_id: asset.id,
      role: input.role,
      caption: input.caption?.trim() || null,
      sort_order: 0,
    });

  if (error) throw new Error('Could not attach asset: ' + error.message);

  const { data: project } = await supabase
    .from('projects')
    .select('slug')
    .eq('id', board.project_id)
    .maybeSingle();

  if (project?.slug) revalidatePath('/admin-dashboard/' + project.slug + '/boards');
}

export async function detachPresentationBoardAsset(input: { boardAssetId: string }) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: row } = await supabase
    .from('presentation_board_assets')
    .select('id, board_id')
    .eq('id', input.boardAssetId)
    .maybeSingle();

  if (!row) throw new Error('Board asset not found.');

  const { data: board } = await supabase
    .from('presentation_boards')
    .select('project_id')
    .eq('id', row.board_id)
    .maybeSingle();

  const { error } = await supabase
    .from('presentation_board_assets')
    .delete()
    .eq('id', row.id);

  if (error) throw new Error('Could not remove board asset: ' + error.message);

  if (board?.project_id) {
    const { data: project } = await supabase
      .from('projects')
      .select('slug')
      .eq('id', board.project_id)
      .maybeSingle();
    if (project?.slug) revalidatePath('/admin-dashboard/' + project.slug + '/boards');
  }
}

export async function publishPresentationBoard(input: { boardId: string }) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: board, error: boardError } = await supabase
    .from('presentation_boards')
    .select('id, project_id, layout_spec')
    .eq('id', input.boardId)
    .maybeSingle();

  if (boardError || !board) throw new Error('Board not found.');

  const { data: assignments, error: assignmentError } = await supabase
    .from('presentation_board_assets')
    .select('id, asset_id, role')
    .eq('board_id', board.id);

  if (assignmentError) throw new Error('Could not inspect board assets.');

  const requiredRoles = Array.isArray((board.layout_spec as Record<string, unknown> | null)?.required_roles)
    ? ((board.layout_spec as Record<string, unknown>).required_roles as string[])
    : [];

  const requiredCounts = new Map<string, number>();
  const actualCounts = new Map<string, number>();
  for (const role of requiredRoles) requiredCounts.set(role, (requiredCounts.get(role) || 0) + 1);
  for (const row of assignments ?? []) actualCounts.set(row.role, (actualCounts.get(row.role) || 0) + 1);

  const missing = Array.from(requiredCounts.entries())
    .filter(([role, count]) => (actualCounts.get(role) || 0) < count)
    .map(([role, count]) => role + ' ×' + count);

  if (missing.length) {
    throw new Error('Board is not complete. Missing: ' + missing.join(', '));
  }

  const assetIds = (assignments ?? []).map((row) => row.asset_id);
  if (assetIds.length) {
    const { data: assets } = await supabase
      .from('project_assets')
      .select('id, kind')
      .in('id', assetIds);

    const renderIds = (assets ?? []).filter((asset) => asset.kind === 'render').map((asset) => asset.id);

    if (renderIds.length) {
      const { data: visuals } = await supabase
        .from('visualisations')
        .select('output_asset_id, status, fidelity_mode, brief_version, source_asset_id')
        .in('output_asset_id', renderIds);

      const validRenderIds = new Set(
        (visuals ?? [])
          .filter((visual) =>
            visual.status === 'ready' &&
            visual.fidelity_mode === 'site_accurate' &&
            Boolean(visual.source_asset_id) &&
            Number(visual.brief_version || 0) >= 3,
          )
          .map((visual) => visual.output_asset_id),
      );

      const unsafe = (assignments ?? []).filter((row) => {
        if (!CLIENT_RENDER_ROLES.has(row.role)) return false;
        return renderIds.includes(row.asset_id) && !validRenderIds.has(row.asset_id);
      });

      if (unsafe.length) {
        throw new Error('This board contains concept/legacy renders. Replace them with site-accurate brief-v3 renders before publishing.');
      }
    }
  }

  const { error } = await supabase
    .from('presentation_boards')
    .update({
      status: 'published',
      client_visible: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', board.id);

  if (error) throw new Error('Could not publish board: ' + error.message);

  const { data: project } = await supabase
    .from('projects')
    .select('slug')
    .eq('id', board.project_id)
    .maybeSingle();

  if (project?.slug) {
    revalidatePath('/admin-dashboard/' + project.slug + '/boards');
    revalidatePath('/' + project.slug);
  }
}

export async function unpublishPresentationBoard(input: { boardId: string }) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: board } = await supabase
    .from('presentation_boards')
    .select('id, project_id')
    .eq('id', input.boardId)
    .maybeSingle();

  if (!board) throw new Error('Board not found.');

  const { error } = await supabase
    .from('presentation_boards')
    .update({
      status: 'draft',
      client_visible: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', board.id);

  if (error) throw new Error('Could not unpublish board: ' + error.message);

  const { data: project } = await supabase
    .from('projects')
    .select('slug')
    .eq('id', board.project_id)
    .maybeSingle();

  if (project?.slug) {
    revalidatePath('/admin-dashboard/' + project.slug + '/boards');
    revalidatePath('/' + project.slug);
  }
}
