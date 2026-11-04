import test from 'node:test'
import assert from 'node:assert/strict'
import { filterReviewPositions, selectReviewPositions } from '../app/utils/reviewPositions.ts'
test('review retains only exact public exam-question pairs and rejects malformed selections', () => {
 const positions = [{examNumber:1,questionNumber:3},{examNumber:1,questionNumber:4},{examNumber:2,questionNumber:3},{examNumber:2,questionNumber:4}]
 assert.deepEqual(filterReviewPositions(positions,'1.3,2.4'),[positions[0],positions[3]])
 assert.deepEqual(filterReviewPositions(positions,'6.3'),[])
 for (const value of ['', 'bad', ['1.3'], '1.3,'.repeat(501)]) assert.deepEqual(filterReviewPositions(positions,value),[])
 assert.deepEqual(filterReviewPositions(positions,undefined),positions)
})

test('review excludes locked catalog rows while retaining exact public positions',()=>{
 assert.deepEqual(selectReviewPositions([{exam_number:1,question_numbers:[3,4]},{exam_number:6,question_numbers:[3],access:'paid_membership_required'}],[1,6],undefined,'1.3,6.3'),[{examNumber:1,questionNumber:3}])
})
