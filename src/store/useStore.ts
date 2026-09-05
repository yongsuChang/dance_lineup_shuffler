import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  emptyDatabase,
  generateSchedule,
  newId,
  reevaluate,
  type DanceClass,
  type Database,
  type Pair,
  type Schedule,
  type Settings,
  type Student,
} from '@/engine'
import type { ParsedPair, ParsedStudent } from '@/import/paste'

export type Page = 'home' | 'data' | 'settings'

interface State {
  db: Database
  schedule: Schedule | null
  lockedSlotIds: string[]
  page: Page

  setPage(p: Page): void
  updateSettings(patch: Partial<Settings>): void

  upsertClass(c: Omit<DanceClass, 'id'> & { id?: string }): DanceClass
  removeClass(id: string): void
  upsertStudent(s: Omit<Student, 'id'> & { id?: string }): Student
  removeStudent(id: string): void
  upsertPair(p: Omit<Pair, 'id'> & { id?: string }): Pair
  removePair(id: string): void

  importStudents(list: ParsedStudent[]): { added: number; skipped: number }
  importPairs(list: ParsedPair[]): { added: number; skipped: number; createdStudents: number }
  replaceDatabase(db: Database): void
  resetAll(): void

  shuffle(): void
  reshuffle(): void
  toggleLock(slotId: string): void
  moveSlot(from: number, to: number): void
  clearSchedule(): void
}

