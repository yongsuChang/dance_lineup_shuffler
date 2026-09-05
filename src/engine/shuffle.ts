/**
 * 발표 순서 생성 엔진.
 *
 * 1. 반별로 페어를 teamCount 개의 팀(슬롯)으로 나눈다. 한 사람이 같은 팀에 두 번 들어가는 것만 하드 제약이다.
 * 2. 오프닝은 맨 앞, 엔딩은 맨 뒤에 고정하고, 중간 슬롯의 순서를 페널티 점수 기반 국소 탐색으로 최적화한다.
 *    - 휴식 부족 (역할별 최소 휴식 슬롯 수)
 *    - 같은 반 연속 배치
 * 3. 슬롯마다 사진 담당을 배정한다 (해당 슬롯과 앞뒤 photoGap 슬롯에서 춤추지 않는 사람, 배정 횟수가 적은 사람 우선).
 * 4. 지키지 못한 제약은 모두 violations 로 돌려준다.
 */
import type { Database, DanceClass, Pair, Schedule, Slot, Student, Violation } from './types'
import { createRng, newId, randomSeed, type Rng } from './util'

export interface ShuffleOptions {
  seed?: number
  /** 재셔플 시 이전 결과와 고정 슬롯. 고정된 슬롯은 내용과 위치를 그대로 유지한다. */
  previous?: Schedule
  lockedSlotIds?: ReadonlySet<string>
  restarts?: number
  iterations?: number
}

const WEIGHT = { doubleBooking: 100, rest: 10, consecutive: 3, photoUnassigned: 5, photoGap: 1 }

interface Ctx {
  db: Database
  studentById: Map<string, Student>
  pairById: Map<string, Pair>
  classById: Map<string, DanceClass>
}

function buildCtx(db: Database): Ctx {
  return {
    db,
    studentById: new Map(db.students.map((s) => [s.id, s])),
    pairById: new Map(db.pairs.map((p) => [p.id, p])),
    classById: new Map(db.classes.map((c) => [c.id, c])),
  }
}

export function dancersOfPair(pair: Pair): string[] {
  return pair.followerId ? [pair.leaderId, pair.followerId] : [pair.leaderId]
}

/** 중복 포함 (더블 부킹 검출용) */
function dancersOfSlot(ctx: Ctx, slot: Slot): string[] {
  const out: string[] = []
  for (const pid of slot.pairIds) {
    const p = ctx.pairById.get(pid)
    if (p) out.push(...dancersOfPair(p))
  }
  return out
}

function nick(ctx: Ctx, id: string): string {
  return ctx.studentById.get(id)?.nickname ?? '(알 수 없음)'
}

function className(ctx: Ctx, id: string): string {
  return ctx.classById.get(id)?.name ?? '(삭제된 반)'
}

// ---------------------------------------------------------------------------
// 평가
// ---------------------------------------------------------------------------

interface Evaluation {
  score: number
  violations: Violation[]
}

/** 순서에 대한 페널티: 더블 부킹, 휴식 부족, 같은 반 연속 */
export function evaluateOrder(ctx: Ctx, slots: readonly Slot[]): Evaluation {
  const { minRestLeader, minRestFollower } = ctx.db.settings
  const violations: Violation[] = []
  let score = 0
  const lastIdx = new Map<string, number>()

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    const seen = new Set<string>()
    for (const d of dancersOfSlot(ctx, slot)) {
      if (seen.has(d)) {
        score += WEIGHT.doubleBooking
        violations.push({
          kind: 'double_booking',
          slotIndex: i,
          studentId: d,
          message: `${nick(ctx, d)}님이 ${i + 1}번 슬롯의 두 페어에 동시에 들어 있습니다`,
        })
        continue
      }
      seen.add(d)
      const last = lastIdx.get(d)
      if (last !== undefined) {
        const gap = i - last - 1
        const role = ctx.studentById.get(d)?.role ?? 'leader'
        const req = role === 'leader' ? minRestLeader : minRestFollower
        if (gap < req) {
          score += WEIGHT.rest * (req - gap)
          violations.push({
            kind: 'rest',
            slotIndex: i,
            studentId: d,
            message: `${nick(ctx, d)}님 휴식 부족: ${last + 1}번 → ${i + 1}번 (휴식 ${gap}턴, 최소 ${req}턴)`,
          })
        }
      }
      lastIdx.set(d, i)
    }

    if (i > 0) {
      const prev = slots[i - 1]
      const involvesMiddle = prev.kind === 'middle' || slot.kind === 'middle'
      if (involvesMiddle && prev.classId === slot.classId) {
        score += WEIGHT.consecutive
        violations.push({
          kind: 'consecutive_class',
          slotIndex: i,
          message: `${className(ctx, slot.classId)} 반이 ${i}번, ${i + 1}번에 연속 배치되었습니다`,
        })
      }
    }
  }
  return { score, violations }
}

