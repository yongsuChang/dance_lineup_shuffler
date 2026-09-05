import { describe, expect, it } from 'vitest'
import { parsePairList, parseStudentGrid } from '../src/import/paste'

describe('parseStudentGrid', () => {
  it('엑셀 표 형식 (반 행 + 역할 행 + 이름들)', () => {
    const text = ['라틴 베이직\t\t스탠다드 베이직\t', '남\t여\t남\t여', '사과\t바나나\t포도\t수박', '토끼 (2)\t\t\t고래'].join('\n')
    const r = parseStudentGrid(text)
    expect(r).toEqual([
      { nickname: '사과', className: '라틴 베이직', role: 'leader' },
      { nickname: '바나나', className: '라틴 베이직', role: 'follower' },
      { nickname: '포도', className: '스탠다드 베이직', role: 'leader' },
      { nickname: '수박', className: '스탠다드 베이직', role: 'follower' },
      { nickname: '토끼', className: '라틴 베이직', role: 'leader' },
      { nickname: '고래', className: '스탠다드 베이직', role: 'follower' },
    ])
  })
  it('간단 형식 (닉네임,반,역할)', () => {
    expect(parseStudentGrid('사과,라틴 베이직,리더\n바나나\t라틴 베이직\t팔로워')).toEqual([
      { nickname: '사과', className: '라틴 베이직', role: 'leader' },
      { nickname: '바나나', className: '라틴 베이직', role: 'follower' },
    ])
  })
  it('CRLF 와 빈 줄을 견딘다', () => {
    expect(parseStudentGrid('라틴 베이직\t\r\n남\t여\r\n\r\n사과\t바나나\r\n')).toHaveLength(2)
  })
})

describe('parsePairList', () => {
  it('반 줄 아래 페어들, 한 명이면 솔로', () => {
    const r = parsePairList('라틴 베이직\n사과\t바나나\n포도 (1)\n스탠다드 베이직\n수박\t딸기')
    expect(r).toEqual([
      { className: '라틴 베이직', leader: '사과', follower: '바나나' },
      { className: '라틴 베이직', leader: '포도', follower: null },
      { className: '스탠다드 베이직', leader: '수박', follower: '딸기' },
    ])
  })
  it('알려진 반 이름은 패턴에 안 맞아도 반으로 인식', () => {
    const r = parsePairList('A팀\n사과\t바나나\n토끼\nB팀\n포도\t수박', ['A팀', 'B팀'])
    expect(r.map((p) => p.className)).toEqual(['A팀', 'A팀', 'B팀'])
    expect(r[1]).toEqual({ className: 'A팀', leader: '토끼', follower: null })
  })
})
