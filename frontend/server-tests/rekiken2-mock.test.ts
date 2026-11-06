import assert from 'node:assert/strict'
import {test,after} from 'node:test'
import {randomUUID} from 'node:crypto'
import {configuration} from '../server/core/config.ts'
import {closeDatabase,getDatabase} from '../server/core/db.ts'
import {migrate} from '../server/database/migrate.ts'
import {createArchiveV2,importArchiveV2} from '../server/operations/content-v2.ts'
import {loadExamSet,publishExamSet,validateExamSet} from '../server/services/learning-writer.ts'
import {validateBlocks,normalizeAnswerText,checkTextConstraints} from '../server/services/learning-validation.ts'
import {getQuestion} from '../server/services/learning.ts'
if(process.env.TEST_DATABASE_URL)process.env.DATABASE_URL=process.env.TEST_DATABASE_URL
process.env.APP_ENV='test';after(closeDatabase)
const image={type:'image',src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5WQAAAAASUVORK5CYII=',alt:'Synthetic diagram'}
function fixture(){
 const topic=configuration.categories.minor[0]!
 const groups=Array.from({length:5},(_,i)=>({archive_id:i+1,exam_number:2,group_number:i+1,title:'Synthetic group',planned_question_count:10,publication_status:'draft',passages:[{archive_id:i+1,label:'A',display_order:1,content_blocks:[{type:'text',text:'Synthetic passage'}]}]}))
 const questions=groups.flatMap((g,i)=>Array.from({length:10},(_,j)=>({exam_number:2,question_number:j<9?i*9+j+1:46+i,group_id:g.archive_id,group_question_number:j+1,major_category_code:topic.major_category_value,category_code:topic.value,is_cultural_history:false,is_art_history:false,cultural_history_category:null,publication_status:'draft',answer_type:j===9?'short_text':'single_choice',content_blocks:[{type:'text',text:'Synthetic question'},image],explanation_blocks:[{type:'text',text:'Synthetic explanation'}],source_text:null,source_references:[{kind:'book',title:'Synthetic source',section:'Synthetic heading'}],accepted_answers:j===9?['試験']:[],input_constraints:j===9?{script:'kanji',exact_length:2,ignore_book_brackets:true}:{},passage_references:[{passage_id:g.archive_id,anchor_id:null}],choices:j===9?[]:configuration.exam.choice_labels.map((l,k)=>({choice_label:l,content_blocks:[{type:'text',text:'Synthetic choice '+k}],is_correct:k===0,display_order:k+1}))})))
 return createArchiveV2({exam_sets:[{exam_number:2,title:'Synthetic mock',format_code:'rekiken2_mock',publication_status:'draft'}],groups,questions})
}
test('50 question format retains image and 45 choice/5 short archive',()=>{const a=fixture();assert.equal(a.question_count,50);assert.equal(a.choice_count,180);assert.deepEqual(validateBlocks([image],'question',true),[image]);assert.throws(()=>validateBlocks([{...image,src:'https://example.invalid/a.png'}],'question',true));assert.throws(()=>validateBlocks([{...image,src:'data:image/svg+xml;base64,abc'}],'question',true))})
test('book brackets are ignored only for explicitly configured questions',()=>{assert.equal(normalizeAnswerText('『試験』',{ignore_book_brackets:true}),'試験');assert.equal(normalizeAnswerText('『試験』'),'『試験』');assert.equal(checkTextConstraints('『試験』',{ignore_book_brackets:true,script:'kanji',exact_length:2}),true);assert.equal(checkTextConstraints('『試験』',{script:'kanji',exact_length:2}),false)})
test('50 question archive publishes with fifth group and hides answers', {skip:!process.env.TEST_DATABASE_URL},async()=>{
 assert.match(new URL(process.env.TEST_DATABASE_URL!).pathname,/_test$/);const c=await getDatabase().connect();await c.query('BEGIN')
 try{await c.query(`CREATE SCHEMA "rekiken_${randomUUID().replaceAll('-','')}"`);const schema=(await c.query("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'rekiken_%' ORDER BY oid DESC LIMIT 1")).rows[0].nspname;await c.query(`SET LOCAL search_path TO "${schema}"`);await migrate(c);await importArchiveV2(fixture(),c);const s=await loadExamSet(2,c);assert.equal(s.groups.length,5);assert.deepEqual((await validateExamSet(2,c)).errors,[]);await publishExamSet(2,s.lock_version,{db:c});const q=s.groups[4]!.questions![9];const view=(await getQuestion(q.id,null,c)).data;assert.equal(view.answer_type,'short_text');assert.equal('accepted_answers'in view,false);assert.equal('explanation_blocks'in view,false);assert.equal(view.content_blocks[1]!.type,'image')
 }finally{await c.query('ROLLBACK');c.release()}
})
