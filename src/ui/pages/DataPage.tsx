import { Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import sampleLegacy from '@/data/sample-legacy.json'
import { convertLegacy, parseDatabaseJson, type Pair, type Role, type Student } from '@/engine'
import { downloadJson } from '@/export/xlsx'
import { parsePairList, parseStudentGrid } from '@/import/paste'
import { selectors, useStore } from '@/store/useStore'
import { Badge, Button, Card, Checkbox, ConfirmButton, Empty, Field, Input, Select, cx, useToast } from '../components/ui'

type Tab = 'classes' | 'students' | 'pairs' | 'io'
const TABS: { id: Tab; label: string }[] = [
  { id: 'classes', label: '반' },
  { id: 'students', label: '학생' },
  { id: 'pairs', label: '페어' },
  { id: 'io', label: '가져오기 · 백업' },
]

export function DataPage() {
  const [tab, setTab] = useState<Tab>('classes')
  const db = useStore((s) => s.db)
  const counts = { classes: db.classes.length, students: db.students.length, pairs: db.pairs.length, io: null }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">데이터</h1>
        <p className="mt-1 text-sm text-zinc-500">반 → 학생 → 페어 순서로 등록하거나, 엑셀에서 복사해 붙여넣으세요.</p>
      </header>
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cx(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === t.id ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200',
            )}
          >
            {t.label}
            {counts[t.id] !== null && <span className="ml-1.5 text-xs text-zinc-400">{counts[t.id]}</span>}
          </button>
        ))}
      </div>
      {tab === 'classes' && <ClassesTab />}
      {tab === 'students' && <StudentsTab />}
      {tab === 'pairs' && <PairsTab />}
      {tab === 'io' && <IoTab />}
    </div>
  )
}

