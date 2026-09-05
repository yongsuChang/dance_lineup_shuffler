import { Database, Home, Settings as SettingsIcon } from 'lucide-react'
import { useStore, type Page } from '@/store/useStore'
import { cx } from './components/ui'
import { HomePage } from './pages/HomePage'
import { DataPage } from './pages/DataPage'
import { SettingsPage } from './pages/SettingsPage'

const NAV: { id: Page; label: string; icon: typeof Home }[] = [
  { id: 'home', label: '발표 순서', icon: Home },
  { id: 'data', label: '데이터', icon: Database },
  { id: 'settings', label: '설정', icon: SettingsIcon },
]

export function App() {
  const page = useStore((s) => s.page)
  const setPage = useStore((s) => s.setPage)
  const db = useStore((s) => s.db)

  return (
    <div className="flex min-h-full">
      <aside className="no-print flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="px-5 py-5">
          <div className="text-base font-bold tracking-tight">Lineup Shuffler</div>
          <div className="text-xs text-zinc-500">
            {db.settings.year}년 {db.settings.semester}학기
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 px-2">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPage(id)}
              className={cx(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                page === id
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto px-5 py-4 text-xs text-zinc-500">
          <div>반 {db.classes.length} · 학생 {db.students.length} · 페어 {db.pairs.length}</div>
          <div className="mt-1">데이터는 이 브라우저에만 저장됩니다.</div>
        </div>
      </aside>
      <main className="print-full min-w-0 flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-6 py-6">
          {page === 'home' && <HomePage />}
          {page === 'data' && <DataPage />}
          {page === 'settings' && <SettingsPage />}
        </div>
      </main>
    </div>
  )
}
