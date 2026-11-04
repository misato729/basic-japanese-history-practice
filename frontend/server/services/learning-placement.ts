import {isDeepStrictEqual} from 'node:util'
import {query,transaction,type Database} from '../core/db.ts'
import {LEARNING_WRITE_LOCK,validateExamSet} from './learning-structure.ts'

export type PlacementPlan={mapping:Record<string,number>;before:{id:number;exam_number:number}[]}
export async function placementPlan(mapping:Record<string,number>,db:Database):Promise<PlacementPlan>{
 return {mapping,before:await query<{id:number;exam_number:number}>('SELECT id,exam_number FROM questions ORDER BY id',[],db)}
}
/** Move whole materials without changing question meaning or invalidating history. */
export async function applyPlacementPlan(plan:PlacementPlan,connection?:Database){
 return transaction(async db=>{
  await query('SELECT pg_advisory_xact_lock($1)',[LEARNING_WRITE_LOCK],db)
  await query('LOCK TABLE exam_sets,question_groups,questions,answer_histories,favorites IN SHARE ROW EXCLUSIVE MODE',[],db)
  const keys=Object.keys(plan.mapping).map(Number).sort((a,b)=>a-b)
  const targets=Object.values(plan.mapping).sort((a,b)=>a-b)
  if(!keys.length||!keys.every(n=>Number.isSafeInteger(n)&&n>0)||!isDeepStrictEqual(keys,targets)||keys.some(n=>plan.mapping[n]===n))throw Error('Invalid permutation')
  const current=await placementPlan(plan.mapping,db)
  const expected=plan.before.map(row=>({...row,exam_number:plan.mapping[row.exam_number]??row.exam_number}))
  if(isDeepStrictEqual(current.before,expected))return {changed:false,questions:0}
  if(!isDeepStrictEqual(current.before,plan.before))throw Error('Placement changed since planning')
  const sets=await query<any>('SELECT * FROM exam_sets WHERE exam_number=ANY($1::integer[]) ORDER BY exam_number',[keys],db)
  if(sets.length!==keys.length)throw Error('Missing set')
  for(const n of keys){const r=await validateExamSet(n,db,undefined,{publishedOnly:true});if(!r.valid)throw Error('Invalid source set')}
  const preserved=async()=>{
   const result:Record<string,unknown>={}
   for(const table of ['questions','question_groups','group_passages','question_choices','question_passage_references','question_topic_links','answer_histories','favorites']){
    const projection=['questions','question_groups'].includes(table)?"to_jsonb(t)-'exam_number'-'lock_version'-'updated_at'":'to_jsonb(t)'
    result[table]=(await query(`SELECT count(*)::integer AS count,md5(COALESCE(string_agg(md5((${projection})::text),'' ORDER BY md5((${projection})::text)),'')) AS digest FROM ${table} t`,[],db))[0]
   }
   for(const table of ['exam_sets','questions','question_groups'])result[table+'_outside']=(await query(`SELECT count(*)::integer AS count,md5(COALESCE(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS digest FROM ${table} t WHERE exam_number<>ALL($1::integer[])`,[keys],db))[0]
   return result
  }
  const before=await preserved()
  const [{maximum}]=await query<any>('SELECT max(exam_number)::integer AS maximum FROM exam_sets',[],db)
  const staging=keys.map((_,i)=>maximum+i+1)
  for(let i=0;i<keys.length;i++)await query('INSERT INTO exam_sets(exam_number,title,format_code,publication_status) SELECT $1,title,format_code,publication_status FROM exam_sets WHERE exam_number=$2',[staging[i],keys[i]],db)
  const move=async(from:number[],to:number[],finish:boolean)=>{
   // Both sides of the composite FK are changed in one SQL statement. FK checks
   // see the completed statement, while temporary slots avoid unique collisions.
   await query(`WITH mapping AS (SELECT * FROM unnest($1::integer[],$2::integer[]) AS m(old_number,new_number)),
    moved_groups AS (UPDATE question_groups g SET exam_number=m.new_number,lock_version=g.lock_version+CASE WHEN $3 THEN 1 ELSE 0 END,updated_at=CASE WHEN $3 THEN NOW() ELSE g.updated_at END FROM mapping m WHERE g.exam_number=m.old_number RETURNING g.id),
    moved_questions AS (UPDATE questions q SET exam_number=m.new_number,lock_version=q.lock_version+CASE WHEN $3 THEN 1 ELSE 0 END,updated_at=CASE WHEN $3 THEN NOW() ELSE q.updated_at END FROM mapping m WHERE q.exam_number=m.old_number RETURNING q.id)
    SELECT (SELECT count(*) FROM moved_groups) AS groups,(SELECT count(*) FROM moved_questions) AS questions`,[from,to,finish],db)
  }
  await move(keys,staging,false)
  for(const original of sets){
   const target=plan.mapping[original.exam_number]!
   const title=original.title.replace(new RegExp(`^(模擬試験|模試|教材)\\s*${original.exam_number}(?=\\D|$)`),`$1${target}`)
   await query('UPDATE exam_sets SET title=$1,format_code=$2,publication_status=$3,lock_version=lock_version+1,updated_at=NOW() WHERE exam_number=$4',[title,original.format_code,original.publication_status,target],db)
  }
  await move(staging,keys.map(n=>plan.mapping[n]!),true)
  await query('DELETE FROM exam_sets WHERE exam_number=ANY($1::integer[])',[staging],db)
  for(const n of keys){const r=await validateExamSet(n,db,undefined,{publishedOnly:true});if(!r.valid)throw Error('Invalid destination set')}
  if(!isDeepStrictEqual(await preserved(),before))throw Error('Non-placement data changed')
  if(!isDeepStrictEqual((await placementPlan(plan.mapping,db)).before,expected))throw Error('Destination mismatch')
  return {changed:true,questions:plan.before.filter(r=>keys.includes(r.exam_number)).length,preserved:before}
 },connection)
}
