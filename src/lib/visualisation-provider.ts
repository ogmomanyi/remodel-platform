import { createAdminClient } from '@/utils/supabase/admin';

const POLLINATIONS_URL = 'https://gen.pollinations.ai';
const ASSET_BUCKET = 'project-assets';

export type RenderResult = { url: string | null; bytes: Buffer; contentType: string };

async function responseToImage(response: Response): Promise<RenderResult> {
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  if (!response.ok) throw new Error(`Pollinations request failed (${response.status}): ${await response.text()}`);
  return { url: null, bytes: Buffer.from(await response.arrayBuffer()), contentType };
}

async function parseImageResponse(response: Response) {
  if (!response.ok) throw new Error(`Pollinations request failed (${response.status}): ${await response.text()}`);
  const payload = await response.json() as { data?: Array<{ b64_json?: string; url?: string }> };
  const item = payload.data?.[0];
  if (!item) throw new Error('Pollinations returned no image.');
  if (item.b64_json) return { url: null, bytes: Buffer.from(item.b64_json, 'base64'), contentType: 'image/png' };
  if (item.url) return responseToImage(await fetch(item.url, { cache: 'no-store' }));
  throw new Error('Pollinations returned an image response without data.');
}

export async function generateVisualisation(input: { prompt: string; negativePrompt?: string | null; sourceAssetStoragePath?: string | null }) {
  const key = process.env.POLLINATIONS_API_KEY;
  if (!key) throw new Error('POLLINATIONS_API_KEY is required. Add a Pollinations API key to the server environment.');
  const model = input.sourceAssetStoragePath ? (process.env.POLLINATIONS_EDIT_MODEL || 'klein') : (process.env.POLLINATIONS_MODEL || 'flux');
  const supabase = createAdminClient();
  let sourceUrl: string | null = null;

  if (input.sourceAssetStoragePath) {
    const { data, error } = await supabase.storage.from(ASSET_BUCKET).createSignedUrl(input.sourceAssetStoragePath, 10 * 60);
    if (error || !data?.signedUrl) throw new Error(`Could not create a temporary source-image URL: ${error?.message || 'unknown storage error'}`);
    sourceUrl = data.signedUrl;
  }

  if (sourceUrl) {
    const response = await fetch(`${POLLINATIONS_URL}/v1/images/edits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: input.prompt, image: sourceUrl, size: '1024x1024', response_format: 'b64_json' }),
      cache: 'no-store',
    });
    return parseImageResponse(response);
  }

  const response = await fetch(`${POLLINATIONS_URL}/v1/images/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: input.prompt, n: 1, size: '1024x1024', quality: 'medium', response_format: 'b64_json', safe: true }),
    cache: 'no-store',
  });
  return parseImageResponse(response);
}
