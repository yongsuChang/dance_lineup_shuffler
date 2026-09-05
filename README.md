# Dance Lineup Shuffler

댄스스포츠 동호회 발표회의 **발표 순서**와 **사진 담당**을 제약 조건에 맞게 자동 생성하는 웹앱입니다.
서버 없이 브라우저에서만 동작하며, 데이터는 브라우저 저장 공간(localStorage)에만 남습니다.

## 기능

- 반 / 학생 / 페어 관리 (엑셀 복사-붙여넣기 가져오기 지원)
- 제약 기반 순서 생성
  - 한 사람이 같은 슬롯에 두 번 들어가지 않음 (하드)
  - 리더·팔로워별 최소 휴식 슬롯 수
  - 같은 반 연속 배치 회피
  - 오프닝은 맨 앞, 엔딩은 맨 뒤
- 사진 담당 자동 배정 (출연 슬롯 앞뒤 회피, 횟수 균등, 운영진/신입/개별 제외)
- 지키지 못한 제약을 슬롯별로 표시
- 드래그로 순서 직접 수정, 슬롯 고정 후 재셔플
- 엑셀(.xlsx) 내보내기, 인쇄, JSON 백업/복원 (구버전 Python `db.json` 도 불러오기 가능)

## 개발

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest
npm run build      # dist/
```

## 구조

```
src/
  engine/     순수 TypeScript 엔진 (UI 무관). types, shuffle(최적화), legacy(v1 변환)
  store/      zustand 상태 + localStorage 영속화
  ui/         React 화면 (pages/, components/)
  import/     엑셀 붙여넣기 파서
  export/     xlsx / JSON 내보내기
  data/       익명화된 샘플 데이터
tests/        엔진·파서 테스트
scripts/      anonymize.py — 실명 db.json 을 익명 샘플로 변환
```

### 엔진 개요

1. 반별 페어를 팀 수만큼 나눈다. 같은 사람이 한 팀에 두 번 들어가는 것만 절대 피한다.
2. 중간 슬롯 순서를 페널티 점수(휴식 부족 10, 같은 반 연속 3, 중복 출연 100)로 평가하며 담금질 국소 탐색으로 최적화한다.
   이동은 슬롯 자리 교환과 같은 반 팀 사이 페어 이동/교환이다.
3. 사진 담당은 슬롯 순서대로 배정 횟수가 적고 오래 쉰 사람을 우선 고른다.
4. 남은 위반은 모두 `violations` 로 반환되어 화면에 표시된다.

## 배포

`main` 에 push 하면 GitHub Actions 가 테스트·빌드 후 GitHub Pages 로 배포합니다.
저장소 Settings → Pages → Source 를 **GitHub Actions** 로 설정해야 합니다.

## 개인정보

실명/닉네임이 들어간 데이터 파일(`data/`)은 `.gitignore` 로 제외되어 있습니다.
저장소에는 `scripts/anonymize.py` 로 만든 익명 샘플만 포함합니다.
