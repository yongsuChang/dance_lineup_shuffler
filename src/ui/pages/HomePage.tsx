import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AlertTriangle, Camera, CheckCircle2, Download, GripVertical, Lock, LockOpen, Printer, RefreshCw, Shuffle } from 'lucide-react'
import { useMemo } from 'react'
import { photographerCounts, type Schedule, type Slot, type Violation } from '@/engine'
import { exportScheduleXlsx } from '@/export/xlsx'
import { selectors, useStore } from '@/store/useStore'
import { Badge, Button, Card, Empty, cx } from '../components/ui'

const VIOLATION_LABEL: Record<Violation['kind'], string> = {
  double_booking: '같은 슬롯 중복 출연',
  rest: '휴식 부족',
  consecutive_class: '같은 반 연속',
  photo_unassigned: '사진 담당 미배정',
  photo_gap: '사진 담당 휴식 부족',
}

export function HomePage() {
  const db = useStore((s) => s.db)
  const schedule = useStore((s) => s.schedule)
  const locked = useStore((s) => s.lockedSlotIds)
  const { shuffle, reshuffle, moveSlot, setPage } = useStore()

  const ready = db.pairs.length > 0 && db.classes.length > 0
  const violationsBySlot = useMemo(() => {
    const m = new Map<number, Violation[]>()
    for (const v of schedule?.violations ?? []) (m.get(v.slotIndex) ?? m.set(v.slotIndex, []).get(v.slotIndex)!).push(v)
    return m
  }, [schedule])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const onDragEnd = (e: DragEndEvent) => {
    if (!schedule || !e.over || e.active.id === e.over.id) return
    const ids = schedule.slots.map((s) => s.id)
    const from = ids.indexOf(String(e.active.id))
    const to = ids.indexOf(String(e.over.id))
    if (from >= 0 && to >= 0) moveSlot(from, to)
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">발표 순서</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {ready ? `${db.classes.length}개 반 · 페어 ${db.pairs.length}개 · 중간 슬롯 ${db.classes.reduce((a, c) => a + c.teamCount, 0)}개` : '먼저 데이터 페이지에서 반과 페어를 등록하세요.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {schedule && (
            <>
              <Button onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> 인쇄
              </Button>
              <Button onClick={() => exportScheduleXlsx(db, schedule)}>
                <Download className="h-4 w-4" /> 엑셀
              </Button>
              <Button onClick={reshuffle} disabled={!ready} title="고정한 슬롯은 유지하고 나머지만 다시 섞습니다">
                <RefreshCw className="h-4 w-4" /> 재셔플{locked.length > 0 && ` (${locked.length}개 고정)`}
              </Button>
            </>
          )}
          <Button variant="primary" size={schedule ? 'md' : 'lg'} onClick={ready ? shuffle : () => setPage('data')}>
            <Shuffle className="h-4 w-4" /> {ready ? (schedule ? '새로 생성' : '발표 순서 생성') : '데이터 등록하기'}
          </Button>
        </div>
      </header>

      {!schedule ? (
        <Empty>
          {ready ? '아직 생성된 순서가 없습니다. 위의 버튼을 눌러 생성하세요.' : '반, 학생, 페어를 등록하면 순서를 만들 수 있습니다.'}
        </Empty>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-2">
            <div className="hidden print:block">
              <h1 className="text-xl font-bold">
                {db.settings.year}년 {db.settings.semester}학기 발표 순서
              </h1>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={schedule.slots.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {schedule.slots.map((slot, i) => (
                  <SlotRow key={slot.id} slot={slot} index={i} violations={violationsBySlot.get(i) ?? []} locked={locked.includes(slot.id)} />
                ))}
              </SortableContext>
            </DndContext>
            <p className="no-print mt-1 text-xs text-zinc-500">행을 끌어 순서를 직접 바꿀 수 있습니다. 자물쇠를 켜면 재셔플 때 그 자리를 유지합니다.</p>
          </div>
          <aside className="no-print flex flex-col gap-4">
            <ViolationPanel schedule={schedule} />
            <PhotographerPanel schedule={schedule} />
          </aside>
        </div>
      )}
    </div>
  )
}

