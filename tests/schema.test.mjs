import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { database, ids, asUser, call, openRun, runResult } from './fixtures.mjs';

test('Supabase schema, permissions and complete game flow', async(t)=>{
  const db=await database();
  try {
    await t.test('schema can be applied twice without losing players or seed packs',async()=>{
      await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
      assert.equal((await db.query('select count(*)::int as n from public.ti_profiles')).rows[0].n,3);
      assert.equal((await call(db,ids.admin,'ti_admin_packs')).length,5);
    });
    await t.test('public can read words and empty leaderboard, but cannot read players or runs',async()=>{
      const words=await call(db,null,'ti_words'); assert.equal(Object.keys(words.tiers).length,4); assert.ok(words.boss.length>20);
      assert.deepEqual((await call(db,null,'ti_leaderboard')).rows,[]);
      await assert.rejects(()=>call(db,null,'ti_me'),/permission denied/);
      for(const id of [null,ids.player]) for(const table of ['ti_profiles','ti_runs','ti_word_packs']) {
        await assert.rejects(()=>asUser(db,id,()=>db.exec('select * from public.'+table)),/permission denied/);
      }
    });
    await t.test('signup metadata cannot assign admin and duplicates are rejected',async()=>{
      assert.equal((await call(db,ids.player,'ti_me')).role,'USER');
      await assert.rejects(()=>db.query('insert into auth.users values(gen_random_uuid(),$1,$2)',['dup@example.com',{username:'PLAYER'}]),/unique/);
      await assert.rejects(()=>db.query('insert into auth.users values(gen_random_uuid(),$1,$2)',['bad@example.com',{username:'<script>'}]),/Callsign/);
      await assert.rejects(()=>call(db,ids.player,'ti_admin_users'),/Admin access/);
      await assert.rejects(()=>asUser(db,ids.player,()=>db.exec("update public.ti_profiles set role='ADMIN'")),/permission denied/);
    });
    let id;
    await t.test('run ownership, completion, rank recomputation, difficulty, and replay',async()=>{
      id=await openRun(db);
      await assert.rejects(()=>call(db,ids.other,'ti_finish_run',[id,runResult]),/No such run/);
      const result=await call(db,ids.player,'ti_finish_run',[id,runResult]);
      assert.equal(result.score,1500); assert.equal(result.difficulty,'HARD'); assert.equal(result.rank,'C');
      await assert.rejects(()=>call(db,ids.player,'ti_finish_run',[id,runResult]),/already submitted/);
      assert.equal((await call(db,ids.player,'ti_me')).bestScore,1500);
      const stats=await call(db,ids.player,'ti_player_stats'); assert.equal(stats.runsPlayed,1); assert.equal(stats.totalKills,12);
      assert.equal((await call(db,ids.other,'ti_history')).length,0);
    });
    await t.test('bad payload cannot bypass validation; rejected audits persist and cannot be replayed',async()=>{
      const invalid=await openRun(db);
      await assert.rejects(()=>call(db,ids.player,'ti_finish_run',[invalid,{...runResult,wpm:1000}]),/Out of range/);
      await assert.rejects(()=>call(db,ids.player,'ti_finish_run',[invalid,{...runResult,won:null}]),/Invalid/);
      const rejected=await call(db,ids.player,'ti_finish_run',[invalid,{...runResult,score:9000000}]);
      assert.match(rejected.error,/ceiling/);
      assert.equal((await db.query('select status from public.ti_runs where id=$1',[invalid])).rows[0].status,'REJECTED');
      await assert.rejects(()=>call(db,ids.player,'ti_finish_run',[invalid,runResult]),/already submitted/);
      assert.equal((await call(db,ids.player,'ti_player_stats')).runsPlayed,1);
    });
    await t.test('admin assist is excluded; users cannot claim assist',async()=>{
      const aid=await openRun(db,ids.admin);
      assert.equal((await call(db,ids.admin,'ti_finish_run',[aid,{...runResult,assisted:true}])).assisted,true);
      assert.equal((await call(db,ids.admin,'ti_me')).bestScore,0);
      const uid=await openRun(db); assert.match((await call(db,ids.player,'ti_finish_run',[uid,{...runResult,assisted:true}])).error,/Only admins/);
      assert.equal((await call(db,null,'ti_leaderboard')).totalElements,1);
    });
    await t.test('leaderboard sorts, pages, literals, difficulty and filters match',async()=>{
      const rid=await openRun(db,ids.other);
      await call(db,ids.other,'ti_finish_run',[rid,{...runResult,score:500,wpm:80,difficulty:'EASY'}]);
      const page=await call(db,null,'ti_leaderboard',[0,1,null,null,'','wpm']);
      assert.equal(page.totalPages,2); assert.equal(page.rows[0].username,'other');
      assert.equal((await call(db,null,'ti_leaderboard',[1,1,null,null,'','wpm'])).rows[0].position,2);
      assert.equal((await call(db,null,'ti_leaderboard',[0,20,null,'HARD','','score'])).totalElements,1);
      assert.equal((await call(db,null,'ti_leaderboard',[0,20,null,null,'PLAYER','score'])).rows[0].username,'player');
      assert.equal((await call(db,null,'ti_leaderboard',[0,20,null,null,'%','score'])).totalElements,0);
      await assert.rejects(()=>call(db,null,'ti_leaderboard',[-1,20]),/Page/);
      await assert.rejects(()=>call(db,null,'ti_leaderboard',[0,1000]),/size/);
    });
    await t.test('admin word pack create, edit, delete and player suspension',async()=>{
      await assert.rejects(()=>call(db,ids.player,'ti_save_pack',[null,{name:'Hack',tier:1,active:true,words:['bad']}]),/Admin/);
      const pack=await call(db,ids.admin,'ti_save_pack',[null,{name:'Test pack',tier:2,active:true,words:['test','TEST','word']}]); assert.equal(pack.words.length,2);
      await call(db,ids.admin,'ti_save_pack',[pack.id,{name:'Edited',tier:3,active:false,words:['tests']}]);
      await assert.rejects(()=>call(db,ids.admin,'ti_save_pack',[null,{name:'Bad',tier:1,active:true,words:['a-b']}]),/letters/);
      await call(db,ids.admin,'ti_delete_pack',[pack.id]);
      await assert.rejects(()=>call(db,ids.admin,'ti_suspend_user',[ids.admin,true]),/admin/);
      await call(db,ids.admin,'ti_suspend_user',[ids.other,true]);
      await assert.rejects(()=>call(db,ids.other,'ti_start_run'),/suspended/);
      assert.equal((await call(db,null,'ti_leaderboard')).totalElements,1);
      await call(db,ids.admin,'ti_suspend_user',[ids.other,false]);
      assert.equal((await call(db,ids.admin,'ti_admin_stats')).rejectedRuns,2);
    });
    await t.test('start throttle handles repeated requests',async()=>{
      const recent=(await db.query("select count(*)::int as n from public.ti_runs where user_id=$1 and started_at>now()-interval '1 minute'",[ids.admin])).rows[0].n;
      for(let i=recent;i<10;i++) await call(db,ids.admin,'ti_start_run');
      await assert.rejects(()=>call(db,ids.admin,'ti_start_run'),/Too many starts/);
    });
  } finally { await db.close(); }
});
