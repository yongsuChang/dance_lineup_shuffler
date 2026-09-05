/** 엑셀에서 복사한 탭 구분 텍스트 파서 (브라우저 클립보드 그대로) */
import type { Role } from '@/engine'

export interface ParsedStudent {
  nickname: string
  className: string
  role: Role
}
export interface ParsedPair {
  className: string
  leader: string
  follower: string | null
}

const ROLE_WORDS: Record<string, Role> = {
  남: 'leader', 리더: 'leader', leader: 'leader', l: 'leader',
  여: 'follower', 팔로워: 'follower', follower: 'follower', f: 'follower',
}
const roleOf = (s: string): Role | null => ROLE_WORDS[s.trim().toLowerCase()] ?? null
/** "이름 (3)" 처럼 붙은 숫자 꼬리표 제거 */
export const cleanName = (s: string) => s.replace(/\s*\(\d+\)\s*$/, '').trim()

function toGrid(text: string): string[][] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim().length > 0)
    .map((l) => l.split('\t'))
}

/**
 * 형식 A (엑셀 표):
 *   반 이름 행:   라틴 베이직 [빈칸]  스탠다드 베이직 [빈칸] ...
 *   역할 행:      남  여  남  여 ...
 *   이름 행들:    홍길동  김영희 ...
 * 형식 B (한 줄에 한 명): 닉네임,반,역할  또는  닉네임<TAB>반<TAB>역할
 */
export function parseStudentGrid(text: string): ParsedStudent[] {
  const grid = toGrid(text)
  if (grid.length === 0) return []

  const roleRow = grid.findIndex((row) => row.filter((c) => roleOf(c)).length >= 2 || (row.length <= 2 && row.some((c) => roleOf(c))))
  if (roleRow === -1) return parseSimpleStudents(grid)

  const classRow = (() => {
    for (let i = roleRow - 1; i >= 0; i--) if (grid[i].some((c) => c.trim())) return i
    return -1
  })()
  if (classRow === -1) return []

  const colMap = new Map<number, { className: string; role: Role }>()
  let current: string | null = null
  const roles = grid[roleRow]
  for (let c = 0; c < roles.length; c++) {
    const cls = grid[classRow][c]?.trim()
    if (cls) current = cls
    const role = roleOf(roles[c])
    if (current && role) colMap.set(c, { className: current, role })
  }

  const out: ParsedStudent[] = []
  for (let r = roleRow + 1; r < grid.length; r++) {
    for (const [c, m] of colMap) {
      const name = cleanName(grid[r][c] ?? '')
      if (name) out.push({ nickname: name, className: m.className, role: m.role })
    }
  }
  return out
}

function parseSimpleStudents(grid: string[][]): ParsedStudent[] {
  const out: ParsedStudent[] = []
  for (const row of grid) {
    const parts = (row.length >= 3 ? row : row.join('\t').split(',')).map((p) => p.trim())
    if (parts.length < 3) continue
    const role = roleOf(parts[2])
    if (!role) continue
    out.push({ nickname: cleanName(parts[0]), className: parts[1], role })
  }
  return out
}

/**
 * 반 이름 한 칸만 있는 줄이 나오면 그 뒤 줄들은 그 반의 페어.
 *   라틴 베이직
 *   홍길동<TAB>김영희
 *   이몽룡            ← 팔로워 없으면 솔로
 */
export function parsePairList(text: string, knownClasses: readonly string[] = []): ParsedPair[] {
  const grid = toGrid(text)
  const out: ParsedPair[] = []
  let current: string | null = null
  const known = new Set(knownClasses.map((c) => c.trim()))
  for (const row of grid) {
    const cells = row.map((c) => c.trim()).filter(Boolean)
    if (cells.length === 0) continue
    if (cells.length === 1 && (known.has(cells[0]) || current === null || looksLikeClassName(cells[0]))) {
      current = cells[0]
      continue
    }
    if (!current) continue
    out.push({ className: current, leader: cleanName(cells[0]), follower: cells[1] ? cleanName(cells[1]) : null })
  }
  return out
}

function looksLikeClassName(s: string) {
  return /(반|베이직|베리에이션|basic|variation|class|초급|중급|고급)/i.test(s)
}
