import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
process.chdir(projectRoot);
const help = `Usage: node scripts/check-service-report-database.mjs
Runs ONLY a fresh in-memory PostgreSQL WASM database with synthetic fixtures.
No database URL, environment credentials, linked project or remote database is accepted.
QA prerequisite (ignored directory, not an application dependency):
npm install --prefix .autopilot/runtime/service-reports/sql-tools --no-save --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.5.8
Limit: one database connection; real concurrent row-lock contention is not proven.`;
if (process.argv.includes('--help')) { console.log(help); process.exit(0); }
if (process.argv.length > 2) throw new Error('This disposable-only runner does not accept database targets or other arguments.');
const moduleDirectory = resolve('.autopilot/runtime/service-reports/sql-tools/node_modules/@electric-sql/pglite');
let packageVersion;
try { packageVersion = JSON.parse(readFileSync(resolve(moduleDirectory, 'package.json'), 'utf8')).version; }
catch { throw new Error(help); }
if (packageVersion !== '0.5.8') throw new Error('Use the reviewed QA-only PGlite version 0.5.8.');
const { PGlite } = await import(pathToFileURL(resolve(moduleDirectory, 'dist/index.js')).href);

const db = await PGlite.create();
const cases = [];
const order = '11111111-1111-4111-8111-111111111111';
const customer = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';
const blank = { performedServices: [], beforeHp: null, afterHp: null, beforeNm: null, afterNm: null, metricSource: null, sourceNote: '', customerNote: '' };
async function run(name, task) { await task(); cases.push(name); console.log(`PASS ${name}`); }
async function value(sql, params = []) { return (await db.query(sql, params)).rows[0]?.result; }
const report = (actor = customer, allow = false, id = order) => value('select public.get_or_create_service_report($1,$2,$3) as result', [id, actor, allow]);
const save = (revision, details) => value('select public.save_service_report_details($1,$2,$3,$4) as result', [order, other, revision, details]);
async function denied(query, code = '42501') { await assert.rejects(query, (error) => error.code === code); }
let first;
try {
  await db.exec(readFileSync('tests/fixtures/service-reports/database.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20260907111225_service_report_snapshots.sql', 'utf8'));
  await run('migration executed in disposable PostgreSQL engine', async () => assert.equal((await db.query("select count(*)::integer as total from pg_class where relname in ('service_report_details','service_report_snapshots','customer_report_branding') and relrowsecurity")).rows[0].total, 3));
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    await run(`${role} cannot execute report or detail RPC even with forged staff flag`, async () => { await denied(report(other, true)); await denied(save(0, blank)); });
    await run(`${role} cannot read or write report tables directly`, async () => {
      for (const table of ['service_report_details','service_report_snapshots','customer_report_branding']) await denied(db.query(`select * from public.${table}`));
      await denied(db.query('insert into public.customer_report_branding(customer_id) values ($1)', [customer]));
    });
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  await run('completed legacy order needs no report details or manual publication', async () => { first = await report(); assert.equal(first.revision, 1); assert.deepEqual(first.requestedServices, ['Stage 1','Diagnostics']); assert.deepEqual(first.performedServices, []); assert.equal(first.performance.afterHp, null); assert.equal(first.workshop.logoPath, null); assert.equal(first.customerNote, ''); });
  await run('unchanged downloads reuse same immutable report id and time', async () => assert.deepEqual(await report(), first));
  await run('wrong owner rejected, scoped staff permitted', async () => { await denied(report(other), 'SR404'); assert.deepEqual(await report(other, true), first); });
  await run('incomplete order rejected even for staff', async () => await denied(report(other, true, '55555555-5555-4555-8555-555555555555'), 'SR409'));
  await run('missing actor rejected', async () => { await denied(report(null, true), 'SR404'); });
  await run('metrics without provenance are rejected at SQL boundary', async () => { await denied(save(0, { ...blank, afterHp: 190 }), '22023'); await denied(save(0, { ...blank, afterHp: 0, metricSource: 'measured' }), '22023'); await denied(save(0, { ...blank, sourceNote: 'x', metricSource: 'invented' }), '22023'); });
  await run('both source and customer notes are bounded to 30 logical lines', async () => {
    for (const key of ['sourceNote', 'customerNote']) for (const separator of ['\n','\r\n','\r']) {
      const accepted = { ...blank, [key]: Array(30).fill('Note').join(separator) };
      const rejected = { ...blank, [key]: Array(31).fill('Note').join(separator) };
      assert.equal(await value('select public.valid_service_report_details($1) as result',[accepted]), true);
      assert.equal(await value('select public.valid_service_report_details($1) as result',[rejected]), false);
    }
  });
  await run('save creates revision with confirmed services and nullable independent metrics', async () => {
    const saved = await save(0, { ...blank, performedServices: ['Diagnostics'], beforeHp: 150, afterHp: 190, metricSource: 'measured', sourceNote: 'Synthetic dyno reference' });
    assert.equal(saved.revision, 1);
    const next = await report(); assert.equal(next.revision, 2); assert.notEqual(next.id, first.id); assert.deepEqual(next.performedServices, ['Diagnostics']); assert.equal(next.performance.afterNm, null);
  });
  await run('stale detail edit rejected by compare-and-swap', async () => await denied(save(0, blank), 'SR412'));
  await run('issued snapshot remains unchanged after detail revision', async () => assert.deepEqual(await value('select snapshot as result from public.service_report_snapshots where id=$1', [first.id]), first));
  await run('late branding creates new report without altering old logo-null report', async () => {
    await db.query('insert into public.customer_report_branding(customer_id,logo_path) values ($1,$2)', [customer, `${customer}/profile/report-logo/${order}.png`]);
    const current = await report(); assert.equal(current.revision, 3); assert.equal(current.workshop.logoPath, `${customer}/profile/report-logo/${order}.png`); assert.equal(first.workshop.logoPath, null);
    assert.deepEqual(await report(), current);
  });
  await run('foreign-owner logo path rejected by SQL check', async () => await denied(db.query('update public.customer_report_branding set logo_path=$1 where customer_id=$2', [`${other}/profile/report-logo/${order}.png`, customer]), '23514'));
  await run('profile change creates new report revision while old name stays frozen', async () => {
    await db.query('update public.profiles set company_name=$1 where id=$2', ['Renamed Synthetic Workshop', customer]);
    const current = await report(); assert.equal(current.revision, 4); assert.equal(current.workshop.name, 'Renamed Synthetic Workshop'); assert.equal(first.workshop.name, 'Synthetic Workshop');
  });
  await run('application cannot update/delete issued snapshots or detail revisions', async () => {
    await denied(db.query('update public.service_report_snapshots set snapshot=$1 where order_id=$2', [{}, order]));
    await denied(db.query('delete from public.service_report_snapshots where order_id=$1', [order]));
    await denied(db.query('update public.service_report_details set details=$1 where order_id=$2', [blank, order]));
  });
  await run('reopening blocks downloads without deleting historical snapshots', async () => {
    await db.query("update public.orders set status='in_progress' where id=$1", [order]); await denied(report(), 'SR409');
    assert.equal((await db.query('select count(*)::integer as total from public.service_report_snapshots where order_id=$1',[order])).rows[0].total, 4);
    await db.query("update public.orders set status='completed' where id=$1", [order]); assert.equal((await report()).revision, 4);
  });
  await run('reassignment refuses former customer and issues correctly owned new snapshot', async () => {
    await db.query('update public.orders set customer_id=$1 where id=$2',[other,order]); await denied(report(), 'SR404');
    const current = await report(other); assert.equal(current.revision, 5); assert.equal(current.customerId, other); assert.equal(current.workshop.logoPath, null);
  });
  await run('oversized requested service scope is rejected without snapshot creation', async () => {
    for (const serviceType of [Array(101).fill('Diagnostics').join('+'), 'a'.repeat(513), 'x'.repeat(51301)]) {
      await db.query('update public.orders set service_type=$1 where id=$2',[serviceType,order]);
      await denied(report(other), 'SR503');
    }
    assert.equal((await db.query('select count(*)::integer as total from public.service_report_snapshots where order_id=$1',[order])).rows[0].total, 5);
  });
  await db.exec('reset role');
  const version = (await db.query('select version() as version')).rows[0].version;
  const receipt = { engine: 'PGlite 0.5.8 (disposable PostgreSQL WASM)', version, passed: cases.length, cases, limitations: ['Single-connection engine: real concurrent lock contention not proven. No live/staging database accessed.'] };
  writeFileSync(resolve('.autopilot/runtime/service-reports/sql-rehearsal.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
} catch (error) { console.error({ message: error.message, code: error.code, position: error.position, where: error.where, stack: error.code ? undefined : error.stack }); process.exitCode = 1; }
finally { await db.close(); }