// ---------------------------------------------------------------------------
// 팀 나누기
// ---------------------------------------------------------------------------

function makeSlot(classId: string, kind: Slot['kind'], pairIds: string[] = []): Slot {
  return { id: newId(), classId, pairIds, kind, photographers: {} }
}

/** 한 반의 페어들을 teamCount 개 팀으로 나눈다. 같은 사람이 한 팀에 두 번 들어가지 않도록 최대한 피한다. */
function partitionClass(classId: string, pairs: Pair[], teamCount: number, rng: Rng): Slot[] {
  const n = Math.max(1, Math.min(teamCount, pairs.length))
  const teams: Slot[] = Array.from({ length: n }, () => makeSlot(classId, 'middle'))
  const teamDancers: Set<string>[] = teams.map(() => new Set())

  for (const p of rng.shuffle([...pairs])) {
    const ds = dancersOfPair(p)
    const order = teams.map((_, i) => i).sort((a, b) => teams[a].pairIds.length - teams[b].pairIds.length)
    const noConflict = order.filter((i) => ds.every((d) => !teamDancers[i].has(d)))
    // 1) 충돌 없는 팀 중 가장 작은 팀 2) 없으면 가장 작은 팀 (더블 부킹 감수)
    const target = noConflict[0] ?? order[0]
    teams[target].pairIds.push(p.id)
    ds.forEach((d) => teamDancers[target].add(d))
  }
  return teams.filter((t) => t.pairIds.length > 0)
}

// ---------------------------------------------------------------------------
// 순서 최적화 (국소 탐색 + 담금질)
// ---------------------------------------------------------------------------

/** 이전 반과 다른 반을 우선하되 남은 팀이 많은 반부터 뽑는 초기 배열 */
function interleaveByClass(slots: Slot[], rng: Rng): Slot[] {
  const groups = new Map<string, Slot[]>()
  for (const s of rng.shuffle([...slots])) (groups.get(s.classId) ?? groups.set(s.classId, []).get(s.classId)!).push(s)
  const out: Slot[] = []
  let prev: string | null = null
  while (out.length < slots.length) {
    const avail = [...groups.entries()].filter(([, v]) => v.length > 0)
    let cands = avail.filter(([c]) => c !== prev)
    if (cands.length === 0) cands = avail
    const max = Math.max(...cands.map(([, v]) => v.length))
    const best = cands.filter(([, v]) => v.length === max)
    const [cls, list] = rng.pick(best)
    out.push(list.pop()!)
    prev = cls
  }
  return out
}

function hasDuplicateDancer(ctx: Ctx, pairIds: string[]): boolean {
  const seen = new Set<string>()
  for (const pid of pairIds) {
    const p = ctx.pairById.get(pid)
    if (!p) continue
    for (const d of dancersOfPair(p)) {
      if (seen.has(d)) return true
      seen.add(d)
    }
  }
  return false
}

/**
 * fixed 슬롯은 위치가 정해져 있고, free 슬롯을 freeIndices 자리에 배치한다.
 * 이동: (a) free 슬롯 두 개의 자리 교환 (b) 같은 반 free 슬롯 사이에서 페어 이동/교환
 */
