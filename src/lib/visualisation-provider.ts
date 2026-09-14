import { createAdminClient } from '@/utils/supabase/admin';

const POLLINATIONS_URL = 'https://gen.pollinations.ai';
const ASSET_BUCKET = 'project-assets';

export type RenderResult = {
  url: string | null;
  bytes: Buffer;
  contentType: string;
  model: string;
};

async function responseToImage(response: Response, model: string): Promise<RenderResult> {
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Pollinations ${model} request failed (${response.status}): ${body}`);
  }
  return { url: null, bytes: Buffer.from(await response.arrayBuffer()), contentType, model };
}

async function parseImageResponse(response: Response, model: string): Promise<RenderResult> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Pollinations ${model} request failed (${response.status}): ${body}`);
  }
  const payload = await response.json() as { data?: Array<{ b64_json?: string; url?: string }> };
  const item = payload.data?.[0];
  if (!item) throw new Error(`Pollinations ${model} returned no image.`);
  if (item.b64_json) {
    return {
      url: null,
      bytes: Buffer.from(item.b64_json, 'base64'),
      contentType: 'image/png',
      model,
    };
  }
  if (item.url) {
    return responseToImage(await fetch(item.url, { cache: 'no-store' }), model);
  }
  throw new Error(`Pollinations ${model} returned an image response without data.`);
}

async function tryImageEdit(input: {
  key: string;
  model: string;
  prompt: string;
  sourceUrl: string;
}) {
  const response = await fetch(`${POLLINATIONS_URL}/v1/images/edits`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      image: input.sourceUrl,
      response_format: 'b64_json',
      safe: true,
    }),
    cache: 'no-store',
  });

  return parseImageResponse(response, input.model);
}

export async function generateVisualisation(input: {
  prompt: string;
  negativePrompt?: string | null;
  sourceAssetStoragePath?: string | null;
}) {
  const key = process.env.POLLINATIONS_API_KEY;
  if (!key) {
    throw new Error('POLLINATIONS_API_KEY is required. Add a Pollinations API key to the server environment.');
  }

  const prompt = [
    input.prompt.trim(),
    input.negativePrompt?.trim() ? `Avoid: ${input.negativePrompt.trim()}` : '',
  ].filter(Boolean).join('\n\n');

  const supabase = createAdminClient();
  let sourceUrl: string | null = null;

  if (input.sourceAssetStoragePath) {
    const { data, error } = await supabase.storage
      .from(ASSET_BUCKET)
      .createSignedUrl(input.sourceAssetStoragePath, 10 * 60);

    if (error || !data?.signedUrl) {
      throw new Error(`Could not create a temporary source-image URL: ${error?.message || 'unknown storage error'}`);
    }

    // Verify the object really exists before handing its URL to the provider.
    const verify = await fetch(data.signedUrl, { method: 'GET', cache: 'no-store' });
    if (!verify.ok) {
      throw new Error(`The selected source image could not be read from storage (${verify.status}). Re-upload the site photo and try again.`);
    }

    sourceUrl = data.signedUrl;
  }

  if (sourceUrl) {
    const configured = process.env.POLLINATIONS_EDIT_MODEL || 'p-image-edit';
    const candidates = Array.from(new Set([
      configured,
      'p-image-edit',
      'nanobanana',
      'kontext',
    ]));

    const errors: string[] = [];

    for (const model of candidates) {
      try {
        return await tryImageEdit({
          key,
          model,
          prompt,
          sourceUrl,
        });
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    throw new Error(
      'Site-accurate rendering failed across all configured image-edit models. ' +
      errors.join(' | '),
    );
  }

  const model = process.env.POLLINATIONS_MODEL || 'flux';
  const response = await fetch(`${POLLINATIONS_URL}/v1/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'medium',
      response_format: 'b64_json',
      safe: true,
    }),
    cache: 'no-store',
  });

  return parseImageResponse(response, model);
}
