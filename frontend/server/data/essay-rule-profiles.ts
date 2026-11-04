import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import type { EssayScoringProfile } from '../../shared/types/essay.ts'
import { validateEssayProfile } from '../services/essay-scoring.ts'

// Nitro bundles modules into .nuxt/.output, so this path must not depend on the
// emitted module URL. Both package scripts and Docker run from frontend/.
const applicationDirectory = existsSync(resolve(process.cwd(), 'frontend/package.json')) ? resolve(process.cwd(), 'frontend') : process.cwd()
export const defaultEssayRuleProfilesPath = resolve(applicationDirectory, 'local-only/essay-rule-profiles.json')
const MAX_CATALOG_BYTES = 8 * 1024 * 1024
const MAX_PROFILES = 1000

/** Subject rules remain in a local-only file, outside Git and Docker build contexts. */
export function loadEssayRuleProfiles(path = process.env.ESSAY_RULE_PROFILES_PATH || defaultEssayRuleProfilesPath): EssayScoringProfile[] {
  let content: string
  try {
    const file = statSync(path)
    if (!file.isFile() || file.size > MAX_CATALOG_BYTES) throw new Error()
    content = readFileSync(path, 'utf8')
    if (Buffer.byteLength(content) > MAX_CATALOG_BYTES) throw new Error()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    // Do not include a parser message or file content in server logs.
    throw new Error('論述採点基準ファイルを読み込めません。配置・サイズ・権限を確認してください。')
  }
  try {
    const catalog: unknown = JSON.parse(content)
    if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) throw new Error()
    const value = catalog as Record<string, unknown>
    if (Object.keys(value).sort().join('\0') !== ['profiles', 'schema_version'].join('\0') || value.schema_version !== 1 || !Array.isArray(value.profiles) || value.profiles.length > MAX_PROFILES) throw new Error()
    const coordinates = new Set<string>()
    for (const profile of value.profiles) {
      validateEssayProfile(profile)
      const key = `${profile.id}:${profile.version}`
      if (coordinates.has(key)) throw new Error()
      coordinates.add(key)
    }
    return value.profiles
  } catch {
    throw new Error('論述採点基準ファイルのJSON形式・ルール・IDと版の重複を確認してください。')
  }
}

const catalogPath = () => resolve(process.env.ESSAY_RULE_PROFILES_PATH || defaultEssayRuleProfilesPath)
function catalogSignature(path: string): string {
  try {
    const file = statSync(path)
    return `${path}:${file.ino}:${file.size}:${file.mtimeMs}:${file.ctimeMs}`
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return `${path}:absent`
    throw new Error('論述採点基準ファイルを読み込めません。配置・サイズ・権限を確認してください。')
  }
}
function catalogSnapshot(path: string): { signature: string; profiles: EssayScoringProfile[] } {
  const signature = catalogSignature(path)
  const profiles = loadEssayRuleProfiles(path)
  if (signature !== catalogSignature(path)) throw new Error('論述採点基準ファイルの更新中です。再度お試しください。')
  return { signature, profiles }
}
const initialCatalog = catalogSnapshot(catalogPath())
let loadedSignature = initialCatalog.signature
// Keep one mutable array for the existing versioned lookup and isolated tests.
export const essayRuleProfiles: EssayScoringProfile[] = initialCatalog.profiles

/** Reload a validated catalog atomically; an invalid replacement is never served. */
export function getEssayRuleProfiles(): EssayScoringProfile[] {
  const path = catalogPath()
  const signature = catalogSignature(path)
  if (signature !== loadedSignature) {
    const replacement = catalogSnapshot(path)
    essayRuleProfiles.splice(0, essayRuleProfiles.length, ...replacement.profiles)
    loadedSignature = replacement.signature
  }
  return essayRuleProfiles
}

export function getEssayRuleProfile(id: string, version?: number): EssayScoringProfile | undefined {
  return getEssayRuleProfiles().find(profile => profile.id === id && (version === undefined || profile.version === version))
}
