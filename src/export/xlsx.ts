import { photographerCounts, type Database, type Schedule } from '@/engine'
import { selectors } from '@/store/useStore'

const KIND_LABEL = { opening: '오프닝', middle: '', ending: '엔딩' } as const

export function buildScheduleRows(db: Database, schedule: Schedule) {
  const rows: (string | number)[][] = [['순번', '구분', '반', '리더', '팔로워', '사진 담당']]
  schedule.slots.forEach((slot, i) => {
    for (const pid of slot.pairIds) {
      const p = db.pairs.find((x) => x.id === pid)
      if (!p) continue
      rows.push([
        i + 1,
        KIND_LABEL[slot.kind],
        selectors.className(db, slot.classId),
        selectors.nickname(db, p.leaderId),
        p.followerId ? selectors.nickname(db, p.followerId) : '(솔로)',
        selectors.nickname(db, slot.photographers[pid]) || '미배정',
      ])
    }
  })
  return rows
}

export async function exportScheduleXlsx(db: Database, schedule: Schedule) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(buildScheduleRows(db, schedule))
  ws['!cols'] = [{ wch: 6 }, { wch: 8 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, ws, '발표 순서')

  const counts = [...photographerCounts(schedule).entries()]
    .map(([id, n]) => [selectors.nickname(db, id), n] as [string, number])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const ws2 = XLSX.utils.aoa_to_sheet([['사진 담당', '횟수'], ...counts])
  XLSX.utils.book_append_sheet(wb, ws2, '사진 담당 통계')

  if (schedule.violations.length) {
    const ws3 = XLSX.utils.aoa_to_sheet([['슬롯', '내용'], ...schedule.violations.map((v) => [v.slotIndex + 1, v.message])])
    XLSX.utils.book_append_sheet(wb, ws3, '미해결 제약')
  }
  XLSX.writeFile(wb, `발표순서_${db.settings.year}-${db.settings.semester}학기.xlsx`)
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
