import { describe, expect, it } from 'vitest'
import sample from '../src/data/sample-legacy.json'
import { convertLegacy, generateSchedule, reevaluate, photographerCounts, type Database, type Schedule } from '../src/engine'

const { db: sampleDb, warnings } = convertLegacy(sample)

function dancersOfSlot(db: Database, slot: Schedule['slots'][number]) {
  return slot.pairIds.flatMap((pid) => {
    const p = db.pairs.find((x) => x.id === pid)!
    return p.followerId ? [p.leaderId, p.followerId] : [p.leaderId]
  })
}

describe('legacy 변환', () => {
  it('닉네임 기준으로 사람을 합치고 id 로 연결한다', () => {
    expect(sampleDb.version).toBe(2)
    expect(sampleDb.classes).toHaveLength(4)
    expect(sampleDb.pairs).toHaveLength(26)
    // 68 행 → 41 명
    expect(sampleDb.students).toHaveLength(41)
    expect(sampleDb.students.filter((s) => s.excludeFromPhoto)).toHaveLength(4)
    const multiClass = sampleDb.students.filter((s) => s.classIds.length > 1)
    expect(multiClass.length).toBeGreaterThan(0)
    for (const p of sampleDb.pairs) {
      expect(sampleDb.students.some((s) => s.id === p.leaderId)).toBe(true)
    }
    expect(warnings).toEqual([])
  })
})

