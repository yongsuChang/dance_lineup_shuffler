/**
 * 최초 실행 시, 확인 대화 후 main() 호출
 */
function confirmAndRunMain() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    '정말로 발표 순서를 생성할까요?',
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    Logger.log('▶ confirmAndRunMain: 사용자 확인 후 main() 호출');
    main();
    Logger.log('✔ confirmAndRunMain 완료');
    ui.alert('✅ 발표 순서가 생성되었습니다!');
  } else {
    Logger.log('✖ confirmAndRunMain: 사용자 취소');
    ui.alert('❌ 작업이 취소되었습니다.');
  }
}

/**
 * 배열을 무작위로 섞어 반환
 */
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 메인 진입: 3가지 무작위 시안 생성 및 출력
 */
function main() {
  Logger.log('▶ main 시작');
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const data = loadData(ss);

  // 1) 사전 검증
  Logger.log('▶ 1) 사전 검증 시작');
  checkFeasibilityBeforeSchedule(
    data.pairs,
    data.classes.reduce((m, c) => ((m[c.className] = c.teamCount), m), {})
  );
  Logger.log('✔ 1) 사전 검증 완료');

  const schedules = [];
  const photographersList = [];
  const runs = 4;

  for (let run = 0; run < runs; run++) {
    Logger.log(`▶ 스케줄 생성 시도 ${run + 1}`);
    // 원본 페어 무작위 섞기
    const pairsRun = shuffleArray(data.pairs);

    // 2) Backbone 스케줄 생성
    let teams = generateScheduleWithBackbone(
      pairsRun,
      data.classes.reduce((m, c) => ((m[c.className] = c.teamCount), m), {}),
      data.settings
    );
    if (!teams) {
      SpreadsheetApp.getUi().alert('❌ 유효한 발표 순서를 찾지 못했습니다.');
      return;
    }
    Logger.log('✔ generateScheduleWithBackbone 완료');

    // 3) 휴식 차수 적용
    teams = fixRestTurns(teams, data.settings);
    Logger.log('✔ fixRestTurns 완료');

    // 4) DFS 기반 재배치 (반 연속·댄서 연속 방지)
    teams = reorderByDancerDFS(teams);
    Logger.log('✔ reorderByDancerDFS 완료');

    // 5) 엔딩 팀 맨 뒤 배치
    const ending = teams.filter(t => t.pairs.some(p => p.isEnding));
    teams = teams.filter(t => !ending.includes(t)).concat(ending);
    Logger.log('✔ 엔딩 팀 맨 뒤 배치 완료');

    // 6) 촬영자 배정
    const photographers = assignPhotographers(teams, data);
    schedules.push(teams);
    photographersList.push(photographers);
  }

  // 7) 결과 출력
  outputMultipleResults(ss, schedules, photographersList, data.settings);
  Logger.log('✔ main 완료');
}

/**
 * 백본 스케줄러: Opening/Ending 제외한 Middle 페어를 클래스별로 DFS+그리디 배치
 */
