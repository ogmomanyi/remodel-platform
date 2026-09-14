
-- Require client-selected visualisations to be site-accurate, source-grounded and current.

create or replace function public.enforce_client_visualisation_selection()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.is_selected = true then
    if new.status <> 'ready' then
      raise exception 'Only completed visualisations can be selected for client presentation.';
    end if;

    if coalesce(new.fidelity_mode, 'concept') <> 'site_accurate' then
      raise exception 'Only site-accurate visualisations can be selected for client presentation.';
    end if;

    if new.source_asset_id is null then
      raise exception 'A client-selected visualisation must have a source site photo.';
    end if;

    if coalesce(new.brief_version, 0) < 3 then
      raise exception 'Client-selected visualisations must use structured brief version 3 or later.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists visualisations_client_selection_guard on public.visualisations;
create trigger visualisations_client_selection_guard
before insert or update of is_selected, status, fidelity_mode, source_asset_id, brief_version
on public.visualisations
for each row
execute function public.enforce_client_visualisation_selection();
