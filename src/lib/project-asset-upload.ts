'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  finalizeProjectAssetUpload,
  prepareProjectAssetUpload,
} from '@/app/admin-dashboard/asset-upload-actions';

const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const ALLOWED_ASSET_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const IMAGE_ONLY_KINDS = new Set(['site_photo', 'render', 'moodboard', 'progress']);
const RETRY_DELAYS_MS = [0, 800, 2000, 4500];

type UploadInput = {
  projectId: string;
  spaceId?: string | null;
  kind: string;
  altText?: string;
  file: File;
};

let browserClient: SupabaseClient | null = null;

function getBrowserClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Upload service is not configured. Please contact an administrator.');
  }

  browserClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return browserClient;
}

function validateFile(file: File, kind: string) {
  if (!(file instanceof File) || !file.name) throw new Error('Please choose a file.');
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_ASSET_BYTES) {
    throw new Error('File must be between 1 byte and 10 MB.');
  }
  if (!ALLOWED_ASSET_TYPES.has(file.type)) {
    throw new Error('Only JPEG, PNG, WebP images and PDF files are supported.');
  }
  if (IMAGE_ONLY_KINDS.has(kind) && !file.type.startsWith('image/')) {
    throw new Error('This upload requires a JPEG, PNG or WebP image.');
  }
}

function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error) {
    const value = error as Record<string, unknown>;
    return String(value.message ?? value.error ?? value.statusCode ?? 'unknown upload error');
  }
  return String(error || 'unknown upload error');
}

function isDuplicateUpload(error: unknown) {
  const text = errorText(error);
  return /already exists|duplicate|409|conflict/i.test(text);
}

function sleep(ms: number) {
  return ms ? new Promise((resolve) => window.setTimeout(resolve, ms)) : Promise.resolve();
}

export async function uploadProjectAsset(input: UploadInput) {
  validateFile(input.file, input.kind);

  const prepared = await prepareProjectAssetUpload({
    projectId: input.projectId,
    spaceId: input.spaceId || null,
    kind: input.kind,
    altText: input.altText,
    fileName: input.file.name,
    contentType: input.file.type,
    size: input.file.size,
  });

  const supabase = getBrowserClient();
  let uploadError: unknown = null;
  let stored = false;

  for (const delay of RETRY_DELAYS_MS) {
    await sleep(delay);
    const { error } = await supabase.storage
      .from(prepared.bucket)
      .uploadToSignedUrl(prepared.path, prepared.token, input.file);

    if (!error || isDuplicateUpload(error)) {
      stored = true;
      break;
    }
    uploadError = error;
  }

  if (!stored) {
    throw new Error(`Upload failed after automatic retries: ${errorText(uploadError)}`);
  }

  let finalError: unknown = null;
  for (const delay of [0, 700, 1800]) {
    await sleep(delay);
    try {
      return await finalizeProjectAssetUpload({
        projectId: input.projectId,
        spaceId: input.spaceId || null,
        kind: input.kind,
        altText: input.altText,
        fileName: input.file.name,
        contentType: input.file.type,
        size: input.file.size,
        path: prepared.path,
      });
    } catch (error) {
      finalError = error;
    }
  }

  throw new Error(
    `The file reached storage but could not be confirmed after retries. Refresh the page before uploading it again. ${errorText(finalError)}`,
  );
}