function optimizeOrder(
  ctx: Ctx,
  fixed: Map<number, Slot>,
  free: Slot[],
  freeIndices: number[],
  rng: Rng,
  restarts: number,
  iterations: number,
): Slot[] {
  const total = fixed.size + free.length
  const assemble = (order: Slot[]): Slot[] => {
    const out: Slot[] = new Array(total)
    fixed.forEach((s, i) => (out[i] = s))
    freeIndices.forEach((idx, k) => (out[idx] = order[k]))
    return out
  }
  if (free.length === 0) return assemble([])

  const clone = (order: Slot[]) => order.map((s) => ({ ...s, pairIds: [...s.pairIds] }))
  let bestOrder = clone(interleaveByClass(free, rng))
  let bestScore = evaluateOrder(ctx, assemble(bestOrder)).score

  for (let r = 0; r < restarts && bestScore > 0; r++) {
    let cur = r === 0 ? clone(bestOrder) : clone(interleaveByClass(free, rng))
    let curScore = evaluateOrder(ctx, assemble(cur)).score
    for (let it = 0; it < iterations && curScore > 0; it++) {
      const temp = 4 * (1 - it / iterations) + 0.05
      const cand = clone(cur)
      if (!mutate(ctx, cand, rng)) break
      const s = evaluateOrder(ctx, assemble(cand)).score
      const delta = s - curScore
      if (delta <= 0 || rng.next() < Math.exp(-delta / temp)) {
        cur = cand
        curScore = s
        if (curScore < bestScore) {
          bestScore = curScore
          bestOrder = clone(cur)
        }
      }
    }
  }
  return assemble(bestOrder)
}

