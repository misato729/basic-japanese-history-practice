import test from 'node:test'
import assert from 'node:assert/strict'
import { EXAM_CONFIG } from '../shared/examConfig.ts'
import { getDatabase, closeDatabase, transaction, query } from '../server/core/db.ts'
import { migrate } from '../server/database/migrate.ts'
import { syncCategories } from '../server/operations/categories.ts'

test('catalog repeat writes, rollback, and unrelated learning data remain intact', async () => {
  const name = (await query<{name:string}>('SELECT current_database() AS name'))[0]!.name
  assert.match(name, /_test$/)
  await migrate()
  const before = await query(`SELECT (SELECT count(*) FROM questions) AS questions,
    (SELECT count(*) FROM answer_histories) AS histories,(SELECT count(*) FROM favorites) AS favorites`)
  const config = structuredClone(EXAM_CONFIG)
  config.categories = { major:[{value:'catalog_fixture',label:'Synthetic chapter'}],minor:[{value:'catalog_fixture_section',label:'Synthetic section',major_category_value:'catalog_fixture'}] }
  const rollback = new Error('rollback fixture')
  await assert.rejects(transaction(async db => {
    await query("INSERT INTO major_categories VALUES('catalog_unrelated','Unrelated',999)",[],db)
    assert.deepEqual(await syncCategories(config,db),{major:1,minor:1})
    assert.deepEqual(await syncCategories(config,db),{major:1,minor:1})
    assert.equal((await query("SELECT count(*)::int AS n FROM minor_categories WHERE code='catalog_fixture_section'",[],db))[0].n,1)
    assert.equal((await query("SELECT count(*)::int AS n FROM major_categories WHERE code='catalog_unrelated'",[],db))[0].n,1)
    await assert.rejects(syncCategories({...config,categories:{...config.categories,minor:[{...config.categories.minor[0],major_category_value:'missing'}]}},db))
    throw rollback
  }),error=>error===rollback)
  assert.equal((await query("SELECT count(*)::int AS n FROM major_categories WHERE code='catalog_fixture'"))[0].n,0)
  assert.deepEqual(await query(`SELECT (SELECT count(*) FROM questions) AS questions,
    (SELECT count(*) FROM answer_histories) AS histories,(SELECT count(*) FROM favorites) AS favorites`),before)
  await closeDatabase()
})
