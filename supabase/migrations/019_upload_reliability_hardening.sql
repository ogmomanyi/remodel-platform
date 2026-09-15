-- Kota Designs: upload reliability and storage hardening.
-- Enforce the same file limits at the storage layer that the application exposes.

update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]::text[]
where id = 'project-assets';

create unique index if not exists project_assets_storage_path_unique
  on public.project_assets (storage_path);

create index if not exists presentation_board_assets_asset_id_idx
  on public.presentation_board_assets (asset_id);