function generateScheduleWithBackbone(pairs, teamCountByClassMap, settings) {
  Logger.log(`▶ generateScheduleWithBackbone 시작: 전체 페어 ${pairs.length}`);
  const opening = pairs.filter(p => p.isOpening);
  const ending  = pairs.filter(p => p.isEnding);
  const middle  = pairs.filter(p => !p.isOpening && !p.isEnding);
  Logger.log(`  • opening=${opening.length}, ending=${ending.length}, middle=${middle.length}`);

  const classTeams = {}, classCaps = {};
  for (const cls in teamCountByClassMap) {
    const total = teamCountByClassMap[cls];
    const cnt   = middle.filter(p => p.className === cls).length;
    const base  = Math.floor(cnt / total), extra = cnt % total;
    classTeams[cls] = [];
    classCaps[cls]  = [];
    Logger.log(`  • 클래스 '${cls}': middlePairs=${cnt}, teams=${total}, base=${base}, extra=${extra}`);
    for (let i = 0; i < total; i++) {
      classTeams[cls].push({ className: cls, pairs: [] });
      classCaps[cls].push(base + (i < extra ? 1 : 0));
      Logger.log(`    - 팀 ${cls}[${i}] 용량=${classCaps[cls][i]}`);
    }
  }

  for (const cls in classTeams) {
    const teams  = classTeams[cls];
    const caps   = classCaps[cls];
    const clsPairs = middle.filter(p => p.className === cls);

    // 빈도 상위 5명 추출
    const freq = {};
    clsPairs.forEach(p => [p.leader, p.follower].forEach(n => { if (n) freq[n] = (freq[n] || 0) + 1; }));
    const top5 = Object.entries(freq).sort((a,b) => b[1] - a[1]).slice(0,5).map(x => x[0]);
    const heavy = clsPairs.filter(p => top5.includes(p.leader) || top5.includes(p.follower));
    const other = clsPairs.filter(p => !heavy.includes(p));
    Logger.log(`  ▶ 클래스 '${cls}' heavyDancers: ${top5.join(', ')}`);
    Logger.log(`    - heavyPairs=${heavy.length}, otherPairs=${other.length}`);

    function valid(idx, p) {
      const t = teams[idx];
      if (t.pairs.length >= caps[idx]) return false;
      const used = t.pairs.flatMap(x => [x.leader, x.follower]);
      if (used.includes(p.leader) || used.includes(p.follower)) return false;
      return true;
    }

    // heavy DFS
    let ok = false;
    (function dfs(i) {
      if (i === heavy.length) { ok = true; return; }
      for (let j = 0; j < teams.length && !ok; j++) {
        if (!valid(j, heavy[i])) continue;
        teams[j].pairs.push(heavy[i]);
        dfs(i + 1);
        if (!ok) teams[j].pairs.pop();
      }
    })(0);
    if (!ok) { Logger.log(`  ✖ 클래스 '${cls}' heavy 실패`); return null; }
    Logger.log(`  ✔ 클래스 '${cls}' heavy 성공`);

    // other greedy
    other.forEach(p => {
      for (let j = 0; j < teams.length; j++) {
        if (valid(j, p)) {
          teams[j].pairs.push(p);
          Logger.log(`    + 그리디: ${cls}[${j}]에 ${p.leader}→${p.follower}`);
          break;
        }
      }
    });
  }

  const res = Object.values(classTeams).flat();
  Logger.log('✔ generateScheduleWithBackbone 완료');
  return res;
}
/**
 * 동일 '반'(className)이 연속으로 나오지 않도록
 * 이전에 나온 반과 다르고, 남은 수가 가장 많은 반을 골라 순서 재배치
 * @param {Array<{className: string, pairs: Array}>} teams
 * @returns {Array} reordered teams
 */
function fixConsecutiveClasses(teams) {
  // 클래스별 팀 큐로 묶기
  const groups = {};
  teams.forEach(t => {
    (groups[t.className] = groups[t.className]||[]).push(t);
  });

  const result    = [];
  let   prevClass = null;
  const total     = teams.length;

  for (let i = 0; i < total; i++) {
    let pickClass = null;
    let maxRemain = -1;

    // 이전 반(prevClass)과 다르면서 남은 수가 가장 많은 반 선택
    for (const cls in groups) {
      const len = groups[cls].length;
      if (len === 0 || cls === prevClass) continue;
      if (len > maxRemain) {
        maxRemain = len;
        pickClass = cls;
      }
    }
    // 모두 불가능하면(=prevClass만 남았거나 비어있으면) 아무 반에서 꺼내기
    if (!pickClass) {
      for (const cls in groups) {
        if (groups[cls].length > 0) {
          pickClass = cls;
          break;
        }
      }
    }

    // 선택된 반 큐에서 팀 하나 꺼내 결과에 추가
    result.push(groups[pickClass].shift());
    prevClass = pickClass;
  }

  return result;
}

