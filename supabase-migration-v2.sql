-- Kay Kay Nails: update 2 (run ONCE, BEFORE pushing the new code)
-- Supabase > SQL Editor > New query > paste this whole file > Run.
-- Safe to run again: it won't change anything the second time.

-- 1. Each booking now remembers the name, price, duration and category of its
--    services, so changing a price later never changes old bookings.
alter table appointments
  add column if not exists items jsonb not null default '[]'::jsonb;

-- 2. Fill that in for all existing bookings using today's service prices.
update appointments a
set items = coalesce((
  select jsonb_agg(
    jsonb_build_object('id', s.id, 'name', s.name, 'price', s.price,
                       'duration', s.duration, 'category', s.category)
    order by t.ord)
  from jsonb_array_elements_text(a.service_ids) with ordinality as t(sid, ord)
  join services s on s.id = t.sid
), '[]'::jsonb)
where jsonb_array_length(a.items) = 0
  and jsonb_array_length(a.service_ids) > 0;
