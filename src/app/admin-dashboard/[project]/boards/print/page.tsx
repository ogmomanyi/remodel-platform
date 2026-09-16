import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';
import { PrintCatalogueButton } from '@/components/admin/PrintCatalogueButton';
import styles from './print.module.css';

type Asset = { id: string; role: string; caption: string | null; url: string | null; alt: string };
type Board = {
  id: string;
  page_number: number | null;
  board_code: string;
  board_type: string;
  template_key: string | null;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  narrative: string | null;
  key_features: string[];
  content_json: Record<string, unknown>;
  status: string;
  assets: Asset[];
};
type Catalogue = {
  id: string;
  title: string;
  subtitle: string | null;
  brand_name: string | null;
  brand_tagline: string | null;
  quoted_contract_sum: number | null;
  currency: string;
  status: string;
  version: number;
};

function money(value: unknown, currency = 'KES') {
  const amount = typeof value === 'number' ? value : Number(value || 0);
  return currency + ' ' + new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(amount);
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function objects(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    : [];
}

function byRole(board: Board, role: string) {
  return board.assets.find((item) => item.role === role);
}

function AssetView({ item, label, hero = false }: { item?: Asset; label: string; hero?: boolean }) {
  if (!item?.url) {
    return (
      <div className={hero ? styles.placeholder + ' ' + styles.heroPlaceholder : styles.placeholder}>
        {label}<br />Asset required
      </div>
    );
  }
  return <img src={item.url} alt={item.alt} className={hero ? styles.hero : styles.imageSmall} />;
}

function Header({ board }: { board: Board }) {
  return (
    <header className={styles.header}>
      <div className={styles.eyebrow}>{board.eyebrow || board.board_type.replaceAll('_', ' ')}</div>
      <h1 className={styles.title}>{board.title}</h1>
      {board.subtitle && <p className={styles.subtitle}>{board.subtitle}</p>}
    </header>
  );
}

function Footer({ catalogue, projectCode }: { catalogue: Catalogue; projectCode: string }) {
  return (
    <footer className={styles.footer}>
      <span>{catalogue.brand_name || 'Kota Designs'}</span>
      <span>{projectCode}</span>
      <span>{catalogue.subtitle || 'Client Visual Catalogue'}</span>
    </footer>
  );
}

function DraftBadge({ status }: { status: string }) {
  return status === 'published' ? null : <div className={styles.draftBadge}>Draft catalogue</div>;
}

function CoverPage({ board, catalogue }: { board: Board; catalogue: Catalogue }) {
  const c = board.content_json;
  return (
    <>
      <div className={styles.eyebrow}>{catalogue.subtitle || 'Client Visual Catalogue'}</div>
      <h1 className={styles.coverTitle}>{catalogue.title}</h1>
      <p className={styles.subtitle}>{String(c.scope_line || board.subtitle || '')}</p>
      <div className={styles.coverHero}><AssetView item={byRole(board, 'hero')} label="Approved master visual" hero /></div>
      <div className={styles.coverBottom}>
        <div>
          <div className={styles.eyebrow}>Quoted contract sum</div>
          <div className={styles.amount}>{money(c.contract_sum ?? catalogue.quoted_contract_sum, String(c.currency || catalogue.currency))}</div>
        </div>
        <div className={styles.body} style={{ textAlign: 'right' }}>
          <strong>{catalogue.brand_name || 'Kota Designs'}</strong><br />
          {catalogue.brand_tagline || 'Design · Build · Transform'}
        </div>
      </div>
    </>
  );
}

function ApprovedConceptPage({ board }: { board: Board }) {
  return (
    <>
      <Header board={board} />
      <div className={styles.grid2}>
        <div>
          <AssetView item={byRole(board, 'hero')} label="Approved master concept" hero />
          <p className={styles.body} style={{ marginTop: '4mm' }}>{board.narrative}</p>
        </div>
        <div>
          <AssetView item={byRole(board, 'plan')} label="Layout plan / diagram" />
          <div className={styles.card} style={{ marginTop: '5mm' }}>
            <div className={styles.cardTitle}>Design intent</div>
            <ul className={styles.featureList}>{board.key_features.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <p className={styles.body} style={{ marginTop: '5mm', fontSize: 8 }}>
            Design intent visual - not a substitute for site measurement, setting-out or fabrication drawings.
          </p>
        </div>
      </div>
    </>
  );
}

function OverviewPage({ board, catalogue }: { board: Board; catalogue: Catalogue }) {
  const packages = objects(board.content_json.work_packages);
  const sequence = strings(board.content_json.construction_flow);
  return (
    <>
      <Header board={board} />
      <div className={styles.packageGrid}>
        {packages.map((pkg) => (
          <div key={String(pkg.ref)} className={styles.card}>
            <div className={styles.cardTitle}>{String(pkg.ref)} {String(pkg.name)}</div>
            <p className={styles.body}>{String(pkg.summary || '')}</p>
            <p style={{ marginTop: '4mm', fontWeight: 700, fontSize: 10 }}>{money(pkg.amount, catalogue.currency)}</p>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '11mm' }}>
        <div className={styles.eyebrow}>Construction flow</div>
        <div className={styles.sequence} style={{ marginTop: '5mm' }}>
          {sequence.map((item, index) => (
            <div className={styles.sequenceItem} key={item}>
              <div className={styles.sequenceDot}>{index + 1}</div>
              <div>{item}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginTop: '15mm' }}>
        <div>
          <div className={styles.eyebrow}>Preliminaries</div>
          <p className={styles.body}>County permits, tools/equipment, health and safety requirements.</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className={styles.eyebrow}>Total contract sum</div>
          <div className={styles.amount}>{money(board.content_json.contract_sum, catalogue.currency)}</div>
        </div>
      </div>
    </>
  );
}

function ZonePage({ board }: { board: Board }) {
  const support = board.assets.filter((item) => item.role === 'support' || item.role === 'detail');
  return (
    <>
      <Header board={board} />
      <div className={styles.grid2}>
        <div>
          <AssetView item={byRole(board, 'hero')} label="Zone hero visual" hero />
          {support.length > 0 && (
            <div className={styles.grid3} style={{ marginTop: '4mm' }}>
              {support.slice(0, 3).map((item) => (
                <figure key={item.id} style={{ margin: 0 }}>
                  <AssetView item={item} label="Supporting view" />
                  <figcaption className={styles.body} style={{ fontSize: 8, marginTop: '1.5mm' }}>{item.caption || item.alt}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
        <aside>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Design intent</div>
            <p className={styles.body}>{board.narrative}</p>
          </div>
          <div className={styles.card} style={{ marginTop: '5mm' }}>
            <div className={styles.cardTitle}>Key features</div>
            <ul className={styles.featureList}>{board.key_features.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          {byRole(board, 'plan') && <div style={{ marginTop: '5mm' }}><AssetView item={byRole(board, 'plan')} label="Plan inset" /></div>}
        </aside>
      </div>
    </>
  );
}

function WorkPackagePage({ board, catalogue }: { board: Board; catalogue: Catalogue }) {
  const specs = strings(board.content_json.specification);
  const removals = strings(board.content_json.removals);
  const main = byRole(board, 'hero') || byRole(board, 'support') || byRole(board, 'material');
  const detail = byRole(board, 'detail') || board.assets.find((item) => item.id !== main?.id);
  return (
    <>
      <Header board={board} />
      <div className={styles.grid2}>
        <div>
          <AssetView item={main} label="Work-package visual" hero />
          {detail && <div style={{ marginTop: '4mm' }}><AssetView item={detail} label="Detail visual" /></div>}
        </div>
        <div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Specification</div>
            <ul className={styles.featureList}>{specs.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          {removals.length > 0 && (
            <div className={styles.card} style={{ marginTop: '5mm' }}>
              <div className={styles.cardTitle}>Removals</div>
              <ul className={styles.featureList}>{removals.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}
          {board.content_json.finish_direction && (
            <div className={styles.card} style={{ marginTop: '5mm' }}>
              <div className={styles.cardTitle}>Finish direction</div>
              <p className={styles.body}>{String(board.content_json.finish_direction)}</p>
            </div>
          )}
          <div style={{ marginTop: '8mm', textAlign: 'right' }}>
            {board.content_json.headline_quantity && <div className={styles.body}>{String(board.content_json.headline_quantity)}</div>}
            <div className={styles.eyebrow}>Section total</div>
            <div className={styles.amount}>{money(board.content_json.section_total, catalogue.currency)}</div>
          </div>
        </div>
      </div>
    </>
  );
}

function BeforeAfterPage({ board, catalogue }: { board: Board; catalogue: Catalogue }) {
  const scope = strings(board.content_json.scope);
  return (
    <>
      <Header board={board} />
      <div className={styles.grid2}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4mm' }}>
          <div>
            <div className={styles.eyebrow} style={{ marginBottom: '2mm' }}>Before</div>
            <AssetView item={byRole(board, 'before')} label="Existing condition" hero />
          </div>
          <div>
            <div className={styles.eyebrow} style={{ marginBottom: '2mm' }}>After</div>
            <AssetView item={byRole(board, 'after')} label="Proposed condition" hero />
          </div>
        </div>
        <div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Quoted scope</div>
            <ul className={styles.featureList}>{scope.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <p className={styles.body} style={{ marginTop: '5mm' }}>{String(board.content_json.setting_out_note || board.narrative || '')}</p>
          <div style={{ marginTop: '8mm', textAlign: 'right' }}>
            <div className={styles.eyebrow}>Section total</div>
            <div className={styles.amount}>{money(board.content_json.section_total, catalogue.currency)}</div>
          </div>
        </div>
      </div>
    </>
  );
}

function CommercialSummaryPage({ board, catalogue }: { board: Board; catalogue: Catalogue }) {
  const packages = objects(board.content_json.work_packages);
  return (
    <>
      <Header board={board} />
      <table className={styles.summaryTable}>
        <thead><tr><th>Ref</th><th>Work package</th><th>Amount ({catalogue.currency})</th></tr></thead>
        <tbody>
          {packages.map((pkg) => (
            <tr key={String(pkg.ref)}>
              <td>{String(pkg.ref)}</td>
              <td>{String(pkg.name)}</td>
              <td>{new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(Number(pkg.amount || 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12mm', alignItems: 'end', marginTop: '12mm' }}>
        <div style={{ maxWidth: '155mm' }}>
          <div className={styles.eyebrow}>Catalogue note</div>
          <p className={styles.body}>{String(board.content_json.catalogue_note || board.narrative || '')}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className={styles.eyebrow}>Total contract sum</div>
          <div className={styles.amount}>{money(board.content_json.contract_sum, catalogue.currency)}</div>
        </div>
      </div>
    </>
  );
}

function PageContent({ board, catalogue }: { board: Board; catalogue: Catalogue }) {
  switch (board.template_key) {
    case 'cover': return <CoverPage board={board} catalogue={catalogue} />;
    case 'approved-concept': return <ApprovedConceptPage board={board} />;
    case 'project-overview': return <OverviewPage board={board} catalogue={catalogue} />;
    case 'zone-focus':
    case 'detail-board': return <ZonePage board={board} />;
    case 'work-package': return <WorkPackagePage board={board} catalogue={catalogue} />;
    case 'before-after': return <BeforeAfterPage board={board} catalogue={catalogue} />;
    case 'commercial-summary': return <CommercialSummaryPage board={board} catalogue={catalogue} />;
    default: return <><Header board={board} /><p className={styles.body}>{board.narrative}</p></>;
  }
}

export default async function CataloguePrintPage({ params }: { params: Promise<{ project: string }> }) {
  await requireAdmin();
  const { project: slug } = await params;
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from('projects')
    .select('id, slug, project_code')
    .eq('slug', slug)
    .maybeSingle();
  if (!project) notFound();

  const { data: catalogueRow } = await supabase
    .from('presentation_catalogues')
    .select('id, title, subtitle, brand_name, brand_tagline, quoted_contract_sum, currency, status, version')
    .eq('project_id', project.id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!catalogueRow) notFound();

  const { data: rawBoards } = await supabase
    .from('presentation_boards')
    .select('id, page_number, board_code, board_type, template_key, eyebrow, title, subtitle, narrative, key_features, content_json, status')
    .eq('catalogue_id', catalogueRow.id)
    .order('page_number');

  const boardIds = (rawBoards ?? []).map((board) => board.id);
  const { data: assignments } = boardIds.length
    ? await supabase.from('presentation_board_assets').select('id, board_id, asset_id, role, caption, sort_order').in('board_id', boardIds).order('sort_order')
    : { data: [] };

  const assetIds = Array.from(new Set((assignments ?? []).map((item) => item.asset_id)));
  const { data: rawAssets } = assetIds.length
    ? await supabase.from('project_assets').select('id, storage_path, alt_text').in('id', assetIds)
    : { data: [] };

  const signed = await Promise.all((rawAssets ?? []).map(async (item) => {
    const { data } = await supabase.storage.from('project-assets').createSignedUrl(item.storage_path, 60 * 60);
    return { ...item, url: data?.signedUrl ?? null };
  }));
  const assetMap = new Map(signed.map((item) => [item.id, item]));

  const boards: Board[] = (rawBoards ?? []).map((board) => ({
    ...board,
    key_features: Array.isArray(board.key_features) ? board.key_features.filter((item): item is string => typeof item === 'string') : [],
    content_json: board.content_json && typeof board.content_json === 'object' ? board.content_json as Record<string, unknown> : {},
    assets: (assignments ?? []).filter((item) => item.board_id === board.id).map((item) => {
      const media = assetMap.get(item.asset_id);
      return { id: item.id, role: item.role, caption: item.caption, url: media?.url ?? null, alt: media?.alt_text || item.role };
    }),
  }));

  const catalogue: Catalogue = {
    ...catalogueRow,
    quoted_contract_sum: catalogueRow.quoted_contract_sum === null ? null : Number(catalogueRow.quoted_contract_sum),
  };

  return (
    <main className={styles.shell}>
      <div className={styles.toolbar}>
        <div>
          <Link href={'/admin-dashboard/' + slug + '/boards'} className="text-sm text-stone-600 hover:text-stone-900">← Visual Catalogue</Link>
          <p className="mt-1 text-xs text-stone-500">A4 landscape · {boards.length} pages · Version {catalogue.version}</p>
        </div>
        <PrintCatalogueButton />
      </div>

      <div className={styles.catalogue}>
        {boards.map((board) => (
          <section key={board.id} className={styles.page} data-page={String(board.page_number || '')}>
            <DraftBadge status={catalogue.status} />
            <PageContent board={board} catalogue={catalogue} />
            <Footer catalogue={catalogue} projectCode={project.project_code} />
          </section>
        ))}
      </div>
    </main>
  );
}
