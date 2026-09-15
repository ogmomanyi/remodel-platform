'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';

const ASSET_BUCKET = 'project-assets';
const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const ALLOWED_ASSET_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const ALLOWED_ASSET_KINDS = new Set(['site_photo', 'plan', 'render', 'moodboard', 'material', 'progress', 'document']);
const IMAGE_ONLY_KINDS = new Set(['site_photo', 'render', 'moodboard', 'progress']);
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

type AssetUploadMetadata = {
  projectId: string;
  spaceId?: string | null;
  kind: string;
  altText?: string;
  fileName: string;
  contentType: string;
  size: number;
};

type FinalizeAssetUploadInput = AssetUploadMetadata & {
  path: string;
};

function normaliseUploadMetadata(input: AssetUploadMetadata) {
  const projectId = String(input.projectId || '').trim();
  const spaceId = input.spaceId ? String(input.spaceId).trim() : null;
  const kind = String(input.kind || '').trim();
  const fileName = String(input.fileName || '').trim().slice(0, 255);
  const contentType = String(input.contentType || '').trim().toLowerCase();
  const size = Number(input.size);
  const altText = String(input.altText || '').trim().slice(0, 500);

  if (!projectId) throw new Error('Project is required.');
  if (!fileName) throw new Error('Please choose a file.');
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_ASSET_BYTES) {
    throw new Error('File must be between 1 byte and 10 MB.');
  }
  if (!ALLOWED_ASSET_TYPES.has(contentType)) {
    throw new Error('Only JPEG, PNG, WebP images and PDF files are supported.');
  }
  if (!ALLOWED_ASSET_KINDS.has(kind)) throw new Error('Invalid asset type.');
  if (IMAGE_ONLY_KINDS.has(kind) && !contentType.startsWith('image/')) {
    throw new Error('This upload requires a JPEG, PNG or WebP image.');
  }

  return { projectId, spaceId, kind, fileName, contentType, size, altText };
}

async function loadProjectContext(projectId: string, spaceId: string | null) {
  const supabase = createAdminClient();
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, slug')
    .eq('id', projectId)
    .maybeSingle();

  if (projectError) throw new Error(`Could not load the project: ${projectError.message}`);
  if (!project) throw new Error('Project not found.');

  if (spaceId) {
    const { data: space, error: spaceError } = await supabase
      .from('project_spaces')
      .select('id')
      .eq('id', spaceId)
      .eq('project_id', project.id)
      .maybeSingle();

    if (spaceError) throw new Error(`Could not verify the selected space: ${spaceError.message}`);
    if (!space) throw new Error('Selected space does not belong to this project.');
  }

  return { supabase, project };
}

function assertOwnedStoragePath(projectId: string, spaceId: string | null, contentType: string, path: string) {
  const prefix = `${projectId}/${spaceId || 'project'}/`;
  const extension = EXTENSION_BY_MIME[contentType];
  if (!path.startsWith(prefix) || path.includes('..') || !path.endsWith(`.${extension}`)) {
    throw new Error('Invalid upload path.');
  }
}