// ---------------------------------------------------------------------------
function ClassesTab() {
  const db = useStore((s) => s.db)
  const { upsertClass, removeClass } = useStore()
  const [name, setName] = useState('')
  const [teamCount, setTeamCount] = useState('1')

  const add = () => {
    if (!name.trim()) return
    upsertClass({ name, teamCount: Number(teamCount) })
    setName('')
    setTeamCount('1')
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title="반 추가">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <Field label="반 이름">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 라틴 베이직" className="w-56" />
          </Field>
          <Field label="팀 수" hint="이 반이 중간에 몇 번 무대에 오르는지">
            <Input type="number" min={1} value={teamCount} onChange={(e) => setTeamCount(e.target.value)} className="w-24" />
          </Field>
          <Button type="submit" variant="primary" className="mb-[22px]">
            추가
          </Button>
        </form>
      </Card>

      {db.classes.length === 0 ? (
        <Empty>등록된 반이 없습니다.</Empty>
      ) : (
        <Card className="overflow-x-auto p-0 [&>div]:p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-2 font-medium">반 이름</th>
                <th className="px-4 py-2 font-medium">팀 수</th>
                <th className="px-4 py-2 font-medium">학생</th>
                <th className="px-4 py-2 font-medium">페어</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {db.classes.map((c) => {
                const nStudents = db.students.filter((s) => s.classIds.includes(c.id)).length
                const nPairs = db.pairs.filter((p) => p.classId === c.id).length
                return (
                  <tr key={c.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                    <td className="px-4 py-1.5">
                      <Input value={c.name} onChange={(e) => upsertClass({ ...c, name: e.target.value })} className="h-8 w-full min-w-40" />
                    </td>
                    <td className="px-4 py-1.5">
                      <Input type="number" min={1} value={c.teamCount} onChange={(e) => upsertClass({ ...c, teamCount: Number(e.target.value) })} className="h-8 w-20" />
                    </td>
                    <td className="px-4 py-1.5 text-zinc-500">{nStudents}</td>
                    <td className="px-4 py-1.5 text-zinc-500">
                      {nPairs}
                      {nPairs > 0 && nPairs < c.teamCount && <span className="ml-1 text-amber-600">(팀 수보다 적음)</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <ConfirmButton onConfirm={() => removeClass(c.id)} confirmLabel={nPairs ? `페어 ${nPairs}개도 삭제` : '정말 삭제?'} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
function StudentsTab() {
  const db = useStore((s) => s.db)
  const { upsertStudent, removeStudent } = useStore()
  const [filterClass, setFilterClass] = useState('')
  const [q, setQ] = useState('')
  const [nick, setNick] = useState('')
  const [role, setRole] = useState<Role>('leader')
  const [classId, setClassId] = useState('')

  const list = useMemo(
    () =>
      db.students
        .filter((s) => !filterClass || s.classIds.includes(filterClass))
        .filter((s) => !q || s.nickname.includes(q.trim()))
        .sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko')),
    [db.students, filterClass, q],
  )

  const add = () => {
    if (!nick.trim()) return
    const cid = classId || filterClass
    upsertStudent({ nickname: nick, role, classIds: cid ? [cid] : [], isStaff: false, isNewbie: false, excludeFromPhoto: false })
    setNick('')
  }

  if (db.classes.length === 0) return <Empty>먼저 반을 추가하세요.</Empty>

  return (
    <div className="flex flex-col gap-4">
      <Card title="학생 추가">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <Field label="닉네임">
            <Input value={nick} onChange={(e) => setNick(e.target.value)} className="w-40" />
          </Field>
          <Field label="역할">
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="leader">리더</option>
              <option value="follower">팔로워</option>
            </Select>
          </Field>
          <Field label="반">
            <Select value={classId || filterClass} onChange={(e) => setClassId(e.target.value)}>
              <option value="">(미지정)</option>
              {db.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="primary" className="mb-0.5">
            추가
          </Button>
        </form>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
          <option value="">모든 반</option>
          {db.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="닉네임 검색" className="w-40" />
        <span className="text-sm text-zinc-500">{list.length}명</span>
      </div>

      {list.length === 0 ? (
        <Empty>학생이 없습니다. 위에서 추가하거나 “가져오기” 탭에서 엑셀을 붙여넣으세요.</Empty>
      ) : (
        <Card className="overflow-x-auto [&>div]:p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-2 font-medium">닉네임</th>
                <th className="px-3 py-2 font-medium">역할</th>
                <th className="px-3 py-2 font-medium">소속 반</th>
                <th className="px-3 py-2 font-medium">운영진</th>
                <th className="px-3 py-2 font-medium">신입</th>
                <th className="px-3 py-2 font-medium">촬영 제외</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <StudentRow key={s.id} s={s} onChange={upsertStudent} onRemove={() => removeStudent(s.id)} />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

function StudentRow({ s, onChange, onRemove }: { s: Student; onChange: (s: Student) => void; onRemove: () => void }) {
  const db = useStore((st) => st.db)
  const nPairs = db.pairs.filter((p) => p.leaderId === s.id || p.followerId === s.id).length
  const toggleClass = (cid: string) =>
    onChange({ ...s, classIds: s.classIds.includes(cid) ? s.classIds.filter((c) => c !== cid) : [...s.classIds, cid] })
  return (
    <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
      <td className="px-4 py-1.5">
        <Input value={s.nickname} onChange={(e) => onChange({ ...s, nickname: e.target.value })} className="h-8 w-32" />
      </td>
      <td className="px-3 py-1.5">
        <Select value={s.role} onChange={(e) => onChange({ ...s, role: e.target.value as Role })} className="h-8">
          <option value="leader">리더</option>
          <option value="follower">팔로워</option>
        </Select>
      </td>
      <td className="px-3 py-1.5">
        <div className="flex flex-wrap gap-1">
          {db.classes.map((c) => {
            const on = s.classIds.includes(c.id)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleClass(c.id)}
                className={cx(
                  'rounded-full px-2 py-0.5 text-xs ring-1 transition-colors',
                  on ? 'bg-indigo-600 text-white ring-indigo-600' : 'text-zinc-400 ring-zinc-200 hover:text-zinc-700 dark:ring-zinc-700',
                )}
              >
                {c.name}
              </button>
            )
          })}
        </div>
      </td>
      <td className="px-3 py-1.5">
        <Checkbox checked={s.isStaff} onChange={(e) => onChange({ ...s, isStaff: e.target.checked })} />
      </td>
      <td className="px-3 py-1.5">
        <Checkbox checked={s.isNewbie} onChange={(e) => onChange({ ...s, isNewbie: e.target.checked })} />
      </td>
      <td className="px-3 py-1.5">
        <Checkbox checked={s.excludeFromPhoto} onChange={(e) => onChange({ ...s, excludeFromPhoto: e.target.checked })} />
      </td>
      <td className="px-2 py-1.5 text-right">
        <ConfirmButton onConfirm={onRemove} confirmLabel={nPairs ? `페어 ${nPairs}개도 삭제` : '정말 삭제?'} />
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
function PairsTab() {
  const db = useStore((s) => s.db)
  const { upsertPair, removePair } = useStore()
  const [classId, setClassId] = useState(db.classes[0]?.id ?? '')
  const [leaderId, setLeaderId] = useState('')
  const [followerId, setFollowerId] = useState('')
  const [solo, setSolo] = useState(false)
  const [filterClass, setFilterClass] = useState('')

  const members = (cid: string, role: Role) => db.students.filter((s) => s.classIds.includes(cid) && s.role === role).sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'))
  const leaders = members(classId, 'leader')
  const followers = members(classId, 'follower')
  const list = db.pairs.filter((p) => !filterClass || p.classId === filterClass)

  const add = () => {
    if (!classId || !leaderId) return
    if (!solo && !followerId) return
    upsertPair({ classId, leaderId, followerId: solo ? null : followerId, isOpening: false, isEnding: false })
    setLeaderId('')
    setFollowerId('')
  }

  if (db.classes.length === 0) return <Empty>먼저 반을 추가하세요.</Empty>

  return (
    <div className="flex flex-col gap-4">
      <Card title="페어 추가">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <Field label="반">
            <Select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value)
                setLeaderId('')
                setFollowerId('')
              }}
            >
              {db.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="리더">
            <Select value={leaderId} onChange={(e) => setLeaderId(e.target.value)} className="w-36">
              <option value="">선택</option>
              {leaders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nickname}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="팔로워">
            <Select value={followerId} onChange={(e) => setFollowerId(e.target.value)} disabled={solo} className="w-36">
              <option value="">{solo ? '(솔로)' : '선택'}</option>
              {followers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nickname}
                </option>
              ))}
            </Select>
          </Field>
          <Checkbox label="솔로" className="mb-2" checked={solo} onChange={(e) => setSolo(e.target.checked)} />
          <Button type="submit" variant="primary" className="mb-0.5" disabled={!leaderId || (!solo && !followerId)}>
            추가
          </Button>
        </form>
        {leaders.length === 0 && <p className="mt-2 text-xs text-amber-600">이 반에 리더로 등록된 학생이 없습니다. 학생 탭에서 소속 반을 지정하세요.</p>}
      </Card>

      <div className="flex items-center gap-2">
        <Select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
          <option value="">모든 반</option>
          {db.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <span className="text-sm text-zinc-500">{list.length}개</span>
      </div>

      {list.length === 0 ? (
        <Empty>페어가 없습니다.</Empty>
      ) : (
        <Card className="overflow-x-auto [&>div]:p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-2 font-medium">반</th>
                <th className="px-3 py-2 font-medium">리더</th>
                <th className="px-3 py-2 font-medium">팔로워</th>
                <th className="px-3 py-2 font-medium">오프닝</th>
                <th className="px-3 py-2 font-medium">엔딩</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <PairRow key={p.id} p={p} onChange={upsertPair} onRemove={() => removePair(p.id)} />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

function PairRow({ p, onChange, onRemove }: { p: Pair; onChange: (p: Pair) => void; onRemove: () => void }) {
  const db = useStore((s) => s.db)
  const leader = selectors.student(db, p.leaderId)
  const follower = selectors.student(db, p.followerId)
  const multi = (id: string) => db.pairs.filter((x) => x.leaderId === id || x.followerId === id).length
  return (
    <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
      <td className="px-4 py-2">
        <Badge>{selectors.className(db, p.classId)}</Badge>
      </td>
      <td className="px-3 py-2">
        {leader?.nickname ?? <span className="text-rose-500">(삭제된 학생)</span>}
        {leader && multi(leader.id) > 1 && <span className="ml-1 text-xs text-zinc-400">×{multi(leader.id)}</span>}
      </td>
      <td className="px-3 py-2">
        {p.followerId ? (follower?.nickname ?? <span className="text-rose-500">(삭제된 학생)</span>) : <span className="text-zinc-400">솔로</span>}
        {follower && multi(follower.id) > 1 && <span className="ml-1 text-xs text-zinc-400">×{multi(follower.id)}</span>}
      </td>
      <td className="px-3 py-2">
        <Checkbox checked={p.isOpening} onChange={(e) => onChange({ ...p, isOpening: e.target.checked, isEnding: e.target.checked ? false : p.isEnding })} />
      </td>
      <td className="px-3 py-2">
        <Checkbox checked={p.isEnding} onChange={(e) => onChange({ ...p, isEnding: e.target.checked, isOpening: e.target.checked ? false : p.isOpening })} />
      </td>
      <td className="px-2 py-1.5 text-right">
        <ConfirmButton onConfirm={onRemove} />
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
function IoTab() {
  const db = useStore((s) => s.db)
  const { importStudents, importPairs, replaceDatabase, resetAll } = useStore()
  const { toast, node } = useToast()
  const [studentText, setStudentText] = useState('')
  const [pairText, setPairText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const studentPreview = useMemo(() => parseStudentGrid(studentText), [studentText])
  const pairPreview = useMemo(
    () =>
      parsePairList(
        pairText,
        db.classes.map((c) => c.name),
      ),
    [pairText, db.classes],
  )

  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      const { db: next, warnings } = parseDatabaseJson(await f.text())
      replaceDatabase(next)
      toast(`불러왔습니다: 반 ${next.classes.length} · 학생 ${next.students.length} · 페어 ${next.pairs.length}${warnings.length ? ` (경고 ${warnings.length}건)` : ''}`)
      if (warnings.length) console.warn(warnings)
    } catch (e) {
      toast(`불러오기 실패: ${(e as Error).message}`)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {node}
      <Card
        title="학생 붙여넣기"
        actions={
          <Button
            size="sm"
            variant="primary"
            disabled={studentPreview.length === 0}
            onClick={() => {
              const r = importStudents(studentPreview)
              toast(`학생 ${r.added}명 추가, ${r.skipped}명 중복 건너뜀`)
              setStudentText('')
            }}
          >
            <Upload className="h-3.5 w-3.5" /> {studentPreview.length}명 가져오기
          </Button>
        }
      >
        <textarea
          value={studentText}
          onChange={(e) => setStudentText(e.target.value)}
          rows={8}
          placeholder={'엑셀에서 복사해 붙여넣기\n\n형식 1: 반 이름 행 → 남/여 행 → 이름들\n형식 2: 한 줄에  닉네임, 반, 리더|팔로워'}
          className="w-full rounded-md bg-zinc-50 p-3 font-mono text-xs ring-1 ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-zinc-950 dark:ring-zinc-700"
        />
        <p className="mt-2 text-xs text-zinc-500">없는 반은 자동으로 만들어집니다(팀 수 1). 같은 닉네임은 한 사람으로 합치고 반만 추가합니다.</p>
      </Card>

      <Card
        title="페어 붙여넣기"
        actions={
          <Button
            size="sm"
            variant="primary"
            disabled={pairPreview.length === 0}
            onClick={() => {
              const r = importPairs(pairPreview)
              toast(`페어 ${r.added}개 추가, ${r.skipped}개 중복${r.createdStudents ? `, 학생 ${r.createdStudents}명 자동 생성` : ''}`)
              setPairText('')
            }}
          >
            <Upload className="h-3.5 w-3.5" /> {pairPreview.length}개 가져오기
          </Button>
        }
      >
        <textarea
          value={pairText}
          onChange={(e) => setPairText(e.target.value)}
          rows={8}
          placeholder={'반 이름\n리더<TAB>팔로워\n리더            ← 솔로\n다른 반 이름\n...'}
          className="w-full rounded-md bg-zinc-50 p-3 font-mono text-xs ring-1 ring-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-zinc-950 dark:ring-zinc-700"
        />
        <p className="mt-2 text-xs text-zinc-500">학생 목록에 없는 이름은 자동으로 학생으로 등록됩니다.</p>
      </Card>

      <Card title="백업 · 복원" className="lg:col-span-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => downloadJson(`lineup-backup-${new Date().toISOString().slice(0, 10)}.json`, db)}>JSON 내려받기</Button>
          <Button onClick={() => fileRef.current?.click()}>JSON 불러오기 (v1 db.json 도 가능)</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button
            onClick={() => {
              replaceDatabase(convertLegacy(sampleLegacy).db)
              toast('익명 샘플 데이터를 불러왔습니다')
            }}
          >
            샘플 데이터 불러오기
          </Button>
          <div className="ml-auto">
            <ConfirmButton size="md" label="전체 초기화" confirmLabel="모든 데이터를 지웁니다. 정말?" onConfirm={resetAll} />
          </div>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          데이터는 이 브라우저의 저장 공간에만 있습니다. 다른 컴퓨터로 옮기거나 안전하게 보관하려면 JSON 을 내려받아 두세요. 불러오기는 현재 데이터를 대체합니다.
        </p>
      </Card>
    </div>
  )
}