describe('generateSchedule', () => {
  it('같은 seed 는 같은 결과를 낸다', () => {
    const a = generateSchedule(sampleDb, { seed: 7 })!
    const b = generateSchedule(sampleDb, { seed: 7 })!
    expect(a.slots.map((s) => s.pairIds)).toEqual(b.slots.map((s) => s.pairIds))
    expect(a.score).toBe(b.score)
  })

  it('모든 페어가 정확히 한 번씩 배치되고 반별 팀 수를 지킨다', () => {
    const sch = generateSchedule(sampleDb, { seed: 1 })!
    const placed = sch.slots.flatMap((s) => s.pairIds).sort()
    expect(placed).toEqual(sampleDb.pairs.map((p) => p.id).sort())
    for (const cls of sampleDb.classes) {
      const teams = sch.slots.filter((s) => s.kind === 'middle' && s.classId === cls.id)
      expect(teams).toHaveLength(cls.teamCount)
      const sizes = teams.map((t) => t.pairIds.length)
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
    }
  })

  it('한 사람이 같은 슬롯에 두 번 들어가지 않는다 (하드 제약)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const sch = generateSchedule(sampleDb, { seed })!
      for (const slot of sch.slots) {
        const ds = dancersOfSlot(sampleDb, slot)
        expect(new Set(ds).size).toBe(ds.length)
      }
      expect(sch.violations.filter((v) => v.kind === 'double_booking')).toHaveLength(0)
    }
  })

  it('휴식/연속 제약 위반이 이전 엔진보다 훨씬 적다 (샘플: 회당 평균 1건 이하)', () => {
    // 이전 Python 엔진은 같은 구조의 데이터에서 회당 평균 6.5건의 휴식 위반을 냈다.
    let rest = 0
    let consecutive = 0
    const runs = 30
    for (let seed = 0; seed < runs; seed++) {
      const sch = generateSchedule(sampleDb, { seed })!
      rest += sch.violations.filter((v) => v.kind === 'rest').length
      consecutive += sch.violations.filter((v) => v.kind === 'consecutive_class').length
    }
    expect(rest / runs).toBeLessThanOrEqual(1)
    expect(consecutive / runs).toBeLessThanOrEqual(0.5)
  })

  it('위반 목록이 실제 순서와 일치한다', () => {
    const sch = generateSchedule(sampleDb, { seed: 3 })!
    const { minRestLeader, minRestFollower } = sampleDb.settings
    const last = new Map<string, number>()
    let expected = 0
    sch.slots.forEach((slot, i) => {
      for (const d of dancersOfSlot(sampleDb, slot)) {
        const l = last.get(d)
        const role = sampleDb.students.find((s) => s.id === d)!.role
        if (l !== undefined && i - l - 1 < (role === 'leader' ? minRestLeader : minRestFollower)) expected++
        last.set(d, i)
      }
    })
    expect(sch.violations.filter((v) => v.kind === 'rest')).toHaveLength(expected)
  })

  it('사진 담당은 그 슬롯에서 춤추지 않고, 제외 명단은 배정되지 않으며, 골고루 배정된다', () => {
    const sch = generateSchedule(sampleDb, { seed: 5 })!
    const excluded = new Set(sampleDb.students.filter((s) => s.excludeFromPhoto).map((s) => s.id))
    sch.slots.forEach((slot) => {
      const ds = new Set(dancersOfSlot(sampleDb, slot))
      const assigned = Object.values(slot.photographers)
      for (const sid of assigned) {
        expect(sid).not.toBeNull()
        expect(ds.has(sid!)).toBe(false)
        expect(excluded.has(sid!)).toBe(false)
      }
      expect(new Set(assigned).size).toBe(assigned.length)
    })
    const counts = [...photographerCounts(sch).values()]
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
  })

  it('운영진/신입 제외 설정이 동작한다', () => {
    const db: Database = structuredClone(sampleDb)
    db.settings.excludeStaffFromPhoto = true
    db.students.forEach((s, i) => (s.isStaff = i % 2 === 0))
    const staff = new Set(db.students.filter((s) => s.isStaff).map((s) => s.id))
    const sch = generateSchedule(db, { seed: 9 })!
    for (const slot of sch.slots) for (const sid of Object.values(slot.photographers)) expect(staff.has(sid!)).toBe(false)
  })

  it('오프닝은 맨 앞, 엔딩은 맨 뒤에 놓인다', () => {
    const db: Database = structuredClone(sampleDb)
    db.pairs[0].isOpening = true
    db.pairs[1].isOpening = true
    db.pairs[2].isEnding = true
    const sch = generateSchedule(db, { seed: 2 })!
    expect(sch.slots.slice(0, 2).every((s) => s.kind === 'opening')).toBe(true)
    expect(sch.slots.at(-1)!.kind).toBe('ending')
    expect(sch.slots.slice(2, -1).every((s) => s.kind === 'middle')).toBe(true)
  })

  it('고정한 슬롯은 재셔플 후에도 같은 자리에 같은 내용으로 남는다', () => {
    const first = generateSchedule(sampleDb, { seed: 11 })!
    const lockedIdx = [2, 5]
    const locked = new Set(lockedIdx.map((i) => first.slots[i].id))
    const second = generateSchedule(sampleDb, { seed: 99, previous: first, lockedSlotIds: locked })!
    expect(second.slots).toHaveLength(first.slots.length)
    for (const i of lockedIdx) {
      expect(second.slots[i].id).toBe(first.slots[i].id)
      expect(second.slots[i].pairIds).toEqual(first.slots[i].pairIds)
      expect(second.slots[i].photographers).toEqual(first.slots[i].photographers)
    }
    const placed = second.slots.flatMap((s) => s.pairIds).sort()
    expect(placed).toEqual(sampleDb.pairs.map((p) => p.id).sort())
  })

  it('데이터가 없으면 null', () => {
    expect(generateSchedule({ ...sampleDb, pairs: [] })).toBeNull()
  })

  it('reevaluate 는 순서를 바꾸지 않고 위반과 사진 담당만 다시 계산한다', () => {
    const sch = generateSchedule(sampleDb, { seed: 4 })!
    const reordered = [...sch.slots].reverse()
    const re = reevaluate(sampleDb, reordered, new Set(), 4)
    expect(re.slots.map((s) => s.id)).toEqual(reordered.map((s) => s.id))
    expect(re.violations.every((v) => v.slotIndex >= 0 && v.slotIndex < re.slots.length)).toBe(true)
  })
})
