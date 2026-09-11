-- Kota Designs: least-privilege client data access.
-- Clients should only see the fields explicitly used by the client portal.

-- Spaces: expose identity/ordering only, not survey measurements or internal condition notes.
revoke select on project_spaces from authenticated;
grant select (id, project_id, name, space_type, sort_order, created_at, updated_at)
  on project_spaces to authenticated;

-- Design/admin artefacts remain server-only until an explicit client-safe presentation surface exists.
drop policy if exists "Clients can read their options" on design_options;
revoke select on design_options from authenticated;

drop policy if exists "Clients can read their assets" on project_assets;
revoke select on project_assets from authenticated;

drop policy if exists "Clients can read their moodboards" on moodboards;
drop policy if exists "Clients can read their moodboard items" on moodboard_items;
revoke select on moodboards from authenticated;
revoke select on moodboard_items from authenticated;

drop policy if exists "Clients can read their visualisations" on visualisations;
revoke select on visualisations from authenticated;

drop policy if exists "Clients can read visualisation variants" on visualisation_variants;
revoke select on visualisation_variants from authenticated;

-- Proposal header: only released proposals are client-readable, and markup remains hidden.
drop policy if exists "Clients can read their proposals" on proposals;
create policy "Clients can read their proposals"
  on proposals for select to authenticated
  using (
    status in ('sent','approved','rejected','expired','superseded')
    and exists (
      select 1
      from project_members m
      where m.project_id = proposals.project_id
        and lower(m.email) = lower(coalesce(auth.jwt()->>'email',''))
    )
  );

drop policy if exists "Clients can read their proposal lines" on proposal_lines;
create policy "Clients can read their proposal lines"
  on proposal_lines for select to authenticated
  using (
    exists (
      select 1
      from proposals p
      join project_members m on m.project_id = p.project_id
      where p.id = proposal_lines.proposal_id
        and p.status in ('sent','approved','rejected','expired','superseded')
        and lower(m.email) = lower(coalesce(auth.jwt()->>'email',''))
    )
  );

revoke select on proposals from authenticated;
grant select (
  id,
  project_id,
  proposal_number,
  version,
  title,
  status,
  currency,
  tax_percent,
  subtotal,
  tax_amount,
  total,
  notes,
  valid_until,
  sent_at,
  approved_at,
  approved_by_email,
  created_at,
  updated_at
) on proposals to authenticated;

-- Proposal lines: never expose internal unit cost, internal total, or source snapshots.
revoke select on proposal_lines from authenticated;
grant select (
  id,
  proposal_id,
  project_space_id,
  design_option_id,
  line_type,
  description,
  quantity,
  unit,
  selling_unit_price,
  selling_total,
  sort_order,
  created_at
) on proposal_lines to authenticated;

-- Execution: visible records are already protected by RLS; restrict columns too.
revoke select on project_tasks from authenticated;
grant select (
  id,
  project_id,
  project_space_id,
  title,
  description,
  status,
  start_date,
  due_date,
  completed_at,
  sort_order,
  client_visible,
  created_at,
  updated_at
) on project_tasks to authenticated;

revoke select on project_progress_updates from authenticated;
grant select (
  id,
  project_id,
  project_space_id,
  task_id,
  update_type,
  title,
  notes,
  percent_complete,
  client_visible,
  created_at
) on project_progress_updates to authenticated;

-- Procurement and supplier data contains internal commercial information and is admin-only.
drop policy if exists "Authenticated users can read active suppliers" on suppliers;
drop policy if exists "Clients can read project procurement" on procurement_items;
drop policy if exists "Clients can read project purchase orders" on purchase_orders;
drop policy if exists "Clients can read project purchase order lines" on purchase_order_lines;

revoke select on suppliers from authenticated;
revoke select on procurement_items from authenticated;
revoke select on purchase_orders from authenticated;
revoke select on purchase_order_lines from authenticated;
