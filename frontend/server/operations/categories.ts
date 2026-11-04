import { EXAM_CONFIG, parseExamConfig } from '../../shared/examConfig.ts'
import { transaction, query, type Database } from '../core/db.ts'

/** Explicit catalog synchronization. Unrelated rows and all learning data are preserved. */
export async function syncCategories(input: unknown = EXAM_CONFIG, database?: Database) {
  const { categories } = parseExamConfig(input)
  return transaction(async db => {
    await query('SELECT pg_advisory_xact_lock($1)', [71514347], db)
    for (const [order, item] of categories.major.entries()) {
      await query(`INSERT INTO major_categories(code,label,sort_order) VALUES($1,$2,$3)
        ON CONFLICT(code) DO UPDATE SET label=EXCLUDED.label,sort_order=EXCLUDED.sort_order`, [item.value,item.label,order], db)
    }
    for (const [order, item] of categories.minor.entries()) {
      await query(`INSERT INTO minor_categories(code,major_category_code,label,sort_order) VALUES($1,$2,$3,$4)
        ON CONFLICT(code) DO UPDATE SET major_category_code=EXCLUDED.major_category_code,label=EXCLUDED.label,sort_order=EXCLUDED.sort_order`, [item.value,item.major_category_value,item.label,order], db)
    }
    return { major: categories.major.length, minor: categories.minor.length }
  }, database)
}
