import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = (path: string) => readFileSync(new URL(`../app/${path}`, import.meta.url), 'utf8')
const layout = source('layouts/default.vue')
const header = source('components/SiteHeader.vue')
const sidebar = source('components/ExamSidebar.vue')

test('one shared exam sidebar is rendered inside the sticky site header', () => {
  assert.equal(layout.match(/<ExamSidebar\b/g)?.length, 1)
  assert.match(layout, /<SiteHeader>\s*<ExamSidebar v-model:collapsed="sidebarCollapsed"\s*\/>\s*<\/SiteHeader>/)
  assert.match(layout, /grid-template-columns: var\(--exam-sidebar-width\) minmax\(0, 1fr\)/)
  assert.match(layout, /\.app-shell.sidebar-collapsed\s*\{ --exam-sidebar-width: 64px;/)
  assert.match(header, /<slot\s*\/>\s*<\/header>/)
  assert.match(header, /\.site-header\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;/)
})

test('horizontal sidebar controls start expanded on desktop and closed on mobile', () => {
  assert.match(layout, /const sidebarCollapsed = ref\(false\)/)
  assert.match(sidebar, /defineModel<boolean>\('collapsed', \{ default: false \}\)/)
  assert.match(sidebar, /:aria-expanded="!collapsed"/)
  assert.match(sidebar, /const mobileOpen = ref\(false\)/)
  assert.match(sidebar, /:aria-expanded="mobileOpen"/)
  assert.match(sidebar, /aria-controls="exam-sidebar-content"/)
  assert.match(sidebar, /id="exam-sidebar-content"/)
  assert.match(sidebar, /:aria-expanded="openExam === exam.exam_number"/)
  assert.match(sidebar, /:inert="isMobile \? !mobileOpen : collapsed"/)
  assert.match(sidebar, /\.mobile-open \.sidebar-content\s*\{ display: block; \}/)
  assert.match(sidebar, /mobileOpen \? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'/)
  assert.doesNotMatch(sidebar, /aria-modal|role="dialog"/)
})

test('navigation closes the mobile list and shares the published catalog', () => {
  assert.match(sidebar, /watch\(\(\) => route.fullPath, closeMobileList\)/)
  assert.equal(sidebar.match(/@click="closeMobileList"/g)?.length, 3)
  assert.match(sidebar, /@keydown.esc.prevent="closeMobilePanel"/)
  assert.match(sidebar, /mobileToggle.value\?\.focus\(\)/)
  assert.doesNotMatch(sidebar, /keepMobileFocus|sidebar-backdrop|document.body.style.overflow/)
  assert.match(sidebar, /mobileQuery\?\.removeEventListener\('change', updateViewport\)/)
  assert.match(sidebar, /usePracticeFilterCatalog\(/)
  assert.doesNotMatch(sidebar, /\b(?:useFetch|useApi|\$fetch)\s*\(/)
})

test('sidebar labels mock exams and links published groups without listing child questions', () => {
  assert.match(sidebar, /catalogExamLabel\(exam.exam_number\)/)
  assert.match(sidebar, /catalogGroupLinks\(exam\)/)
  assert.match(sidebar, /v-for="entry in exam.groupLinks"/)
  assert.match(sidebar, /catalogGroupLabel\(entry.group\)/)
  assert.match(sidebar, /isCatalogGroupActive\(exam, group,/)
  assert.match(sidebar, /:to="entry.to"/)
  assert.doesNotMatch(sidebar, /v-for="question in exam.question_numbers"/)
  assert.doesNotMatch(sidebar, /exam.title\s*\|\|/)
  assert.match(sidebar, /v-else-if="!exams.length"/)
  assert.match(sidebar, /createSidebarExamCatalog\(/)
  assert.doesNotMatch(sidebar, /v-if="exam.groupLinks.length"/)
  assert.match(sidebar, /プレミアム会員で利用/)
  assert.match(sidebar, /演習を開始/)
})

test('group titles wrap within the sidebar and keep comfortable link targets', () => {
  assert.match(sidebar, /\.group-list a\s*\{[^}]*min-width:\s*0;[^}]*min-height:\s*44px;[^}]*overflow-wrap:\s*anywhere;/)
  assert.match(sidebar, /\.exam-link\s*\{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;/)
})

test('home anchor leaves room for both mobile header rows', () => {
  assert.match(layout, /--site-navigation-height: calc\(var\(--header-height\) \+ var\(--exam-toggle-height\)\)/)
  assert.match(source('pages/index.vue'), /scroll-margin-top: calc\(var\(--site-navigation-height, var\(--header-height\)\) \+ 20px\)/)
})

test('mobile exams open below the header in a scrollable two-column accordion', () => {
  const mobileStyles = sidebar.split('@media (max-width: 760px)')[1]
  assert.ok(mobileStyles)
  assert.match(sidebar, /v-else class="exam-groups"/)
  assert.match(mobileStyles, /\.exam-groups\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(mobileStyles, /\.sidebar-content\s*\{[^}]*display: none;[^}]*position: absolute;[^}]*inset: 100% 0 auto;/)
  assert.match(mobileStyles, /max-height: min\([^;]*100dvh/)
  assert.doesNotMatch(mobileStyles, /position: fixed|translateX/)
  assert.match(mobileStyles, /\.exam-group:nth-child\(even\) \.group-list\s*\{[^}]*margin-left: calc\(-100% - var\(--exam-grid-gap\)\)/)
  assert.match(mobileStyles, /\.group-list\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(mobileStyles, /overflow-y: auto/)
})