/** 팀 단위 휴식 차수 방지 (캐싱 및 로그 추가) */
function fixRestTurns(teams, settings) {
  Logger.log('▶ fixRestTurns 내부 시작');
  const lg = settings['리더 발표 후 쉬는 최소 차례 수'];
  const fg = settings['팔로워 발표 후 쉬는 최소 차례 수'];
  const last = {};
  const attempted = {};
  let i = 0;
  while (i < teams.length) {
    const dancers = teams[i].pairs.flatMap(p => [p.leader, p.follower]).filter(x => x);
    let violation = false;
    for (const name of dancers) {
      if (last[name] !== undefined) {
        const gap = i - last[name] - 1;
        const req = teams[i].pairs.some(p => p.leader === name) ? lg : fg;
        if (gap < req) { violation = true; break; }
      }
    }
    Logger.log(`  turn=${i}, dancers=[${dancers.join(', ')}], violation=${violation}`);
    if (violation) {
      if (!attempted[i]) attempted[i] = new Set();
      let swapped = false;
      for (let j = i + 1; j < teams.length; j++) {
        if (attempted[i].has(j)) continue;
        const candDancers = teams[j].pairs.flatMap(p => [p.leader, p.follower]).filter(x => x);
        let ok = true;
        for (const n of candDancers) {
          if (last[n] !== undefined) {
            const gap2 = j - last[n] - 1;
            const req2 = teams[j].pairs.some(p => p.leader === n) ? lg : fg;
            if (gap2 < req2) { ok = false; break; }
          }
        }
        if (!ok) { attempted[i].add(j); continue; }
        [teams[i], teams[j]] = [teams[j], teams[i]];
        Logger.log(`    swapped turn ${i} with ${j}`);
        attempted[i].add(j);
        swapped = true;
        break;
      }
      if (!swapped) {
        Logger.log(`    no valid swap found for turn ${i}, advancing`);
        i++;
      }
      continue;
    }
    dancers.forEach(n => { last[n] = i; });
    Logger.log(`    accepted turn ${i}`);
    i++;
  }
  Logger.log('✔ fixRestTurns 내부 완료');
  return teams;
}

/**
 * 댄서 연속 방지: 스왑
 */
function fixConsecutiveDancers(teams) {
  function dancersOf(team) {
    return new Set(team.pairs.flatMap(p => [p.leader, p.follower]).filter(Boolean));
  }
  for (let i = 1; i < teams.length; i++) {
    const prev = dancersOf(teams[i-1]);
    const curr = dancersOf(teams[i]);
    if ([...curr].some(n => prev.has(n))) {
      // 뒤에서 교환
      for (let j = i+1; j < teams.length; j++) {
        const cand = dancersOf(teams[j]);
        if (![...cand].some(n => prev.has(n))) {
          [teams[i], teams[j]] = [teams[j], teams[i]];
          break;
        }
      }
    }
  }
  return teams;
}

/**
 * 댄서 연속 남은 충돌 그리디 재배치
 */
function reorderByDancerGreedy(teams) {
  const remaining = teams.slice();
  const result    = [];
  function dancersOf(team) {
    return new Set(team.pairs.flatMap(p => [p.leader, p.follower]).filter(Boolean));
  }
  // 1) 첫 팀
  result.push(remaining.shift());
  // 2) 남은 팀 중 직전과 겹치지 않는 팀 골라서
  while (remaining.length) {
    const prevSet = dancersOf(result[result.length - 1]);
    let idx = remaining.findIndex(t => {
      for (const n of dancersOf(t)) if (prevSet.has(n)) return false;
      return true;
    });
    if (idx < 0) idx = 0;
    result.push(remaining.splice(idx,1)[0]);
  }
  return result;
}

/**
 * DFS 재배치: 직전 팀과
 *  - 같은 반이 아니고
 *  - 댄서가 겹치지 않도록
 * 하는 순서를 찾아냅니다.
 * 실패 시 원본 teams 반환.
 */
function reorderByDancerDFS(teams) {
  const N    = teams.length;
  const used = Array(N).fill(false);
  const result = new Array(N);

  function dancersOf(team) {
    return new Set(
      team.pairs
          .flatMap(p => [p.leader, p.follower])
          .filter(Boolean)
    );
  }

  /**
   * @param {Set<string>?} prevSet   이전 턴 댄서 집합
   * @param {string?}       prevClass 이전 턴 className
   * @param {number}        depth     현재 깊이 (턴)
   */
  function dfs(prevSet, prevClass, depth) {
    if (depth === N) return true;
    for (let i = 0; i < N; i++) {
      if (used[i]) continue;
      const t = teams[i];

      // 1) 같은 반 연속 금지
      if (prevClass !== null && t.className === prevClass) continue;

      // 2) 댄서 연속 금지
      const currSet = dancersOf(t);
      if (prevSet && [...currSet].some(x => prevSet.has(x))) continue;

      // 선택
      used[i]       = true;
      result[depth] = t;
      if (dfs(currSet, t.className, depth + 1)) {
        return true;
      }
      used[i] = false;
    }
    return false;
  }

  return dfs(null, null, 0) ? result : teams;
}

