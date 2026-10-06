import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
export const ids = { player: '10000000-0000-0000-0000-000000000001', other: '10000000-0000-0000-0000-000000000002', admin: '10000000-0000-0000-0000-000000000003' };
export async function database() {
  const db = new PGlite();
  // Test-only stand-in for Supabase-managed auth objects. NEVER run on Supabase.
  await db.exec(`create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;`);
  const schema = await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8');
  await db.exec(schema);
  for (const [name,id] of Object.entries(ids)) await db.query('insert into auth.users values($1,$2,$3)', [id, name+'@example.com', {username:name,role:'ADMIN'}]);
  await db.query("update public.ti_profiles set role='ADMIN' where id=$1",[ids.admin]);
  return db;
}
export async function asUser(db,id,fn) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);
  await db.exec(id?'set role authenticated':'set role anon');
  try { return await fn(); } finally { await db.exec('reset role'); }
}
export async function call(db,id,name,args=[]) {
  if(!/^ti_[a-z_]+$/.test(name)) throw new Error('Invalid test function');
  return asUser(db,id,async()=> (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args)).rows[0].result);
}
export const runResult = { score:1500,kills:12,bosses:0,bestCombo:6,wpm:40,accuracy:90,stageReached:2,roundsCleared:1,rank:'S',durationSec:10,won:false,difficulty:'HARD' };
export async function openRun(db,id=ids.player) {
  const run=await call(db,id,'ti_start_run');
  await db.query("update public.ti_runs set started_at=now()-interval '30 seconds' where id=$1",[run.runId]);
  return run.runId;
}