/** order 를 제자리에서 한 번 변형한다. 변형 불가능하면 false. */
function mutate(ctx: Ctx, order: Slot[], rng: Rng): boolean {
  if (order.length < 2) return movePairBetweenTeams(ctx, order, rng)
  if (rng.next() < 0.65 || !movePairBetweenTeams(ctx, order, rng)) {
    const i = rng.int(order.length)
    let j = rng.int(order.length - 1)
    if (j >= i) j++
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return true
}

function movePairBetweenTeams(ctx: Ctx, order: Slot[], rng: Rng): boolean {
  const byClass = new Map<string, Slot[]>()
  for (const s of order) (byClass.get(s.classId) ?? byClass.set(s.classId, []).get(s.classId)!).push(s)
  const multi = [...byClass.values()].filter((v) => v.length >= 2)
  if (multi.length === 0) return false
  const teams = rng.pick(multi)
  const a = rng.pick(teams)
  let b = rng.pick(teams)
  if (a === b) b = teams[(teams.indexOf(a) + 1) % teams.length]

  if (rng.next() < 0.5) {
    // 이동: a -> b (크기 차 1 이내 유지)
    if (a.pairIds.length - 1 < b.pairIds.length) return swapPairs(ctx, a, b, rng)
    const idx = rng.int(a.pairIds.length)
    const pid = a.pairIds[idx]
    if (hasDuplicateDancer(ctx, [...b.pairIds, pid])) return swapPairs(ctx, a, b, rng)
    a.pairIds.splice(idx, 1)
    b.pairIds.push(pid)
    return true
  }
  return swapPairs(ctx, a, b, rng)
}

function swapPairs(ctx: Ctx, a: Slot, b: Slot, rng: Rng): boolean {
  if (a.pairIds.length === 0 || b.pairIds.length === 0) return false
  const i = rng.int(a.pairIds.length)
  const j = rng.int(b.pairIds.length)
  const na = [...a.pairIds]
  const nb = [...b.pairIds]
  ;[na[i], nb[j]] = [nb[j], na[i]]
  if (hasDuplicateDancer(ctx, na) || hasDuplicateDancer(ctx, nb)) return false
  a.pairIds = na
  b.pairIds = nb
  return true
}

// ---------------------------------------------------------------------------
// 사진 담당 배정
// ---------------------------------------------------------------------------

function assignPhotographers(
  ctx: Ctx,
  slots: Slot[],
  rng: Rng,
  fixedSlotIds: ReadonlySet<string>,
): Violation[] {
  const { settings } = ctx.db
  const violations: Violation[] = []
  const eligible = ctx.db.students.filter(
    (s) =>
      !s.excludeFromPhoto &&
      !(settings.excludeStaffFromPhoto && s.isStaff) &&
      !(settings.excludeNewbiesFromPhoto && s.isNewbie),
  )
  const dancersAt = slots.map((s) => new Set(dancersOfSlot(ctx, s)))
  const counts = new Map<string, number>()
  const lastShot = new Map<string, number>()
  const gap = Math.max(0, settings.photoGap)

  const dancesNear = (id: string, i: number) => {
    for (let k = 1; k <= gap; k++) {
      if (dancersAt[i - k]?.has(id) || dancersAt[i + k]?.has(id)) return true
    }
    return false
  }

  // 고정 슬롯의 기존 배정을 먼저 반영
  slots.forEach((slot, i) => {
    if (!fixedSlotIds.has(slot.id)) return
    for (const [pid, sid] of Object.entries(slot.photographers)) {
      if (!sid || !ctx.studentById.has(sid) || !slot.pairIds.includes(pid)) continue
      counts.set(sid, (counts.get(sid) ?? 0) + 1)
      lastShot.set(sid, i)
    }
  })

  slots.forEach((slot, i) => {
    const fixed = fixedSlotIds.has(slot.id)
    const usedHere = new Set<string>(fixed ? Object.values(slot.photographers).filter((v): v is string => !!v) : [])
    const next: Record<string, string | null> = {}

    for (const pid of slot.pairIds) {
      if (fixed && pid in slot.photographers && slot.photographers[pid] && ctx.studentById.has(slot.photographers[pid]!)) {
        next[pid] = slot.photographers[pid]
        continue
      }
      const base = eligible.filter((s) => !dancersAt[i].has(s.id) && !usedHere.has(s.id))
      let cands = base.filter((s) => !dancesNear(s.id, i))
      let relaxed = false
      if (cands.length === 0 && base.length > 0) {
        cands = base
        relaxed = true
      }
      if (cands.length === 0) {
        next[pid] = null
        violations.push({ kind: 'photo_unassigned', slotIndex: i, message: `${i + 1}번 슬롯에 배정 가능한 사진 담당이 없습니다` })
        continue
      }
      const pick = rng
        .shuffle([...cands])
        .sort((a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0) || (lastShot.get(a.id) ?? -1) - (lastShot.get(b.id) ?? -1))[0]
      next[pid] = pick.id
      usedHere.add(pick.id)
      counts.set(pick.id, (counts.get(pick.id) ?? 0) + 1)
      lastShot.set(pick.id, i)
      if (relaxed) {
        violations.push({
          kind: 'photo_gap',
          slotIndex: i,
          studentId: pick.id,
          message: `${pick.nickname}님이 ${i + 1}번 촬영 직전/직후에 춤을 춥니다`,
        })
      }
    }
    slot.photographers = next
  })
  return violations
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

function finalize(ctx: Ctx, slots: Slot[], rng: Rng, seed: number, fixedPhotoSlotIds: ReadonlySet<string>): Schedule {
  const order = evaluateOrder(ctx, slots)
  const photo = assignPhotographers(ctx, slots, rng, fixedPhotoSlotIds)
  const photoScore = photo.reduce(
    (acc, v) => acc + (v.kind === 'photo_unassigned' ? WEIGHT.photoUnassigned : WEIGHT.photoGap),
    0,
  )
  return {
    slots,
    violations: [...order.violations, ...photo].sort((a, b) => a.slotIndex - b.slotIndex),
    score: order.score + photoScore,
    seed,
    generatedAt: new Date().toISOString(),
  }
}

export function generateSchedule(db: Database, opts: ShuffleOptions = {}): Schedule | null {
  const ctx = buildCtx(db)
  const seed = opts.seed ?? randomSeed()
  const rng = createRng(seed)
  const restarts = opts.restarts ?? 12
  const iterations = opts.iterations ?? 3000

  // 유효한 고정 슬롯 (존재하는 페어만 남김)
  const lockedIds = opts.lockedSlotIds ?? new Set<string>()
  const locked: { slot: Slot; index: number }[] = []
  if (opts.previous) {
    opts.previous.slots.forEach((s, index) => {
      if (!lockedIds.has(s.id)) return
      const pairIds = s.pairIds.filter((pid) => ctx.pairById.has(pid))
      if (pairIds.length === 0) return
      locked.push({ slot: { ...s, pairIds, photographers: { ...s.photographers } }, index })
    })
  }
  const lockedPairIds = new Set(locked.flatMap((l) => l.slot.pairIds))
  const freePairs = db.pairs.filter((p) => !lockedPairIds.has(p.id) && ctx.classById.has(p.classId))

  if (freePairs.length === 0 && locked.length === 0) return null

  const opening = freePairs.filter((p) => p.isOpening).map((p) => makeSlot(p.classId, 'opening', [p.id]))
  const ending = freePairs.filter((p) => p.isEnding && !p.isOpening).map((p) => makeSlot(p.classId, 'ending', [p.id]))
  const middlePairs = freePairs.filter((p) => !p.isOpening && !p.isEnding)

  const middle: Slot[] = []
  for (const cls of db.classes) {
    const pairs = middlePairs.filter((p) => p.classId === cls.id)
    if (pairs.length === 0) continue
    const lockedTeams = locked.filter((l) => l.slot.kind === 'middle' && l.slot.classId === cls.id).length
    middle.push(...partitionClass(cls.id, pairs, Math.max(1, cls.teamCount - lockedTeams), rng))
  }
  rng.shuffle(opening)
  rng.shuffle(ending)

  // 고정 슬롯 위치 결정 (이전 위치 유지, 범위를 넘으면 뒤에서부터 채움)
  const total = locked.length + opening.length + middle.length + ending.length
  const fixed = new Map<number, Slot>()
  const taken = new Set<number>()
  for (const l of locked.sort((a, b) => a.index - b.index)) {
    let idx = Math.min(l.index, total - 1)
    while (taken.has(idx)) idx = (idx + 1) % total
    taken.add(idx)
    fixed.set(idx, l.slot)
  }
  const freeIdx: number[] = []
  for (let i = 0; i < total; i++) if (!taken.has(i)) freeIdx.push(i)
  opening.forEach((s, k) => fixed.set(freeIdx[k], s))
  ending.forEach((s, k) => fixed.set(freeIdx[freeIdx.length - 1 - k], s))
  const middleIdx = freeIdx.slice(opening.length, freeIdx.length - ending.length)

  const slots = optimizeOrder(ctx, fixed, middle, middleIdx, rng, restarts, iterations)
  const fixedPhoto = new Set(locked.map((l) => l.slot.id))
  return finalize(ctx, slots, rng, seed, fixedPhoto)
}

/** 사용자가 직접 순서를 바꾼 뒤 위반 목록과 사진 담당을 다시 계산한다. 고정 슬롯의 사진 담당은 유지. */
export function reevaluate(db: Database, slots: Slot[], lockedSlotIds: ReadonlySet<string>, seed = randomSeed()): Schedule {
  const ctx = buildCtx(db)
  const copy = slots.map((s) => ({ ...s, pairIds: [...s.pairIds], photographers: { ...s.photographers } }))
  return finalize(ctx, copy, createRng(seed), seed, lockedSlotIds)
}

/** 요약 통계: 사진 담당 횟수 등 */
export function photographerCounts(schedule: Schedule): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of schedule.slots) for (const sid of Object.values(s.photographers)) if (sid) m.set(sid, (m.get(sid) ?? 0) + 1)
  return m
}
