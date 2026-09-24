import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

test('Intervention Watch RLS uses the private membership helper and removes public RPC execution',async()=>{
  const sql=await readFile(new URL('../supabase/migrations/20260924090000_private_intervention_membership_policy.sql',import.meta.url),'utf8');
  for(const table of ['intervention_events_v1','intervention_actions_v1','intervention_watch_snapshots_v1','intervention_watch_runs_v1']){
    assert.match(sql,new RegExp(`create policy ${table}_read on public\\.${table}`));
  }
  assert.equal((sql.match(/using \(private\.is_workspace_member\(workspace_id\)\)/g)||[]).length,4);
  assert.match(sql,/revoke all on function public\.is_workspace_member\(uuid\) from public, anon, authenticated/);
  assert.doesNotMatch(sql,/grant execute on function public\.is_workspace_member\(uuid\) to authenticated/);
});
