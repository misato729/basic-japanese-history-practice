import { syncCategories } from '../server/operations/categories.ts'
import { closeDatabase } from '../server/core/db.ts'
try {
  if (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') throw new Error()
  console.log(JSON.stringify(await syncCategories()))
} catch {
  console.error('Category synchronization failed; no source text or credentials are logged.')
  process.exitCode = 1
} finally { await closeDatabase() }
