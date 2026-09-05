/**
 * v1 (Python 버전) db.json → v2 Database 변환.
 * v1 은 닉네임 문자열로 모든 것을 연결했고, 같은 사람이 반마다 별도 학생 행으로 들어 있었다.
 * 여기서는 닉네임 기준으로 사람을 합치고 id 를 부여한다.
 */
import { DEFAULT_SETTINGS, type Database, type Pair, type Role, type Student } from './types'
import { newId } from './util'

export interface LegacyDb {
  settings?: Partial<{
    year: number | string
    semester: string | number
    min_rest_leader: number | string
    min_rest_follower: number | string
    exclude_staff_from_photo: boolean
    exclude_newbies_from_photo: boolean
  }>
  classes?: { name: string; team_count: number | string }[]
  students?: { nickname: string; class: string; role: string }[]
  pairs?: { class: string; leader: string; follower?: string | null; is_solo?: boolean; is_opening?: boolean; is_ending?: boolean }[]
  photo_exclusions?: string[]
}

export interface ConvertResult {
  db: Database
  warnings: string[]
}

export function isLegacyDb(x: unknown): x is LegacyDb {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return o.version === undefined && (Array.isArray(o.students) || Array.isArray(o.pairs) || Array.isArray(o.classes))
}

export function isDatabaseV2(x: unknown): x is Database {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return o.version === 2 && Array.isArray(o.students) && Array.isArray(o.pairs) && Array.isArray(o.classes)
}

const toRole = (r: string | undefined): Role | null => {
  const v = (r ?? '').trim().toLowerCase()
  if (['leader', '리더', '남', 'l', 'm'].includes(v)) return 'leader'
  if (['follower', '팔로워', '여', 'f', 'w'].includes(v)) return 'follower'
  return null
}

export function convertLegacy(src: LegacyDb): ConvertResult {
  const warnings: string[] = []
  const s = src.settings ?? {}
  const num = (v: unknown, d: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : d
  }

  const db: Database = {
    version: 2,
    settings: {
      ...DEFAULT_SETTINGS,
      year: num(s.year, DEFAULT_SETTINGS.year),
      semester: String(s.semester ?? DEFAULT_SETTINGS.semester),
      minRestLeader: num(s.min_rest_leader, DEFAULT_SETTINGS.minRestLeader),
      minRestFollower: num(s.min_rest_follower, DEFAULT_SETTINGS.minRestFollower),
      excludeStaffFromPhoto: !!s.exclude_staff_from_photo,
      excludeNewbiesFromPhoto: !!s.exclude_newbies_from_photo,
    },
    classes: [],
    students: [],
    pairs: [],
  }

  const classByName = new Map<string, string>()
  const ensureClass = (name: string, teamCount = 1) => {
    const key = name.trim()
    let id = classByName.get(key)
    if (!id) {
      id = newId()
      classByName.set(key, id)
      db.classes.push({ id, name: key, teamCount: Math.max(1, Math.floor(teamCount)) })
    }
    return id
  }
  for (const c of src.classes ?? []) ensureClass(c.name, num(c.team_count, 1))

  const studentByNick = new Map<string, Student>()
  const ensureStudent = (nickname: string, role: Role | null, classId?: string): Student => {
    const key = nickname.trim()
    let st = studentByNick.get(key)
    if (!st) {
      st = { id: newId(), nickname: key, role: role ?? 'leader', classIds: [], isStaff: false, isNewbie: false, excludeFromPhoto: false }
      if (!role) warnings.push(`${key}: 역할 정보가 없어 리더로 등록했습니다`)
      studentByNick.set(key, st)
      db.students.push(st)
    } else if (role && st.role !== role) {
      warnings.push(`${key}: 반마다 역할이 달라 첫 번째 역할(${st.role})을 사용합니다`)
    }
    if (classId && !st.classIds.includes(classId)) st.classIds.push(classId)
    return st
  }

  for (const s of src.students ?? []) {
    if (!s.nickname?.trim()) continue
    ensureStudent(s.nickname, toRole(s.role), s.class ? ensureClass(s.class) : undefined)
  }

  for (const p of src.pairs ?? []) {
    if (!p.leader?.trim()) continue
    const classId = ensureClass(p.class)
    const leader = ensureStudent(p.leader, 'leader', classId)
    const followerName = p.is_solo ? '' : (p.follower ?? '').trim()
    const follower = followerName ? ensureStudent(followerName, 'follower', classId) : null
    db.pairs.push({
      id: newId(),
      classId,
      leaderId: leader.id,
      followerId: follower?.id ?? null,
      isOpening: !!p.is_opening,
      isEnding: !!p.is_ending,
    })
  }

  for (const name of src.photo_exclusions ?? []) {
    const st = studentByNick.get(name.trim())
    if (st) st.excludeFromPhoto = true
    else warnings.push(`촬영 제외 명단의 ${name}: 학생 목록에 없어 건너뜀`)
  }

  return { db, warnings }
}

/** 파일에서 읽은 JSON 을 v2 로 정규화 */
export function parseDatabaseJson(text: string): ConvertResult {
  const parsed: unknown = JSON.parse(text)
  if (isDatabaseV2(parsed)) return { db: normalizeV2(parsed), warnings: [] }
  if (isLegacyDb(parsed)) return convertLegacy(parsed)
  throw new Error('알 수 없는 데이터 형식입니다')
}

function normalizeV2(db: Database): Database {
  return {
    ...db,
    settings: { ...DEFAULT_SETTINGS, ...db.settings },
    students: db.students.map((s: Partial<Student> & Pick<Student, 'id' | 'nickname' | 'role'>) => ({
      isStaff: false,
      isNewbie: false,
      excludeFromPhoto: false,
      classIds: [],
      ...s,
    })),
    pairs: db.pairs.map((p: Partial<Pair> & Pick<Pair, 'id' | 'classId' | 'leaderId'>) => ({ isOpening: false, isEnding: false, followerId: null, ...p })),
  }
}
