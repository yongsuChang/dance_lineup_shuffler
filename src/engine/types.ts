/** 도메인 타입. 모든 참조는 id 기반이며, 닉네임은 표시용이다. */

export type Role = 'leader' | 'follower'

export interface DanceClass {
  id: string
  name: string
  /** 이 반의 중간 발표 팀(슬롯) 수 */
  teamCount: number
}

export interface Student {
  id: string
  nickname: string
  role: Role
  /** 소속 반 (여러 반 수강 가능) */
  classIds: string[]
  isStaff: boolean
  isNewbie: boolean
  /** 사진 촬영 담당에서 항상 제외 */
  excludeFromPhoto: boolean
}

export interface Pair {
  id: string
  classId: string
  leaderId: string
  /** null 이면 솔로 */
  followerId: string | null
  isOpening: boolean
  isEnding: boolean
}

export interface Settings {
  year: number
  semester: string
  /** 리더가 다음 발표까지 쉬어야 하는 최소 슬롯 수 */
  minRestLeader: number
  minRestFollower: number
  /** 사진 담당은 앞뒤 photoGap 슬롯 안에서 춤추지 않아야 한다 */
  photoGap: number
  excludeStaffFromPhoto: boolean
  excludeNewbiesFromPhoto: boolean
}

export interface Database {
  version: 2
  settings: Settings
  classes: DanceClass[]
  students: Student[]
  pairs: Pair[]
}

export type SlotKind = 'opening' | 'middle' | 'ending'

export interface Slot {
  id: string
  classId: string
  pairIds: string[]
  kind: SlotKind
  /** pairId -> 사진 담당 studentId (배정 불가 시 null) */
  photographers: Record<string, string | null>
}

export type ViolationKind =
  | 'double_booking'
  | 'rest'
  | 'consecutive_class'
  | 'photo_unassigned'
  | 'photo_gap'

export interface Violation {
  kind: ViolationKind
  slotIndex: number
  message: string
  studentId?: string
}

export interface Schedule {
  slots: Slot[]
  violations: Violation[]
  /** 낮을수록 좋다. 0 이면 모든 제약 만족. */
  score: number
  seed: number
  generatedAt: string
}

export const DEFAULT_SETTINGS: Settings = {
  year: new Date().getFullYear(),
  semester: '1',
  minRestLeader: 2,
  minRestFollower: 2,
  photoGap: 1,
  excludeStaffFromPhoto: false,
  excludeNewbiesFromPhoto: false,
}

export function emptyDatabase(): Database {
  return { version: 2, settings: { ...DEFAULT_SETTINGS }, classes: [], students: [], pairs: [] }
}
