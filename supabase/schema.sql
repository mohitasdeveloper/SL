-- Study Log: run in its own Supabase project's SQL editor. Safe to run again on an existing project (it only adds what is new).
-- Nothing is ever hard-deleted: every table has is_deleted / deleted_at (soft delete).
-- RLS is on with no policies, so the anon key can only use the functions at the bottom.
create table if not exists sl_users (
  student_id text primary key,
  name text not null,
  course text,
  dp_url text,
  settings jsonb not null default '{}',   -- global defaults: {template, mode, implicit}
  timer jsonb,                            -- the running/paused study timer, if any
  created_at timestamptz not null default now()
);
create table if not exists sl_nodes (                   -- every level: course, subject, module, chapter, concept... any depth
  id uuid primary key,
  user_id text not null references sl_users(student_id),
  parent_id uuid references sl_nodes(id),
  title text not null,
  position int not null default 0,
  done boolean not null default false,    -- only used for a level with no checklist items
  settings jsonb,                         -- per-course override (set on the course level only)
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists sl_items (                   -- checklist items
  id uuid primary key,
  user_id text not null references sl_users(student_id),
  node_id uuid not null references sl_nodes(id),
  title text not null,
  done boolean not null default false,
  position int not null default 0,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists sl_logs (                    -- study time, stored ONCE; parent totals are summed from these
  id uuid primary key,
  user_id text not null references sl_users(student_id),
  node_id uuid not null references sl_nodes(id),
  log_date date not null,
  seconds int not null check (seconds > 0),
  source text not null default 'manual',  -- 'manual' | 'timer'
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists sl_notes (
  id uuid primary key,
  user_id text not null references sl_users(student_id),
  node_id uuid not null references sl_nodes(id),
  log_id uuid references sl_logs(id),     -- set when the note was written in a study session
  body text not null,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table sl_items add column if not exists tpl_id text;   -- set on mandatory checklist items (the id of the course setting)
create index if not exists sl_nodes_user on sl_nodes (user_id);
create index if not exists sl_items_user on sl_items (user_id);
create index if not exists sl_logs_user on sl_logs (user_id);
create index if not exists sl_notes_user on sl_notes (user_id);
alter table sl_users enable row level security;
alter table sl_nodes enable row level security;
alter table sl_items enable row level security;
alter table sl_logs enable row level security;
alter table sl_notes enable row level security;

-- Everything the app needs for one student (non-deleted rows only).
create or replace function sl_load(p_id text) returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'settings', u.settings,
    'timer', u.timer,
    'nodes', coalesce((select jsonb_agg(to_jsonb(n) - 'user_id' - 'is_deleted' - 'deleted_at' - 'updated_at')
                       from sl_nodes n where n.user_id = p_id and not n.is_deleted), '[]'),
    'items', coalesce((select jsonb_agg(to_jsonb(i) - 'user_id' - 'is_deleted' - 'deleted_at' - 'created_at')
                       from sl_items i where i.user_id = p_id and not i.is_deleted), '[]'),
    'logs',  coalesce((select jsonb_agg(to_jsonb(l) - 'user_id' - 'is_deleted' - 'deleted_at')
                       from sl_logs l where l.user_id = p_id and not l.is_deleted), '[]'),
    'notes', coalesce((select jsonb_agg(to_jsonb(t) - 'user_id' - 'is_deleted' - 'deleted_at' - 'updated_at')
                       from sl_notes t where t.user_id = p_id and not t.is_deleted), '[]'))
  from sl_users u where u.student_id = p_id;
$$;

-- Called on every app open: creates/refreshes the student, then returns their data.
create or replace function sl_open(p_id text, p_name text, p_course text, p_dp text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  insert into sl_users (student_id, name, course, dp_url) values (p_id, p_name, p_course, nullif(p_dp, ''))
  on conflict (student_id) do update set name = excluded.name, course = excluded.course, dp_url = excluded.dp_url;
  return sl_load(p_id);
end $$;

-- Create or update one row. p_kind: node | item | log | note
create or replace function sl_save(p_id text, p_kind text, p_row jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  rid uuid := (p_row->>'id')::uuid;
  nid uuid := nullif(p_row->>'node_id', '')::uuid;
  pid uuid := nullif(p_row->>'parent_id', '')::uuid;
begin
  if not exists (select 1 from sl_users where student_id = p_id) then raise exception 'Unknown user'; end if;
  if p_kind = 'node' then
    if pid is not null and not exists (select 1 from sl_nodes where id = pid and user_id = p_id and not is_deleted) then
      raise exception 'Parent level not found';
    end if;
    if pid is not null and exists (
      with recursive d as (select id from sl_nodes where id = rid
                           union all select n.id from sl_nodes n join d on n.parent_id = d.id)
      select 1 from d where id = pid) then
      raise exception 'A level cannot be moved inside itself';
    end if;
    insert into sl_nodes (id, user_id, parent_id, title, position, done, settings, created_at)
    values (rid, p_id, pid, left(trim(p_row->>'title'), 200), coalesce((p_row->>'position')::int, 0),
            coalesce((p_row->>'done')::boolean, false), nullif(p_row->'settings', 'null'::jsonb),
            coalesce((p_row->>'created_at')::timestamptz, now()))
    on conflict (id) do update set parent_id = excluded.parent_id, title = excluded.title, position = excluded.position,
      done = excluded.done, settings = excluded.settings, updated_at = now()
      where sl_nodes.user_id = p_id and not sl_nodes.is_deleted;
  else
    if nid is null or not exists (select 1 from sl_nodes where id = nid and user_id = p_id and not is_deleted) then
      raise exception 'Level not found';
    end if;
    if p_kind = 'item' then
      insert into sl_items (id, user_id, node_id, title, done, position, tpl_id)
      values (rid, p_id, nid, left(trim(p_row->>'title'), 300), coalesce((p_row->>'done')::boolean, false), coalesce((p_row->>'position')::int, 0), nullif(p_row->>'tpl_id', ''))
      on conflict (id) do update set node_id = excluded.node_id, title = excluded.title, done = excluded.done, position = excluded.position, tpl_id = excluded.tpl_id
        where sl_items.user_id = p_id and not sl_items.is_deleted;
    elsif p_kind = 'log' then
      if (p_row->>'log_date')::date > (now() at time zone 'Asia/Kolkata')::date then raise exception 'Future dates are not allowed'; end if;
      if coalesce((p_row->>'seconds')::int, 0) <= 0 then raise exception 'Duration must be more than zero'; end if;
      insert into sl_logs (id, user_id, node_id, log_date, seconds, source)
      values (rid, p_id, nid, (p_row->>'log_date')::date, (p_row->>'seconds')::int, coalesce(p_row->>'source', 'manual'))
      on conflict (id) do update set node_id = excluded.node_id, log_date = excluded.log_date, seconds = excluded.seconds
        where sl_logs.user_id = p_id and not sl_logs.is_deleted;
    elsif p_kind = 'note' then
      insert into sl_notes (id, user_id, node_id, log_id, body)
      values (rid, p_id, nid, nullif(p_row->>'log_id', '')::uuid, left(trim(p_row->>'body'), 10000))
      on conflict (id) do update set node_id = excluded.node_id, body = excluded.body, updated_at = now()
        where sl_notes.user_id = p_id and not sl_notes.is_deleted;
    else
      raise exception 'Unknown kind';
    end if;
  end if;
end $$;

-- Soft delete. Deleting a level also soft-deletes everything under it (sub-levels, checklists, study time, notes)
-- with one shared timestamp so sl_restore can bring it all back.
create or replace function sl_delete(p_id text, p_kind text, p_ref uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ts timestamptz := clock_timestamp(); ids uuid[];
begin
  if p_kind = 'node' then
    with recursive t(id) as (
      select id from sl_nodes where id = p_ref and user_id = p_id and not is_deleted
      union all
      select n.id from sl_nodes n join t on n.parent_id = t.id where n.user_id = p_id and not n.is_deleted)
    select array_agg(id) into ids from t;
    update sl_nodes set is_deleted = true, deleted_at = ts where id = any(ids);
    update sl_items set is_deleted = true, deleted_at = ts where node_id = any(ids) and not is_deleted;
    update sl_logs  set is_deleted = true, deleted_at = ts where node_id = any(ids) and not is_deleted;
    update sl_notes set is_deleted = true, deleted_at = ts where node_id = any(ids) and not is_deleted;
  elsif p_kind = 'item' then update sl_items set is_deleted = true, deleted_at = ts where id = p_ref and user_id = p_id and not is_deleted;
  elsif p_kind = 'log'  then update sl_logs  set is_deleted = true, deleted_at = ts where id = p_ref and user_id = p_id and not is_deleted;
  elsif p_kind = 'note' then update sl_notes set is_deleted = true, deleted_at = ts where id = p_ref and user_id = p_id and not is_deleted;
  end if;
end $$;

-- Undo a delete (used by the Undo button).
create or replace function sl_restore(p_id text, p_kind text, p_ref uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ts timestamptz;
begin
  if p_kind = 'node' then
    select deleted_at into ts from sl_nodes where id = p_ref and user_id = p_id and is_deleted;
    if ts is null then return; end if;
    update sl_nodes set is_deleted = false, deleted_at = null where user_id = p_id and deleted_at = ts;
    update sl_items set is_deleted = false, deleted_at = null where user_id = p_id and deleted_at = ts;
    update sl_logs  set is_deleted = false, deleted_at = null where user_id = p_id and deleted_at = ts;
    update sl_notes set is_deleted = false, deleted_at = null where user_id = p_id and deleted_at = ts;
  elsif p_kind = 'item' then update sl_items set is_deleted = false, deleted_at = null where id = p_ref and user_id = p_id;
  elsif p_kind = 'log'  then update sl_logs  set is_deleted = false, deleted_at = null where id = p_ref and user_id = p_id;
  elsif p_kind = 'note' then update sl_notes set is_deleted = false, deleted_at = null where id = p_ref and user_id = p_id;
  end if;
end $$;

-- Save the global settings or the running timer. p_key: settings | timer
create or replace function sl_put(p_id text, p_key text, p_val jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_key = 'settings' then update sl_users set settings = coalesce(p_val, '{}') where student_id = p_id;
  elsif p_key = 'timer' then update sl_users set timer = p_val where student_id = p_id;
  end if;
end $$;

-- Several saves in one call (the app batches its saves). Each item of p_rows is {kind, row}; all or nothing.
create or replace function sl_save_many(p_id text, p_rows jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  for r in select value from jsonb_array_elements(p_rows) loop
    perform sl_save(p_id, r->>'kind', r->'row');
  end loop;
end $$;

-- Mandatory checklist: every level inside a course carries the course's mandatory items
-- (course settings -> mandatory, a list of {id, title}). Adds missing items, renames changed ones and removes
-- items that are no longer on the list. p_course = null syncs all of the student's courses.
create or replace function sl_sync(p_id text, p_course uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare c record; ids uuid[]; keep text[];
begin
  for c in
    select n.id, coalesce(n.settings->'mandatory', u.settings->'mandatory', '[]'::jsonb) as mand
    from sl_nodes n join sl_users u on u.student_id = n.user_id
    where n.user_id = p_id and n.parent_id is null and not n.is_deleted and (p_course is null or n.id = p_course)
  loop
    select coalesce(array_agg(x.id), '{}') into ids from (
      with recursive d(id) as (
        select id from sl_nodes where parent_id = c.id and not is_deleted
        union all
        select n.id from sl_nodes n join d on n.parent_id = d.id where not n.is_deleted)
      select id from d) x;
    keep := coalesce((select array_agg(e.v->>'id') from jsonb_array_elements(c.mand) as e(v)), '{}');
    update sl_items set is_deleted = true, deleted_at = now()
      where user_id = p_id and tpl_id is not null and not is_deleted
        and ((node_id = any(ids) and tpl_id <> all(keep)) or node_id = c.id);
    update sl_items i set title = left(e.v->>'title', 300)
      from jsonb_array_elements(c.mand) as e(v)
      where i.user_id = p_id and i.node_id = any(ids) and not i.is_deleted and i.tpl_id = e.v->>'id' and i.title <> left(e.v->>'title', 300);
    insert into sl_items (id, user_id, node_id, title, done, position, tpl_id)
    select gen_random_uuid(), p_id, nd, left(e.v->>'title', 300), false, e.o::int - 100, e.v->>'id'
    from unnest(ids) as nd cross join jsonb_array_elements(c.mand) with ordinality as e(v, o)
    where not exists (select 1 from sl_items i where i.node_id = nd and i.tpl_id = e.v->>'id' and not i.is_deleted);
  end loop;
end $$;