/**
 * 촬영자 배정
 */
function assignPhotographers(teams, data) {
  const used = new Set();
  const all = data.students.map(s=>s.nickname);
  const staff = new Set(data.staffList);
  const fresh = new Set(data.freshmanList);
  const restL = data.settings['리더 발표 후 쉬는 최소 차례 수'];
  const restF = data.settings['팔로워 발표 후 쉬는 최소 차례 수'];
  const lastApp = {};
  return teams.map((team,idx) => {
    const picks = [];
    const dancers = new Set(team.pairs.flatMap(p=>[p.leader,p.follower]).filter(Boolean));
    team.pairs.forEach(pair => {
      let cands = all.filter(n => !used.has(n)
        && !dancers.has(n)
        && (!staff.has(n) || !data.settings['운영진은 촬영자 제외 여부'])
        && (!fresh.has(n) || !data.settings['신입생은 촬영자 제외 여부'])
      );
      if (data.settings['촬영자는 앞뒤 발표 없게 배정 여부']) {
        const blocked = new Set();
        [idx-1,idx+1].forEach(i2=>{ teams[i2]?.pairs.forEach(p=>{ blocked.add(p.leader); if(p.follower)blocked.add(p.follower); }); });
        cands = cands.filter(n=>!blocked.has(n));
      }
      const sameCls = data.students.filter(s=>s.className===team.className).map(s=>s.nickname);
      const pref = cands.filter(n=>sameCls.includes(n));
      if (pref.length) cands = pref;
      cands = cands.filter(n => {
        const last = lastApp[n]===undefined? -Infinity : lastApp[n];
        const role = data.students.find(s=>s.nickname===n).role;
        const gap = role==='leader'? restL : restF;
        return idx - last > gap;
      });
      const pick = cands.length? cands[Math.floor(Math.random()*cands.length)] : '배정 불가';
      if (pick!=='배정 불가') { used.add(pick); lastApp[pick]=idx; }
      picks.push(pick);
    });
    return picks;
  });
}

/**
 * 결과 시트에 다중 스케줄 출력
 */
function outputMultipleResults(ss, schedules, photographersList, settings) {
  const name = '발표순서';
  let sh = ss.getSheetByName(name);
  if (sh) ss.deleteSheet(sh);
  sh = ss.insertSheet(name);

  const runs = schedules.length;
  const headerTitles = schedules.map((_, i) => `${settings['연도']} ${settings['학기명']}학기 종강 발표 순서 (${i+1})`);

  // 각 결과별 1행 헤더, 컬럼 너비 설정
  for (let r = 0; r < runs; r++) {
    const baseCol = 1 + r * 4;
    sh.getRange(1, baseCol, 1, 3)
      .setValue(headerTitles[r])
      .setFontSize(14)
      .setFontWeight('bold')
      .merge()
      .setHorizontalAlignment('center');
    sh.setColumnWidth(baseCol, 150);
    sh.setColumnWidth(baseCol + 1, 100);
    sh.setColumnWidth(baseCol + 2, 100);
  }

  // Heat 구분 및 데이터 출력
  const runsRows = 3; // 3 heats
  for (let r = 0; r < runs; r++) {
    const teams = schedules[r];
    const phots = photographersList[r];
    const N = teams.length;
    // heat sizes
    const base = Math.floor(N / runsRows);
    const rem  = N % runsRows;
    const sizes = [
      base + (rem > 0 ? 1 : 0),
      base + (rem > 1 ? 1 : 0),
      base
    ];
    let row = 3;
    let idx = 0;
    const baseCol = 1 + r * 4;
    for (let h = 0; h < runsRows; h++) {
      sh.getRange(row, baseCol)
        .setValue(`Heat ${h+1}`)
        .setFontWeight('bold')
        .setHorizontalAlignment('center');
      row++;
      sh.getRange(row, baseCol, 1, 3)
        .setValues([['반','페어','촬영']])
        .setFontWeight('bold')
        .setHorizontalAlignment('center');
      row++;
      for (let t = 0; t < sizes[h]; t++, idx++) {
        const team = teams[idx];
        const ph   = phots[idx];
        const cnt  = team.pairs.length;
        if (cnt < 1) continue;
        sh.getRange(row, baseCol, cnt, 1)
          .merge()
          .setValue(team.className)
          .setBackground(getClassColor(team.className))
          .setVerticalAlignment('middle');
        team.pairs.forEach((p, j) => {
          sh.getRange(row + j, baseCol + 1)
            .setValue(`${p.leader} - ${p.follower||'Solo'}`)
            .setHorizontalAlignment('center');
          sh.getRange(row + j, baseCol + 2)
            .setValue(ph[j] || ph)
            .setHorizontalAlignment('center');
        });
        row += cnt;
      }
      row++;
    }
  }

  // 전체 범위 테두리 설정
  const lastCol = 3 + (runs-1)*4;
  const lastRow = schedules[0].length + 5;
  sh.getRange(1, 1, lastRow, lastCol).setBorder(true, true, true, true, true, true);
}