const touch = (db: Database): Database => ({ ...db })

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      db: emptyDatabase(),
      schedule: null,
      lockedSlotIds: [],
      page: 'home',

      setPage: (page) => set({ page }),
      updateSettings: (patch) => set((s) => ({ db: { ...s.db, settings: { ...s.db.settings, ...patch } } })),

      upsertClass: (c) => {
        const db = get().db
        const cls: DanceClass = { id: c.id ?? newId(), name: c.name.trim(), teamCount: Math.max(1, Math.floor(c.teamCount) || 1) }
        const exists = db.classes.some((x) => x.id === cls.id)
        set({ db: touch({ ...db, classes: exists ? db.classes.map((x) => (x.id === cls.id ? cls : x)) : [...db.classes, cls] }) })
        return cls
      },
      removeClass: (id) => {
        const db = get().db
        set({
          db: touch({
            ...db,
            classes: db.classes.filter((c) => c.id !== id),
            students: db.students.map((s) => ({ ...s, classIds: s.classIds.filter((c) => c !== id) })),
            pairs: db.pairs.filter((p) => p.classId !== id),
          }),
        })
      },

      upsertStudent: (s) => {
        const db = get().db
        const st: Student = { ...s, id: s.id ?? newId(), nickname: s.nickname.trim() }
        const exists = db.students.some((x) => x.id === st.id)
        set({ db: touch({ ...db, students: exists ? db.students.map((x) => (x.id === st.id ? st : x)) : [...db.students, st] }) })
        return st
      },
      removeStudent: (id) => {
        const db = get().db
        set({
          db: touch({
            ...db,
            students: db.students.filter((s) => s.id !== id),
            pairs: db.pairs.filter((p) => p.leaderId !== id && p.followerId !== id),
          }),
        })
      },

      upsertPair: (p) => {
        const db = get().db
        const pair: Pair = { ...p, id: p.id ?? newId() }
        const exists = db.pairs.some((x) => x.id === pair.id)
        set({ db: touch({ ...db, pairs: exists ? db.pairs.map((x) => (x.id === pair.id ? pair : x)) : [...db.pairs, pair] }) })
        return pair
      },
      removePair: (id) => set((s) => ({ db: touch({ ...s.db, pairs: s.db.pairs.filter((p) => p.id !== id) }) })),

      importStudents: (list) => {
        const db = structuredClone(get().db)
        let added = 0
        let skipped = 0
        for (const it of list) {
          const cls = ensureClass(db, it.className)
          const existing = db.students.find((s) => s.nickname === it.nickname)
          if (existing) {
            if (!existing.classIds.includes(cls.id)) {
              existing.classIds.push(cls.id)
              added++
            } else skipped++
            continue
          }
          db.students.push({ id: newId(), nickname: it.nickname, role: it.role, classIds: [cls.id], isStaff: false, isNewbie: false, excludeFromPhoto: false })
          added++
        }
        set({ db })
        return { added, skipped }
      },

      importPairs: (list) => {
        const db = structuredClone(get().db)
        let added = 0
        let skipped = 0
        let createdStudents = 0
        for (const it of list) {
          const cls = ensureClass(db, it.className)
          const find = (name: string, role: Student['role']) => {
            let st = db.students.find((s) => s.nickname === name)
            if (!st) {
              st = { id: newId(), nickname: name, role, classIds: [cls.id], isStaff: false, isNewbie: false, excludeFromPhoto: false }
              db.students.push(st)
              createdStudents++
            } else if (!st.classIds.includes(cls.id)) st.classIds.push(cls.id)
            return st
          }
          const leader = find(it.leader, 'leader')
          const follower = it.follower ? find(it.follower, 'follower') : null
          const dup = db.pairs.some((p) => p.classId === cls.id && p.leaderId === leader.id && p.followerId === (follower?.id ?? null))
          if (dup) {
            skipped++
            continue
          }
          db.pairs.push({ id: newId(), classId: cls.id, leaderId: leader.id, followerId: follower?.id ?? null, isOpening: false, isEnding: false })
          added++
        }
        set({ db })
        return { added, skipped, createdStudents }
      },

      replaceDatabase: (db) => set({ db, schedule: null, lockedSlotIds: [] }),
      resetAll: () => set({ db: emptyDatabase(), schedule: null, lockedSlotIds: [] }),

      shuffle: () => set({ schedule: generateSchedule(get().db), lockedSlotIds: [] }),
      reshuffle: () => {
        const { db, schedule, lockedSlotIds } = get()
        const next = generateSchedule(db, { previous: schedule ?? undefined, lockedSlotIds: new Set(lockedSlotIds) })
        const keep = new Set(next?.slots.map((s) => s.id) ?? [])
        set({ schedule: next, lockedSlotIds: lockedSlotIds.filter((id) => keep.has(id)) })
      },
      toggleLock: (slotId) =>
        set((s) => ({
          lockedSlotIds: s.lockedSlotIds.includes(slotId) ? s.lockedSlotIds.filter((x) => x !== slotId) : [...s.lockedSlotIds, slotId],
        })),
      moveSlot: (from, to) => {
        const { db, schedule, lockedSlotIds } = get()
        if (!schedule || from === to) return
        const slots = [...schedule.slots]
        const [moved] = slots.splice(from, 1)
        slots.splice(to, 0, moved)
        set({ schedule: reevaluate(db, slots, new Set(lockedSlotIds), schedule.seed) })
      },
      clearSchedule: () => set({ schedule: null, lockedSlotIds: [] }),
    }),
    { name: 'dance-lineup-shuffler:v2', version: 1 },
  ),
)

function ensureClass(db: Database, name: string): DanceClass {
  const key = name.trim()
  let cls = db.classes.find((c) => c.name === key)
  if (!cls) {
    cls = { id: newId(), name: key, teamCount: 1 }
    db.classes.push(cls)
  }
  return cls
}

/** 파생 조회 헬퍼 */
export const selectors = {
  className: (db: Database, id: string) => db.classes.find((c) => c.id === id)?.name ?? '(삭제된 반)',
  student: (db: Database, id: string | null | undefined) => (id ? db.students.find((s) => s.id === id) : undefined),
  nickname: (db: Database, id: string | null | undefined) => (id ? (db.students.find((s) => s.id === id)?.nickname ?? '(알 수 없음)') : ''),
}
