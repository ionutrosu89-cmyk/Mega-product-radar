-- Public browser roles must never receive table-wide privileges that bypass row-level security semantics.
-- RLS does not protect TRUNCATE, and browser roles do not need TRIGGER or REFERENCES privileges.

do $$
declare r record;
begin
  for r in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format(
      'revoke truncate, trigger, references on table %I.%I from anon, authenticated',
      r.schemaname,
      r.tablename
    );
  end loop;
end $$;
