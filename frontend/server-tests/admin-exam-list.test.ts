import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, test } from 'node:test'
import { configuration } from '../server/core/config.ts'
import { closeDatabase, getDatabase, query, type Database } from '../server/core/db.ts'
import { migrate } from '../server/database/migrate.ts'
import { listExamSets, loadExamSet } from '../server/services/learning-structure.ts'

process.env.APP_ENV = 'test'
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
after(closeDatabase)

async function isolated(action: (db: Database) => Promise<void>) {
  const client = await getDatabase().connect()
  try {
    const [{ name }] = await query<{ name: string }>('SELECT current_database() AS name', [], client)
    assert.match(name!, /_test$/)
    await client.query('BEGIN')
    const schema = `admin_list_${randomUUID().replaceAll('-', '')}`
    await client.query(`CREATE SCHEMA "${schema}"`)
    await client.query(`SET LOCAL search_path TO "${schema}"`)
    await migrate(client)
    await action(client)
  } finally {
    await client.query('ROLLBACK')
    client.release()
  }
}

test('admin list retains full details and ordering with four SQL calls as materials grow', async () => isolated(async db => {
  const config = structuredClone(configuration)
  config.exam.set_count = 8
  await query(`INSERT INTO exam_sets(exam_number,title,format_code,publication_status)
    SELECT n,'Synthetic material '||n,'rekiken_mock',CASE WHEN n%2=0 THEN 'draft' ELSE 'published' END
    FROM generate_series(1,7) n ORDER BY n DESC`, [], db)
  await query(`INSERT INTO question_groups(exam_number,group_number,title,planned_question_count,publication_status)
    SELECT e,n,'Synthetic group '||n,CASE WHEN n%2=0 THEN 7 ELSE 8 END,CASE WHEN n%2=0 THEN 'draft' ELSE 'published' END
    FROM generate_series(1,7) e CROSS JOIN generate_series(1,4) n ORDER BY e DESC,n DESC`, [], db)
  await query(`INSERT INTO group_passages(group_id,label,display_order,content_blocks)
    SELECT id,'B',2,'[{"type":"text","text":"Synthetic second passage"}]' FROM question_groups`, [], db)
  await query(`INSERT INTO group_passages(group_id,label,display_order,content_blocks)
    SELECT id,'A',1,'[{"type":"text","text":"Synthetic first passage"}]' FROM question_groups`, [], db)
  await query(`INSERT INTO questions(exam_number,question_number,major_category_code,category_code,group_id,group_question_number,content_blocks,explanation_blocks,publication_status,created_at,updated_at)
    SELECT g.exam_number,(ARRAY[0,8,15,23])[g.group_number]+n,'synthetic','synthetic',g.id,n,
      '[{"type":"text","text":"Synthetic question"}]','[{"type":"text","text":"Synthetic explanation"}]',
      CASE WHEN n%2=0 THEN 'private' ELSE 'draft' END,NOW(),NOW()
    FROM question_groups g CROSS JOIN LATERAL generate_series(1,g.planned_question_count) n ORDER BY g.id,n DESC`, [], db)
  await query(`INSERT INTO question_choices(question_id,choice_label,content_blocks,is_correct,display_order,created_at,updated_at)
    SELECT id,'A','[{"type":"text","text":"Synthetic choice"}]',true,1,NOW(),NOW() FROM questions`, [], db)
  await query(`INSERT INTO question_topic_links(question_id,major_category_code,category_code)
    SELECT id,'related','related' FROM questions`, [], db)
  await query(`INSERT INTO question_passage_references(question_id,passage_id)
    SELECT q.id,p.id FROM questions q JOIN group_passages p ON p.group_id=q.group_id AND p.label='A'`, [], db)
  const [user] = await query<{id:number}>(`INSERT INTO users(name,email,password_digest,created_at,updated_at)
    VALUES('Synthetic user','synthetic@example.invalid','synthetic',NOW(),NOW()) RETURNING id`, [], db)
  await query(`INSERT INTO answer_histories(user_id,question_id,selected_choice_id,is_correct,created_at,updated_at)
    SELECT $1,c.question_id,c.id,true,NOW(),NOW() FROM question_choices c`, [user!.id], db)

  const expected = []
  for (let n = 1; n <= config.exam.set_count; n++) expected.push(await loadExamSet(n, db))
  const counts = await query('SELECT (SELECT count(*) FROM questions) AS questions,(SELECT count(*) FROM answer_histories) AS histories', [], db)
  assert.equal(counts[0].questions, 210)
  let calls = 0
  const counted: Database = { query: (async (...args: any[]) => { calls++; return (db.query as any)(...args) }) as Database['query'] }
  assert.deepEqual(await listExamSets(counted, config), expected)
  assert.equal(calls, 4)
  calls = 0
  const one = await listExamSets(counted, { ...config, exam: { ...config.exam, set_count: 1 } })
  assert.deepEqual(one, expected.slice(0, 1))
  assert.equal(calls, 4)
  assert.deepEqual(await query('SELECT (SELECT count(*) FROM questions) AS questions,(SELECT count(*) FROM answer_histories) AS histories', [], db), counts)
}))

test('empty admin list keeps all unregistered slots without detail queries', async () => isolated(async db => {
  let calls = 0
  const counted: Database = { query: (async (...args: any[]) => { calls++; return (db.query as any)(...args) }) as Database['query'] }
  const result = await listExamSets(counted)
  assert.equal(calls, 2)
  assert.equal(result.length, configuration.exam.set_count)
  assert.deepEqual(result.map(e => [e.exam_number,e.publication_status,e.groups.length]),
    Array.from({length:configuration.exam.set_count},(_,i)=>[i+1,'draft',0]))
}))
