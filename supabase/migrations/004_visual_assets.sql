-- Kota Designs: private storage bucket for project visual assets.
-- Run after 002_design_studio.sql.

insert into storage.buckets (id, name, public)
values ('project-assets', 'project-assets', false)
on conflict (id) do update set public = false;

-- The application uses the server-only Supabase service role for admin uploads
-- and signed URL generation, so no client storage write policy is required here.