async function signedAssetUrl(supabase: ReturnType<typeof createAdminClient>, path: string) {
  const { data, error } = await supabase.storage.from(ASSET_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}

function revalidateAssetViews(slug: string) {
  revalidatePath(`/admin-dashboard/${slug}/edit`);
  revalidatePath(`/admin-dashboard/${slug}/visualise`);
  revalidatePath(`/admin-dashboard/${slug}/execution`);
  revalidatePath(`/${slug}`);
  revalidatePath('/client-dashboard');
  revalidatePath('/admin-dashboard');
}

export async function prepareProjectAssetUpload(input: AssetUploadMetadata) {
  await requireAdmin();
  const meta = normaliseUploadMetadata(input);
  const { supabase, project } = await loadProjectContext(meta.projectId, meta.spaceId);
  const extension = EXTENSION_BY_MIME[meta.contentType];
  const path = `${project.id}/${meta.spaceId || 'project'}/${crypto.randomUUID()}.${extension}`;

  const { data, error } = await supabase.storage
    .from(ASSET_BUCKET)
    .createSignedUploadUrl(path, { upsert: false });

  if (error || !data?.token) {
    throw new Error(`Could not prepare upload: ${error?.message || 'signed upload token was not created'}`);
  }

  return {
    bucket: ASSET_BUCKET,
    path,
    token: data.token,
  };
}

export async function finalizeProjectAssetUpload(input: FinalizeAssetUploadInput) {
  await requireAdmin();
  const meta = normaliseUploadMetadata(input);
  const path = String(input.path || '').trim();
  const { supabase, project } = await loadProjectContext(meta.projectId, meta.spaceId);
  assertOwnedStoragePath(project.id, meta.spaceId, meta.contentType, path);

  const { data: existing, error: existingError } = await supabase
    .from('project_assets')
    .select('id, project_id, space_id, kind, storage_path, alt_text, created_at')
    .eq('storage_path', path)
    .maybeSingle();

  if (existingError) throw new Error(`Could not verify the uploaded asset: ${existingError.message}`);
  if (existing) {
    if (existing.project_id !== project.id) throw new Error('Upload path belongs to a different project.');
    return { ...existing, signed_url: await signedAssetUrl(supabase, path) };
  }

  const separator = path.lastIndexOf('/');
  const folder = path.slice(0, separator);
  const objectName = path.slice(separator + 1);
  const { data: objects, error: listError } = await supabase.storage
    .from(ASSET_BUCKET)
    .list(folder, { limit: 10, search: objectName });

  if (listError) throw new Error(`Could not verify uploaded file: ${listError.message}`);
  const stored = (objects ?? []).find((item) => item.name === objectName);
  if (!stored) throw new Error('The file did not reach storage. Please retry the upload.');

  const storageMeta = (stored.metadata ?? {}) as Record<string, unknown>;
  const storedSize = Number(storageMeta.size);
  if (Number.isFinite(storedSize) && storedSize !== meta.size) {
    await supabase.storage.from(ASSET_BUCKET).remove([path]);
    throw new Error('The uploaded file size did not match the selected file. Please retry.');
  }
  const storedMime = String(storageMeta.mimetype ?? storageMeta.contentType ?? '').toLowerCase();
  if (storedMime && storedMime !== meta.contentType) {
    await supabase.storage.from(ASSET_BUCKET).remove([path]);
    throw new Error('The uploaded file type did not match the selected file. Please retry.');
  }

  const { data: asset, error: assetError } = await supabase
    .from('project_assets')
    .insert({
      project_id: project.id,
      space_id: meta.spaceId,
      kind: meta.kind,
      storage_path: path,
      alt_text: meta.altText || null,
      metadata: {
        original_name: meta.fileName,
        content_type: meta.contentType,
        size: meta.size,
        upload_transport: 'signed_direct',
      },
    })
    .select('id, project_id, space_id, kind, storage_path, alt_text, created_at')
    .single();

  if (assetError || !asset) {
    if (assetError?.code === '23505') {
      const { data: raced } = await supabase
        .from('project_assets')
        .select('id, project_id, space_id, kind, storage_path, alt_text, created_at')
        .eq('storage_path', path)
        .maybeSingle();
      if (raced?.project_id === project.id) {
        return { ...raced, signed_url: await signedAssetUrl(supabase, path) };
      }
    }

    await supabase.storage.from(ASSET_BUCKET).remove([path]);
    throw new Error(`Could not save asset record: ${assetError?.message || 'unknown database error'}`);
  }

  const { error: eventError } = await supabase.from('project_events').insert({
    project_id: project.id,
    event_type: 'project_asset_uploaded',
    actor_email: 'admin',
    metadata: {
      asset_id: asset.id,
      kind: meta.kind,
      space_id: meta.spaceId,
      upload_transport: 'signed_direct',
      original_name: meta.fileName,
      size: meta.size,
    },
  });

  if (eventError) {
    console.error('Could not record project_asset_uploaded event:', eventError.message);
  }

  revalidateAssetViews(project.slug);
  return { ...asset, signed_url: await signedAssetUrl(supabase, path) };
}
