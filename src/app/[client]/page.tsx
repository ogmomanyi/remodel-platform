import { redirect } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { MaterialCard } from '@/components/mdx/MaterialCard';
import { ApproveButton } from '@/components/ApproveButton';
import { ClientDesignVision } from '@/components/client/ClientDesignVision';
import { ClientSiteContext } from '@/components/client/ClientSiteContext';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getProjectBySlug, userCanAccessProject } from '@/lib/projects';

const components = { MaterialCard };

type Props = { params: Promise<{ client: string }> };

type Proposal = {
  id: string;
  proposal_number: string;
  title: string;
  status: string;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  valid_until: string | null;
  lines: Array<{
    id: string;
    description: string;
    quantity: number;
    unit: string;
    selling_total: number;
    space_name: string | null;
  }>;
};

type ClientTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  project_space_id: string | null;
};

type ProgressUpdate = {
  id: string;
  title: string;
  notes: string | null;
  update_type: string;
  percent_complete: number;
  project_space_id: string | null;
  created_at: string;
};

type ProgressAsset = {
  id: string;
  space_id: string | null;
  alt_text: string | null;
  created_at: string;
  signed_url: string | null;
};

const TASK_LABELS: Record<string, string> = {
  todo: 'Upcoming',
  in_progress: 'In progress',
  blocked: 'On hold',
  done: 'Completed',
  cancelled: 'Cancelled',
};

const UPDATE_LABELS: Record<string, string> = {
  site_visit: 'Site update',
  milestone: 'Milestone',
  status: 'Progress',
  issue: 'Project note',
  note: 'Update',
};

