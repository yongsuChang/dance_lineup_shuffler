import { useStore } from '@/store/useStore'
import { Card, Checkbox, Field, Input } from '../components/ui'

export function SettingsPage() {
  const settings = useStore((s) => s.db.settings)
  const update = useStore((s) => s.updateSettings)
  const num = (v: string, min = 0) => Math.max(min, Math.floor(Number(v) || 0))

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">설정</h1>
        <p className="mt-1 text-sm text-zinc-500">변경 사항은 바로 저장됩니다. 다음 생성부터 적용됩니다.</p>
      </header>

      <Card title="발표회">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="연도">
            <Input type="number" value={settings.year} onChange={(e) => update({ year: num(e.target.value) })} />
          </Field>
          <Field label="학기">
            <Input value={settings.semester} onChange={(e) => update({ semester: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card title="순서 제약">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="리더 최소 휴식 (슬롯)" hint="한 번 춘 뒤 다음 출연까지 비워야 하는 슬롯 수">
            <Input type="number" min={0} value={settings.minRestLeader} onChange={(e) => update({ minRestLeader: num(e.target.value) })} />
          </Field>
          <Field label="팔로워 최소 휴식 (슬롯)">
            <Input type="number" min={0} value={settings.minRestFollower} onChange={(e) => update({ minRestFollower: num(e.target.value) })} />
          </Field>
        </div>
      </Card>

      <Card title="사진 담당">
        <div className="flex flex-col gap-4">
          <Field label="촬영 전후 휴식 (슬롯)" hint="사진 담당은 촬영하는 슬롯의 앞뒤 이 수만큼의 슬롯에서 춤추지 않아야 합니다. 0이면 바로 앞뒤 출연도 허용.">
            <Input type="number" min={0} className="w-40" value={settings.photoGap} onChange={(e) => update({ photoGap: num(e.target.value) })} />
          </Field>
          <Checkbox label="운영진은 촬영에서 제외" checked={settings.excludeStaffFromPhoto} onChange={(e) => update({ excludeStaffFromPhoto: e.target.checked })} />
          <Checkbox label="신입은 촬영에서 제외" checked={settings.excludeNewbiesFromPhoto} onChange={(e) => update({ excludeNewbiesFromPhoto: e.target.checked })} />
          <p className="text-xs text-zinc-500">운영진·신입 여부와 개별 촬영 제외는 데이터 → 학생 탭에서 사람마다 지정합니다.</p>
        </div>
      </Card>
    </div>
  )
}
