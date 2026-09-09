-- Kota Designs: client response fields and immutable commercial versions.
-- Run after 007_proposals.sql.

alter table proposals
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by_email text,
  add column if not exists rejection_reason text;

create or replace function prevent_locked_proposal_changes()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('sent','approved','rejected','expired','superseded') then
    if tg_op = 'DELETE' or new.status <> old.status or new.title <> old.title or new.currency <> old.currency
      or new.markup_percent <> old.markup_percent or new.tax_percent <> old.tax_percent
      or new.subtotal <> old.subtotal or new.tax_amount <> old.tax_amount or new.total <> old.total then
      raise exception 'Proposal % is locked because it has already been sent or closed.', old.proposal_number;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proposals_lock_trigger on proposals;
create trigger proposals_lock_trigger
before update or delete on proposals
for each row execute function prevent_locked_proposal_changes();

create or replace function prevent_locked_proposal_line_changes()
returns trigger
language plpgsql
as $$
declare proposal_status text;
begin
  select status into proposal_status from proposals where id = coalesce(new.proposal_id, old.proposal_id);
  if proposal_status in ('sent','approved','rejected','expired','superseded') then
    raise exception 'Proposal lines are locked after the proposal is sent or closed.';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists proposal_lines_lock_trigger on proposal_lines;
create trigger proposal_lines_lock_trigger
before insert or update or delete on proposal_lines
for each row execute function prevent_locked_proposal_line_changes();
