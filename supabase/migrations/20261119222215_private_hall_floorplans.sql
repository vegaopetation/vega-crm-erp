insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hall-floorplans', 'hall-floorplans', false, 10485760, array['application/pdf']);

-- Match the whole object key to a real hall. Reuse the Step 2 project role
-- helper so floor plan access ends when the project assignment is removed.
create policy hall_floorplan_read on storage.objects for select to authenticated
using (bucket_id = 'hall-floorplans' and exists (
  select 1 from public.halls h
  where storage.objects.name = h.project_id::text || '/' || h.id::text || '.pdf'
    and vega_private.project_role(h.project_id) is not null
));

create policy hall_floorplan_insert on storage.objects for insert to authenticated
with check (bucket_id = 'hall-floorplans' and exists (
  select 1 from public.halls h
  where storage.objects.name = h.project_id::text || '/' || h.id::text || '.pdf'
    and vega_private.project_role(h.project_id) in ('admin', 'project_director', 'operations')
));

create policy hall_floorplan_update on storage.objects for update to authenticated
using (bucket_id = 'hall-floorplans' and exists (
  select 1 from public.halls h
  where storage.objects.name = h.project_id::text || '/' || h.id::text || '.pdf'
    and vega_private.project_role(h.project_id) in ('admin', 'project_director', 'operations')
))
with check (bucket_id = 'hall-floorplans' and exists (
  select 1 from public.halls h
  where storage.objects.name = h.project_id::text || '/' || h.id::text || '.pdf'
    and vega_private.project_role(h.project_id) in ('admin', 'project_director', 'operations')
));
