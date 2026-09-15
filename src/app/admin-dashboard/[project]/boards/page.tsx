import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  attachPresentationBoardAsset,
  detachPresentationBoardAsset,
  publishPresentationBoard,
  unpublishPresentationBoard,
} from '@/app/admin-dashboard/presentation-board-actions';

type Board = {
  id: string;
  board_code: string;
  title: string;
  subtitle: string | null;
  board_type: string;
  page_number: number | null;
  template_key: string | null;
  eyebrow: string | null;
  narrative: string | null;
  key_features: string[];
  layout_spec: Record<string, unknown>;
  data_bindings: Record<string, unknown>;
  status: string;
  client_visible: boolean;
  sort_order: number;
  project_space_id: string | null;
};

type Asset = {
  id: string;
  kind: string;
  alt_text: string | null;
  storage_path: string;
  space_id: string | null;
  signed_url?: string | null;
};

type BoardAssignment = {
  id: string;
  board_id: string;
  asset_id: string;
  role: string;
  caption: string | null;
  sort_order: number;
};

function roleCounts(roles: string[]) {
  const map = new Map<string, number>();
  for (const role of roles) map.set(role, (map.get(role) || 0) + 1);
  return map;
}

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function VisualCataloguePage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  await requireAdmin();
  const { project: slug } = await params;
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from('projects')
    .select('id, slug, project_code, client_name')
    .eq('slug', slug)
    .maybeSingle();

  if (!project) notFound();

  const [
    { data: rawBoards, error: boardsError },
    { data: assignments, error: assignmentsError },
    { data: rawAssets, error: assetsError },
    { data: visuals, error: visualsError },
    { data: spaces, error: spacesError },
  ] = await Promise.all([
    supabase
      .from('presentation_boards')
      .select('id, board_code, title, subtitle, board_type, page_number, template_key, eyebrow, narrative, key_features, layout_spec, data_bindings, status, client_visible, sort_order, project_space_id')
      .eq('project_id', project.id)
      .order('sort_order'),
    supabase
      .from('presentation_board_assets')
      .select('id, board_id, asset_id, role, caption, sort_order')
      .in(
        'board_id',
        (
          await supabase
            .from('presentation_boards')
            .select('id')
            .eq('project_id', project.id)
        ).data?.map((board) => board.id) ?? [],
      )
      .order('sort_order'),
    supabase
      .from('project_assets')
      .select('id, kind, alt_text, storage_path, space_id')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('visualisations')
      .select('id, project_space_id, output_asset_id, status, fidelity_mode, brief_version, source_asset_id, is_selected')
      .eq('project_id', project.id)
      .eq('status', 'ready'),
    supabase
      .from('project_spaces')
      .select('id, name')
      .eq('project_id', project.id)
      .order('sort_order'),
  ]);

  if (boardsError) throw new Error('Could not load catalogue boards: ' + boardsError.message);
  if (assignmentsError) throw new Error('Could not load board assets: ' + assignmentsError.message);
  if (assetsError) throw new Error('Could not load project assets: ' + assetsError.message);
  if (visualsError) throw new Error('Could not load visualisation status: ' + visualsError.message);
  if (spacesError) throw new Error('Could not load project spaces: ' + spacesError.message);

  const boards: Board[] = (rawBoards ?? []).map((board) => ({
    ...board,
    key_features: Array.isArray(board.key_features) ? board.key_features.filter((item): item is string => typeof item === 'string') : [],
    layout_spec: board.layout_spec && typeof board.layout_spec === 'object' ? board.layout_spec as Record<string, unknown> : {},
    data_bindings: board.data_bindings && typeof board.data_bindings === 'object' ? board.data_bindings as Record<string, unknown> : {},
  }));

  const signedAssets: Asset[] = await Promise.all(
    (rawAssets ?? []).map(async (asset) => {
      const { data } = await supabase.storage.from('project-assets').createSignedUrl(asset.storage_path, 60 * 60);
      return { ...asset, signed_url: data?.signedUrl ?? null };
    }),
  );

  const visualByAsset = new Map(
    (visuals ?? [])
      .filter((visual) => visual.output_asset_id)
      .map((visual) => [visual.output_asset_id as string, visual]),
  );

  const clientSafeRenderIds = new Set(
    (visuals ?? [])
      .filter((visual) =>
        visual.output_asset_id &&
        visual.status === 'ready' &&
        visual.fidelity_mode === 'site_accurate' &&
        Boolean(visual.source_asset_id) &&
        Number(visual.brief_version || 0) >= 3,
      )
      .map((visual) => visual.output_asset_id as string),
  );

  const spaceName = new Map((spaces ?? []).map((space) => [space.id, space.name]));
  const assignmentsByBoard = new Map<string, BoardAssignment[]>();
  for (const assignment of (assignments ?? []) as BoardAssignment[]) {
    const current = assignmentsByBoard.get(assignment.board_id) ?? [];
    current.push(assignment);
    assignmentsByBoard.set(assignment.board_id, current);
  }

  const availableAssets = signedAssets.filter((asset) => {
    if (asset.kind !== 'render') return true;
    return clientSafeRenderIds.has(asset.id);
  });

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href={`/admin-dashboard/${slug}/edit`} className="text-sm text-stone-500 hover:text-stone-900">← Design Studio</Link>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              {project.project_code} · {project.client_name}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">Visual Catalogue</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              Twelve catalogue pages, sequenced from cover and approved concept through zones, work packages, internal works and commercial summary. Pages stay internal until required content is complete and approved.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin-dashboard/${slug}/visualise`} className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium">Visualisation Studio</Link>
            <Link href={`/${slug}`} target="_blank" className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white">Client view ↗</Link>
          </div>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <Metric label="Boards" value={String(boards.length)} />
          <Metric label="Published" value={String(boards.filter((board) => board.status === 'published').length)} />
          <Metric label="Site-accurate renders" value={String(clientSafeRenderIds.size)} />
          <Metric label="Client-safe assets" value={String(availableAssets.length)} />
        </section>

        <div className="space-y-6">
          {boards.map((board) => {
            const boardAssignments = assignmentsByBoard.get(board.id) ?? [];
            const requiredRoles = Array.isArray(board.layout_spec.required_roles)
              ? board.layout_spec.required_roles.filter((role): role is string => typeof role === 'string')
              : [];
            const required = roleCounts(requiredRoles);
            const actual = roleCounts(boardAssignments.map((assignment) => assignment.role));
            const missing = Array.from(required.entries()).filter(([role, count]) => (actual.get(role) || 0) < count);
            const isComplete = missing.length === 0;

            return (
              <article key={board.id} className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
                <div className="grid lg:grid-cols-[260px_1fr]">
                  <div className="border-b border-stone-100 bg-stone-900 p-6 text-white lg:border-b-0 lg:border-r">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-xs text-stone-400">{board.board_code}</p>
                      {board.page_number && <span className="text-xs font-semibold text-stone-500">Page {String(board.page_number).padStart(2, '0')}</span>}
                    </div>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">{board.eyebrow || titleCase(board.board_type)}</p>
                    <h2 className="mt-2 text-xl font-semibold">{board.title}</h2>
                    {board.subtitle && <p className="mt-2 text-sm leading-6 text-stone-300">{board.subtitle}</p>}

                    <div className="mt-6">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Status</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${board.status === 'published' ? 'bg-emerald-400/20 text-emerald-200' : isComplete ? 'bg-blue-400/20 text-blue-200' : 'bg-amber-400/20 text-amber-200'}`}>
                          {board.status === 'published' ? 'Published' : isComplete ? 'Ready to review' : 'Draft'}
                        </span>
                        {board.project_space_id && (
                          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-stone-300">{spaceName.get(board.project_space_id)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 md:p-7">
                    {board.narrative && <p className="max-w-4xl text-sm leading-6 text-stone-600">{board.narrative}</p>}

                    <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm font-semibold text-stone-900">Required visual slots</h3>
                          <span className="text-xs text-stone-400">{boardAssignments.length} assigned</span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {Array.from(required.entries()).map(([role, count]) => {
                            const have = actual.get(role) || 0;
                            const ok = have >= count;
                            return (
                              <span key={role} className={`rounded-full px-3 py-1.5 text-xs font-medium ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                {titleCase(role)} {have}/{count}
                              </span>
                            );
                          })}
                        </div>

                        {boardAssignments.length > 0 ? (
                          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {boardAssignments.map((assignment) => {
                              const asset = signedAssets.find((item) => item.id === assignment.asset_id);
                              const visual = asset?.kind === 'render' ? visualByAsset.get(asset.id) : null;

                              return (
                                <div key={assignment.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
                                  <div className="aspect-[4/3] bg-stone-100">
                                    {asset?.signed_url ? (
                                      <img src={asset.signed_url} alt={asset.alt_text || assignment.role} className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex h-full items-center justify-center text-xs text-stone-400">Preview unavailable</div>
                                    )}
                                  </div>
                                  <div className="p-3">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{titleCase(assignment.role)}</p>
                                        <p className="mt-1 text-xs text-stone-600">{assignment.caption || asset?.alt_text || 'Assigned asset'}</p>
                                        {visual && (
                                          <p className={`mt-2 text-[10px] font-semibold ${clientSafeRenderIds.has(asset!.id) ? 'text-emerald-700' : 'text-amber-700'}`}>
                                            {clientSafeRenderIds.has(asset!.id) ? 'SITE-ACCURATE' : 'NOT CLIENT-SAFE'}
                                          </p>
                                        )}
                                      </div>
                                      <form
                                        action={async () => {
                                          'use server';
                                          await detachPresentationBoardAsset({ boardAssetId: assignment.id });
                                        }}
                                      >
                                        <button className="text-[11px] text-stone-400 hover:text-red-600">Remove</button>
                                      </form>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="mt-5 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-500">
                            No images assigned yet. Generate site-accurate renders in Visualisation Studio, then attach them here.
                          </div>
                        )}

                        {availableAssets.length > 0 && (
                          <form
                            action={async (formData) => {
                              'use server';
                              await attachPresentationBoardAsset({
                                boardId: board.id,
                                assetId: String(formData.get('assetId') || ''),
                                role: String(formData.get('role') || ''),
                                caption: String(formData.get('caption') || ''),
                              });
                            }}
                            className="mt-5 grid gap-2 rounded-2xl border border-stone-200 bg-stone-50 p-4 md:grid-cols-[160px_1fr_1fr_auto]"
                          >
                            <select name="role" className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs">
                              {Array.from(new Set(requiredRoles)).map((role) => <option key={role} value={role}>{titleCase(role)}</option>)}
                            </select>
                            <select name="assetId" className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs">
                              {availableAssets.map((asset) => (
                                <option key={asset.id} value={asset.id}>
                                  {asset.kind} · {asset.alt_text || asset.id.slice(0, 8)}
                                </option>
                              ))}
                            </select>
                            <input name="caption" placeholder="Optional caption" className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs" />
                            <button className="rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white">Attach</button>
                          </form>
                        )}
                      </div>

                      <aside>
                        <h3 className="text-sm font-semibold text-stone-900">Page content</h3>
                        {board.template_key && (
                          <div className="mt-3 rounded-xl border border-stone-200 bg-white px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Template</p>
                            <p className="mt-1 text-xs font-medium text-stone-700">{board.template_key}</p>
                          </div>
                        )}
                        {Object.keys(board.data_bindings).length > 0 && (
                          <div className="mt-3 rounded-xl border border-stone-200 bg-white px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Live data bindings</p>
                            <p className="mt-1 break-words font-mono text-[10px] leading-4 text-stone-500">{JSON.stringify(board.data_bindings)}</p>
                          </div>
                        )}
                        <ul className="mt-3 space-y-2">
                          {board.key_features.map((feature) => (
                            <li key={feature} className="flex gap-2 text-xs leading-5 text-stone-600">
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-900" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>

                        <div className="mt-6 rounded-2xl bg-stone-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">Publication</p>
                          {board.status === 'published' ? (
                            <form
                              action={async () => {
                                'use server';
                                await unpublishPresentationBoard({ boardId: board.id });
                              }}
                            >
                              <button className="mt-3 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700">Unpublish</button>
                            </form>
                          ) : (
                            <form
                              action={async () => {
                                'use server';
                                await publishPresentationBoard({ boardId: board.id });
                              }}
                            >
                              <button disabled={!isComplete} className="mt-3 w-full rounded-xl bg-stone-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-30">
                                {isComplete ? 'Publish to client' : 'Complete required slots first'}
                              </button>
                            </form>
                          )}
                        </div>
                      </aside>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <p className="text-xs uppercase tracking-wider text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-stone-900">{value}</p>
    </div>
  );
}