/**
 * 색상 매핑
 */
function getClassColor(c) {
  if (c.includes('라틴 초급'))    return '#B3D9FF';
  if (c.includes('라틴 베이직'))    return '#B3D9FF';
  if (c.includes('라틴 중상급'))  return '#FF9999';
  if (c.includes('라틴 베리에이션'))  return '#FF9999';
  if (c.includes('스탠다드 초급')) return '#CCFFCC';
  if (c.includes('스탠다드 베이직')) return '#CCFFCC';
  if (c.includes('스탠다드 중급')) return '#FFFF99';
  if (c.includes('스탠다드 베리에이션')) return '#FFFF99';
  return null;
}

/**
 * 데이터 로드
 */
function loadData(ss) {
  const sheetNames = { students:'수강생', exclude:'촬영제외', newbies:'신입생', pairs:'발표페어', settings:'설정값', classes:'반목록' };
  function getSh(k){ const sh=ss.getSheetByName(sheetNames[k]); if(!sh) throw new Error(`${sheetNames[k]} 시트를 찾을 수 없습니다`); return sh; }
  return {
    students:     readStudents(getSh('students')),
    staffList:    readSingleColumnList(getSh('exclude')),
    freshmanList: readSingleColumnList(getSh('newbies')),
    pairs:        readPairs(getSh('pairs')),
    settings:     readSettings(getSh('settings')),
    classes:      readClasses(getSh('classes'))
  };
}
function readStudents(sh) { return sh.getDataRange().getValues().slice(1).map(r=>({nickname:r[0],className:r[1],role:r[2]})); }
function readSingleColumnList(sh) { return sh.getDataRange().getValues().slice(1).map(r=>r[0]).filter(v=>v); }
function readPairs(sh) { return sh.getDataRange().getValues().slice(1).map(r=>({ className:r[0], leader:r[1], follower:r[2], isSolo:r[3]===true, isOpening:r[4]===true, isEnding:r[5]===true })); }
function readSettings(sh) { const out={}; sh.getDataRange().getValues().slice(1).forEach(r=>{ let v=r[1]; if(typeof v==='string'){const u=v.trim().toUpperCase(); if(u==='TRUE'||u==='FALSE') v=(u==='TRUE'); else if(!isNaN(v)) v=Number(v);} out[r[0]]=v; }); return out; }
function readClasses(sh) { return sh.getDataRange().getValues().slice(1).filter(r=>r[0]&&r[1]!==undefined&&!isNaN(Number(r[1]))).map(r=>({className:r[0].toString().trim(),teamCount:Number(r[1])})); }

/**
 * 사전 검증: 팀 수, 이름 과도 출연 경고
 */
function checkFeasibilityBeforeSchedule(pairs, teamCountByClass) {
  const classMap={}, count={};
  pairs.forEach(p=>{ classMap[p.className]=(classMap[p.className]||[]).concat(p); [p.leader,p.follower].forEach(n=>{ if(!n) return; count[n]=(count[n]||0)+1; }); });
  for(const cls in classMap) if((teamCountByClass[cls]||0)===0) throw new Error(`❌ ${cls}: 팀 수가 0입니다.`);
  for(const name in count) if(count[name]>4) Logger.log(`⚠️ ${name}: ${count[name]}개의 페어에 포함되어 연속 배치 어려울 수 있습니다.`);
  Logger.log('✅ 조건 상 실행 가능해 보입니다. 계산을 시작합니다...');
}