export default async function ClientPresentation({ params }: Props) {
  const { client } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/client-login?next=/${client}`);

  const { data: dbProject } = await supabase
    .from('projects')
    .select('id, project_code, client_name, description, status')
    .eq('slug', client)
    .maybeSingle();

  const legacyProject = dbProject ? null : getProjectBySlug(client);

  let projectCode = '';
  let clientName = '';
  let content = '';
  let projectStatus = 'pending';
  let proposal: Proposal | null = null;
  let tasks: ClientTask[] = [];
  let updates: ProgressUpdate[] = [];
  let progressAssets: ProgressAsset[] = [];
  let designCards: Array<{
    id: string;
    spaceName: string;
    title: string;
    description: string | null;
    materials: Array<{ name?: string; category?: string; specification?: string }>;
    costEstimate: number | null;
    currency: string;
    beforeImage?: string | null;
    beforeAlt?: string | null;
    afterImage?: string | null;
    afterAlt?: string | null;
  }> = [];
  let spaces = new Map<string, string>();
  let relationalProject = false;

  if (dbProject) {
    relationalProject = true;
    projectCode = dbProject.project_code;
    clientName = dbProject.client_name;
    projectStatus = dbProject.status || 'pending';
    content = dbProject.description || '';

    const [{ data: latest }, { data: dbTasks }, { data: dbUpdates }, { data: dbSpaces }] = await Promise.all([
      supabase
        .from('proposals')
        .select('id, proposal_number, title, status, currency, subtotal, tax_amount, total, notes, valid_until')
        .eq('project_id', dbProject.id)
        .in('status', ['sent', 'approved', 'rejected', 'expired'])
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('project_tasks')
        .select('id, title, description, status, due_date, project_space_id')
        .eq('project_id', dbProject.id)
        .eq('client_visible', true)
        .neq('status', 'cancelled')
        .order('due_date'),
      supabase
        .from('project_progress_updates')
        .select('id, title, notes, update_type, percent_complete, project_space_id, created_at')
        .eq('project_id', dbProject.id)
        .eq('client_visible', true)
        .order('created_at', { ascending: false })
        .limit(12),
      supabase
        .from('project_spaces')
        .select('id, name')
        .eq('project_id', dbProject.id),
    ]);

    spaces = new Map((dbSpaces ?? []).map((space) => [space.id, space.name]));
    tasks = dbTasks ?? [];
    updates = (dbUpdates ?? []).map((update) => ({
      ...update,
      percent_complete: Number(update.percent_complete || 0),
    }));

    if (latest) {
      const { data: lines } = await supabase
        .from('proposal_lines')
        .select('id, description, quantity, unit, selling_total, project_space_id')
        .eq('proposal_id', latest.id)
        .order('sort_order');

      proposal = {
        ...latest,
        subtotal: Number(latest.subtotal),
        tax_amount: Number(latest.tax_amount),
        total: Number(latest.total),
        lines: (lines ?? []).map((line) => ({
          id: line.id,
          description: line.description,
          quantity: Number(line.quantity),
          unit: line.unit,
          selling_total: Number(line.selling_total),
          space_name: line.project_space_id ? spaces.get(line.project_space_id) || null : null,
        })),
      };
    }

    const admin = createAdminClient();
    const [
      { data: progressRows },
      { data: designOptions },
      { data: presentationSpaces },
      { data: presentationAssets },
      { data: selectedVisualisations },
    ] = await Promise.all([
      admin
        .from('project_assets')
        .select('id, space_id, storage_path, alt_text, created_at')
        .eq('project_id', dbProject.id)
        .eq('kind', 'progress')
        .order('created_at', { ascending: false })
        .limit(12),
      admin
        .from('design_options')
        .select('id, space_id, name, description, materials, cost_estimate, currency, is_recommended, sort_order')
        .in('space_id', Array.from(spaces.keys()))
        .order('sort_order'),
      admin
        .from('project_spaces')
        .select('id, name, space_type, sort_order')
        .eq('project_id', dbProject.id)
        .order('sort_order'),
      admin
        .from('project_assets')
        .select('id, space_id, kind, storage_path, alt_text, created_at')
        .eq('project_id', dbProject.id)
        .in('kind', ['site_photo', 'render'])
        .order('created_at'),
      admin
        .from('visualisations')
        .select('id, project_space_id, name, output_asset_id, is_selected, updated_at')
        .eq('project_id', dbProject.id)
        .eq('is_selected', true),
    ]);

    progressAssets = await Promise.all(
      (progressRows ?? []).map(async (asset) => {
        const { data } = await admin.storage.from('project-assets').createSignedUrl(asset.storage_path, 60 * 60);
        return {
          id: asset.id,
          space_id: asset.space_id,
          alt_text: asset.alt_text,
          created_at: asset.created_at,
          signed_url: data?.signedUrl ?? null,
        };
      }),
    );

    const signedPresentationAssets = await Promise.all(
      (presentationAssets ?? []).map(async (asset) => {
        const { data } = await admin.storage.from('project-assets').createSignedUrl(asset.storage_path, 60 * 60);
        return { ...asset, signed_url: data?.signedUrl ?? null };
      }),
    );

    const presentationAssetById = new Map(signedPresentationAssets.map((asset) => [asset.id, asset]));
    const selectedBySpace = new Map(
      (selectedVisualisations ?? [])
        .filter((item) => item.project_space_id && item.output_asset_id)
        .map((item) => [item.project_space_id as string, item]),
    );
    const sitePhotosBySpace = new Map<string, typeof signedPresentationAssets>();
    for (const asset of signedPresentationAssets.filter((item) => item.kind === 'site_photo' && item.space_id)) {
      const current = sitePhotosBySpace.get(asset.space_id as string) ?? [];
      current.push(asset);
      sitePhotosBySpace.set(asset.space_id as string, current);
    }

    const optionsBySpace = new Map<string, typeof designOptions>();
    for (const option of designOptions ?? []) {
      const current = optionsBySpace.get(option.space_id) ?? [];
      current.push(option);
      optionsBySpace.set(option.space_id, current);
    }

    designCards = (presentationSpaces ?? []).flatMap((space) => {
      const options = (optionsBySpace.get(space.id) ?? []).filter((option) => option.is_recommended);
      if (!options.length) return [];

      const before = sitePhotosBySpace.get(space.id)?.[0] ?? null;
      const selected = selectedBySpace.get(space.id);
      const after = selected?.output_asset_id ? presentationAssetById.get(selected.output_asset_id) ?? null : null;

      return options.map((option) => ({
        id: option.id,
        spaceName: space.name,
        title: option.name,
        description: option.description,
        materials: Array.isArray(option.materials) ? option.materials : [],
        costEstimate: option.cost_estimate === null ? null : Number(option.cost_estimate),
        currency: option.currency || 'KES',
        beforeImage: before?.signed_url ?? null,
        beforeAlt: before?.alt_text || `${space.name} existing condition`,
        afterImage: after?.signed_url ?? null,
        afterAlt: after?.alt_text || selected?.name || `${space.name} proposed design`,
      }));
    });
  } else if (legacyProject && userCanAccessProject(legacyProject, user.email)) {
    projectCode = legacyProject.project_code;
    clientName = legacyProject.client_name;
    content = legacyProject.content;
    projectStatus = legacyProject.status || 'pending';
  } else {
    return (
      <div className="min-h-screen bg-stone-50 p-6 flex items-center justify-center">
        <div className="max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center">
          <h2 className="text-xl font-semibold text-stone-900">Project unavailable</h2>
          <p className="mt-2 text-sm text-stone-500">This account does not have access to the requested project.</p>
        </div>
      </div>
    );
  }

  const { data: approvalRecord } = await supabase
    .from('project_approvals')
    .select('status, approved_by, approved_at')
    .eq('project_code', projectCode)
    .maybeSingle();

  const currentStatus = proposal?.status || approvalRecord?.status || projectStatus || 'pending';
  const latestProgress = updates[0]?.percent_complete ?? null;
  const completedTasks = tasks.filter((task) => task.status === 'done').length;
  const money = new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-5 border-b border-stone-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Kota Designs · Client Project</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">{clientName}</h1>
            <p className="mt-2 font-mono text-sm text-stone-500">Ref: {projectCode}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={currentStatus} />
            <span className="text-sm text-stone-500">{user.email}</span>
          </div>
        </header>

        {relationalProject && <ClientSiteContext projectCode={projectCode} />}

        {relationalProject && designCards.length > 0 && (
          <ClientDesignVision cards={designCards} showPricing={false} />
        )}

        {relationalProject && (latestProgress !== null || tasks.length > 0) && (
          <section className="mb-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-stone-200 bg-white p-6 md:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-stone-500">Project progress</p>
                  <p className="mt-2 text-3xl font-semibold text-stone-900">{latestProgress ?? 0}%</p>
                </div>
                <p className="text-sm text-stone-500">{completedTasks} of {tasks.length} visible tasks complete</p>
              </div>
              <div className="mt-5 h-2.5 rounded-full bg-stone-100">
                <div className="h-2.5 rounded-full bg-stone-900" style={{ width: `${Math.max(0, Math.min(100, latestProgress ?? 0))}%` }} />
              </div>
            </div>
            <div className="rounded-3xl border border-stone-200 bg-white p-6">
              <p className="text-xs uppercase tracking-wider text-stone-500">Latest update</p>
              <p className="mt-2 font-semibold text-stone-900">{updates[0]?.title || 'Execution underway'}</p>
              {updates[0] && <p className="mt-2 text-xs text-stone-500">{new Date(updates[0].created_at).toLocaleDateString()}</p>}
            </div>
          </section>
        )}

        {proposal && (
          <section className="mb-8 rounded-3xl border border-stone-200 bg-white p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-stone-500">Quotation {proposal.proposal_number}</p>
                <h2 className="mt-1 text-2xl font-semibold text-stone-900">{proposal.title}</h2>
                {proposal.valid_until && <p className="mt-1 text-sm text-stone-500">Valid until {proposal.valid_until}</p>}
              </div>
              <StatusBadge status={proposal.status} />
            </div>

            <div className="mt-6 divide-y divide-stone-100">
              {proposal.lines.map((line) => (
                <div key={line.id} className="flex justify-between gap-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-stone-900">{line.description}</p>
                    <p className="mt-1 text-xs text-stone-500">{line.space_name || 'Project'} · {line.quantity} {line.unit}</p>
                  </div>
                  <p className="whitespace-nowrap font-semibold">{proposal.currency} {money.format(line.selling_total)}</p>
                </div>
              ))}
            </div>

            <div className="ml-auto mt-6 max-w-sm space-y-2 border-t border-stone-200 pt-5 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{proposal.currency} {money.format(proposal.subtotal)}</span></div>
              <div className="flex justify-between"><span>Tax</span><span>{proposal.currency} {money.format(proposal.tax_amount)}</span></div>
              <div className="flex justify-between pt-2 text-lg font-semibold"><span>Total</span><span>{proposal.currency} {money.format(proposal.total)}</span></div>
            </div>

            {proposal.notes && <p className="mt-6 whitespace-pre-wrap text-sm leading-6 text-stone-600">{proposal.notes}</p>}
            {proposal.status === 'sent' && (
              <div className="mt-6 border-t border-stone-200 pt-6">
                <ApproveButton
                  projectCode={projectCode}
                  initialStatus={currentStatus}
                  approvedBy={approvalRecord?.approved_by ?? null}
                  approvedAt={approvalRecord?.approved_at ?? null}
                />
              </div>
            )}
          </section>
        )}

        {updates.length > 0 && (
          <section className="mb-8 rounded-3xl border border-stone-200 bg-white">
            <div className="border-b border-stone-200 px-6 py-5">
              <h2 className="text-xl font-semibold text-stone-900">Project updates</h2>
              <p className="mt-1 text-sm text-stone-500">Milestones and site updates shared by the Kota team.</p>
            </div>
            <div className="divide-y divide-stone-100">
              {updates.map((update) => (
                <article key={update.id} className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">{UPDATE_LABELS[update.update_type] || 'Update'} · {update.project_space_id ? spaces.get(update.project_space_id) || 'Project' : 'Project'}</p>
                      <h3 className="mt-1 font-semibold text-stone-900">{update.title}</h3>
                    </div>
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-800">{update.percent_complete}%</span>
                  </div>
                  {update.notes && <p className="mt-3 text-sm leading-6 text-stone-600">{update.notes}</p>}
                  <p className="mt-3 text-xs text-stone-400">{new Date(update.created_at).toLocaleString()}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {progressAssets.length > 0 && (
          <section className="mb-8">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-stone-900">Site progress gallery</h2>
              <p className="mt-1 text-sm text-stone-500">Recent visual progress from the project team.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {progressAssets.map((asset) => (
                <figure key={asset.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
                  <div className="aspect-[4/3] bg-stone-100">
                    {asset.signed_url && <img src={asset.signed_url} alt={asset.alt_text || 'Project progress'} className="h-full w-full object-cover" />}
                  </div>
                  <figcaption className="p-4">
                    <p className="text-sm font-medium text-stone-800">{asset.alt_text || 'Site progress'}</p>
                    <p className="mt-1 text-xs text-stone-400">
                      {asset.space_id ? spaces.get(asset.space_id) || 'Project' : 'Project'} · {new Date(asset.created_at).toLocaleDateString()}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {tasks.length > 0 && (
          <section className="mb-8 rounded-3xl border border-stone-200 bg-white p-6">
            <h2 className="text-xl font-semibold text-stone-900">Delivery plan</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {tasks.map((task) => (
                <div key={task.id} className="rounded-2xl bg-stone-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-stone-900">{task.title}</p>
                      <p className="mt-1 text-xs text-stone-500">{task.project_space_id ? spaces.get(task.project_space_id) || 'Project' : 'Project'}{task.due_date ? ` · Target ${task.due_date}` : ''}</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-600">{TASK_LABELS[task.status] || task.status}</span>
                  </div>
                  {task.description && <p className="mt-3 text-sm leading-6 text-stone-600">{task.description}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {content && (
          <article className="prose prose-slate max-w-none rounded-3xl border border-stone-200 bg-white p-6 md:p-8">
            {legacyProject ? <MDXRemote source={content} components={components} /> : <p className="whitespace-pre-wrap">{content}</p>}
          </article>
        )}

        {!proposal && !updates.length && relationalProject && (
          <section className="rounded-3xl border border-stone-200 bg-white p-8 text-center">
            <h2 className="text-lg font-semibold text-stone-900">Project workspace is ready</h2>
            <p className="mt-2 text-sm text-stone-500">Your proposal or progress updates will appear here as the project advances.</p>
          </section>
        )}
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const classes =
    ['approved', 'completed'].includes(normalized)
      ? 'bg-emerald-50 text-emerald-700'
      : normalized === 'in_progress'
        ? 'bg-blue-50 text-blue-700'
        : normalized === 'rejected'
          ? 'bg-red-50 text-red-700'
          : 'bg-amber-50 text-amber-700';

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${classes}`}>
      {status.replaceAll('_', ' ')}
    </span>
  );
}
