-- Clean asset deletion semantics for generated visualisations.

alter table visualisation_variants
  drop constraint if exists visualisation_variants_asset_id_fkey;

alter table visualisation_variants
  add constraint visualisation_variants_asset_id_fkey
  foreign key (asset_id)
  references project_assets(id)
  on delete cascade;