function SlotRow({ slot, index, violations, locked }: { slot: Slot; index: number; violations: Violation[]; locked: boolean }) {
  const db = useStore((s) => s.db)
  const toggleLock = useStore((s) => s.toggleLock)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: slot.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const hard = violations.some((v) => v.kind === 'double_booking' || v.kind === 'rest')

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cx(
        'flex items-stretch gap-3 rounded-lg bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800 print:break-inside-avoid print:ring-zinc-400',
        isDragging && 'z-10 shadow-lg',
        violations.length > 0 && (hard ? 'ring-rose-300 dark:ring-rose-900' : 'ring-amber-300 dark:ring-amber-900'),
        locked && 'bg-indigo-50/60 dark:bg-indigo-950/30',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="no-print flex w-8 shrink-0 cursor-grab items-center justify-center rounded-l-lg text-zinc-400 hover:bg-zinc-100 active:cursor-grabbing dark:hover:bg-zinc-800"
        aria-label="순서 이동"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex w-10 shrink-0 items-center justify-center text-lg font-bold tabular-nums text-zinc-700 dark:text-zinc-200">{index + 1}</div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold">{selectors.className(db, slot.classId)}</span>
          {slot.kind === 'opening' && <Badge tone="sky">오프닝</Badge>}
          {slot.kind === 'ending' && <Badge tone="sky">엔딩</Badge>}
          {violations.map((v, i) => (
            <Badge key={i} tone={v.kind === 'double_booking' || v.kind === 'rest' ? 'rose' : 'amber'} className="print:hidden">
              {VIOLATION_LABEL[v.kind]}
            </Badge>
          ))}
        </div>
        <ul className="grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2">
          {slot.pairIds.map((pid) => {
            const p = db.pairs.find((x) => x.id === pid)
            if (!p) return null
            const photographer = selectors.nickname(db, slot.photographers[pid])
            return (
              <li key={pid} className="flex items-center justify-between gap-3">
                <span className="truncate">
                  {selectors.nickname(db, p.leaderId)}
                  {p.followerId ? <span className="text-zinc-400"> & </span> : null}
                  {p.followerId ? selectors.nickname(db, p.followerId) : <span className="text-zinc-400"> (솔로)</span>}
                </span>
                <span className={cx('flex shrink-0 items-center gap-1 text-xs', photographer ? 'text-zinc-500' : 'text-rose-500')}>
                  <Camera className="h-3.5 w-3.5" /> {photographer || '미배정'}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
      <button
        type="button"
        onClick={() => toggleLock(slot.id)}
        className={cx('no-print flex w-10 shrink-0 items-center justify-center rounded-r-lg transition-colors', locked ? 'text-indigo-600' : 'text-zinc-300 hover:text-zinc-500')}
        title={locked ? '고정 해제' : '이 자리에 고정'}
      >
        {locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
      </button>
    </div>
  )
}

function ViolationPanel({ schedule }: { schedule: Schedule }) {
  const grouped = useMemo(() => {
    const m = new Map<Violation['kind'], Violation[]>()
    for (const v of schedule.violations) (m.get(v.kind) ?? m.set(v.kind, []).get(v.kind)!).push(v)
    return [...m.entries()]
  }, [schedule])

  if (schedule.violations.length === 0)
    return (
      <Card>
        <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5" /> 모든 제약을 만족합니다.
        </div>
      </Card>
    )
  return (
    <Card title={`지키지 못한 제약 ${schedule.violations.length}건`}>
      <div className="flex flex-col gap-3">
        {grouped.map(([kind, list]) => (
          <div key={kind}>
            <div className="mb-1 flex items-center gap-1.5 text-sm font-medium">
              <AlertTriangle className={cx('h-4 w-4', kind === 'rest' || kind === 'double_booking' ? 'text-rose-500' : 'text-amber-500')} />
              {VIOLATION_LABEL[kind]} <span className="text-zinc-400">{list.length}</span>
            </div>
            <ul className="flex flex-col gap-0.5 pl-5 text-xs text-zinc-600 dark:text-zinc-400">
              {list.map((v, i) => (
                <li key={i}>{v.message}</li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-xs text-zinc-500">재셔플하거나 행을 직접 옮겨 보세요. 데이터상 불가능한 제약이면 페어 구성이나 팀 수를 조정해야 합니다.</p>
      </div>
    </Card>
  )
}

function PhotographerPanel({ schedule }: { schedule: Schedule }) {
  const db = useStore((s) => s.db)
  const counts = useMemo(
    () =>
      [...photographerCounts(schedule).entries()]
        .map(([id, n]) => ({ name: selectors.nickname(db, id), n }))
        .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)),
    [schedule, db],
  )
  if (counts.length === 0) return null
  return (
    <Card title={`사진 담당 ${counts.length}명`}>
      <ul className="flex flex-wrap gap-1.5">
        {counts.map((c) => (
          <li key={c.name}>
            <Badge tone={c.n > 1 ? 'indigo' : 'zinc'}>
              {c.name} {c.n > 1 && `×${c.n}`}
            </Badge>
          </li>
        ))}
      </ul>
    </Card>
  )
}

