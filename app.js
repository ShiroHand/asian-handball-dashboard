// ===== Global State =====
let DATA = null;
let teamStats = {};
let playerStats = [];
let gkStats = [];
let charts = {};
let allPhases = [];
let allTeamCodes = [];

// ===== Team Colors =====
const TEAM_COLORS = {
  QAT: '#8b1a1a', BRN: '#ce1126', KSA: '#006c35', KUW: '#007a3d', UAE: '#00732f',
  JPN: '#bc002d', KOR: '#003478', CHN: '#de2910', IRI: '#239f40', JOR: '#007a3d',
  IRQ: '#ce1126', OMA: '#db161b', IND: '#ff9933', AUS: '#00843d', HKG: '#de2910'
};

// ===== Official Rankings & Groups =====
const OFFICIAL_RANKING = ['BRN', 'QAT', 'KUW', 'JPN', 'KOR', 'KSA', 'IRQ', 'UAE', 'CHN', 'HKG', 'JOR', 'IRI', 'OMA', 'AUS', 'IND'];
const MAIN_ROUND = ['BRN', 'QAT', 'KUW', 'JPN', 'KOR', 'KSA', 'IRQ', 'UAE'];
const CLASSIFICATION = ['CHN', 'HKG', 'JOR', 'IRI', 'OMA', 'AUS', 'IND'];
function officialRank(code) { const i = OFFICIAL_RANKING.indexOf(code); return i >= 0 ? i : 999; }

// ===== Utilities =====
function parseShotStat(s) { if (!s || s === '0/0') return [0, 0]; const m = s.match(/(\d+)\/(\d+)/); return m ? [+m[1], +m[2]] : [0, 0]; }
function pct(a, b) { return b ? ((a / b) * 100).toFixed(1) : '-'; }
function safe(v, d = 0) { return v || d; }
function phaseFilterHtml(id) {
  return `<select class="filter-select" id="${id}"><option value="ALL">全ラウンド</option><option value="MAIN">メインラウンド (1-8位)</option><option value="CLASS">Classification (9-15位)</option>${allPhases.map(p => { const rn = p.match(/ROUND\s*(\d+)/i); return `<option value="${p}">${rn ? 'Round ' + rn[1] : p}</option>`; }).join('')}</select>`;
}
function teamMultiSelect(id, label) {
  return `<div class="filter-select" style="position:relative;min-width:200px;cursor:pointer" id="${id}-wrap">
    <span id="${id}-label">${label}</span>
    <div id="${id}-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);max-height:250px;overflow-y:auto;z-index:50;padding:6px">
      ${allTeamCodes.map(c => `<label style="display:flex;align-items:center;gap:6px;padding:4px 6px;cursor:pointer;font-size:0.82rem"><input type="checkbox" value="${c}" class="${id}-cb"> ${c}</label>`).join('')}
    </div></div>`;
}

// ===== Data Processing =====
function computeStats(matches) {
  const ts = {}; const allPlayers = {};
  matches.forEach(m => {
    const matchShots = {}; const matchErrors = {}; const matchShotTypes = {};
    [['home', m.home_team, m.away_team, m.score.home, m.score.away],
    ['away', m.away_team, m.home_team, m.score.away, m.score.home]].forEach(([side, team, opp, gf, ga]) => {
      const c = team.code; if (!c) return;
      if (!ts[c]) ts[c] = {
        code: c, name: team.name, matches: 0, wins: 0, draws: 0, losses: 0,
        goalsFor: 0, goalsAgainst: 0, points: 0,
        fieldG: 0, fieldA: 0, lineG: 0, lineA: 0, wingG: 0, wingA: 0, fastG: 0, fastA: 0,
        brkG: 0, brkA: 0, freeG: 0, freeA: 0, sevenG: 0, sevenA: 0,
        totalG: 0, totalA: 0, assists: 0, errors: 0, warnings: 0, suspensions: 0,
        attacks: 0, defenses: 0,
        oppFieldG: 0, oppFieldA: 0, oppLineG: 0, oppLineA: 0, oppWingG: 0, oppWingA: 0, oppFastG: 0, oppFastA: 0,
        oppBrkG: 0, oppBrkA: 0, oppFreeG: 0, oppFreeA: 0, oppSevenG: 0, oppSevenA: 0, oppErrors: 0
      };
      const t = ts[c];
      t.matches++; t.goalsFor += gf; t.goalsAgainst += ga;
      if (gf > ga) { t.wins++; t.points += 2; } else if (gf === ga) { t.draws++; t.points += 1; } else { t.losses++; }
      let mShots = 0, mErrors = 0;
      const mst = { fieldG: 0, fieldA: 0, lineG: 0, lineA: 0, wingG: 0, wingA: 0, fastG: 0, fastA: 0, brkG: 0, brkA: 0, freeG: 0, freeA: 0, sevenG: 0, sevenA: 0 };
      const players = side === 'home' ? m.home_players : m.away_players;
      players.forEach(p => {
        if (p.is_goalkeeper) return;
        const key = `${c}_${p.number}_${p.name}`;
        if (!allPlayers[key]) allPlayers[key] = {
          team: c, teamName: team.name, number: p.number, name: p.name, matches: 0,
          totalGoals: 0, totalShots: 0, assists: 0, errors: 0, warnings: 0, suspensions: 0,
          fieldG: 0, fieldA: 0, lineG: 0, lineA: 0, wingG: 0, wingA: 0, fastG: 0, fastA: 0,
          brkG: 0, brkA: 0, freeG: 0, freeA: 0, sevenG: 0, sevenA: 0
        };
        const pp = allPlayers[key]; pp.matches++;
        const shots = [['field_shot', 'field'], ['line_shot', 'line'], ['wing_shot', 'wing'],
        ['fast_break', 'fast'], ['breakthrough', 'brk'], ['free_throw', 'free'], ['seven_m', 'seven']];
        shots.forEach(([k, sk]) => {
          const [g, a] = parseShotStat(p[k]);
          pp[sk + 'G'] += g; pp[sk + 'A'] += a;
          t[sk + 'G'] += g; t[sk + 'A'] += a;
          mst[sk + 'G'] += g; mst[sk + 'A'] += a;
          mShots += a;
        });
        pp.totalGoals += p.total_goals || 0; pp.totalShots += p.total_shots || 0;
        t.totalG += p.total_goals || 0; t.totalA += p.total_shots || 0;
        pp.assists += p.assists || 0; pp.errors += p.errors || 0;
        pp.warnings += p.warnings || 0; pp.suspensions += p.suspensions || 0;
        t.assists += p.assists || 0; t.errors += p.errors || 0;
        t.warnings += p.warnings || 0; t.suspensions += p.suspensions || 0;
        mErrors += p.errors || 0;
      });
      matchShots[c] = mShots; matchErrors[c] = mErrors; matchShotTypes[c] = mst;
    });
    // Cross-assign opponent shot types & attack/defense counts
    const codes = Object.keys(matchShots);
    if (codes.length === 2) {
      const [c1, c2] = codes;
      ts[c1].attacks += matchShots[c1] + matchErrors[c1];
      ts[c1].defenses += matchShots[c2] + matchErrors[c2];
      ts[c2].attacks += matchShots[c2] + matchErrors[c2];
      ts[c2].defenses += matchShots[c1] + matchErrors[c1];
      ['Field', 'Line', 'Wing', 'Fast', 'Brk', 'Free', 'Seven'].forEach(sk => {
        const lk = sk.charAt(0).toLowerCase() + sk.slice(1);
        ts[c1]['opp' + sk + 'G'] += matchShotTypes[c2][lk + 'G'];
        ts[c1]['opp' + sk + 'A'] += matchShotTypes[c2][lk + 'A'];
        ts[c2]['opp' + sk + 'G'] += matchShotTypes[c1][lk + 'G'];
        ts[c2]['opp' + sk + 'A'] += matchShotTypes[c1][lk + 'A'];
      });
      ts[c1].oppErrors += matchErrors[c2];
      ts[c2].oppErrors += matchErrors[c1];
    }
  });
  // ===== Goalkeeper stats =====
  const allGK = {};
  matches.forEach(m => {
    [['home', m.home_team], ['away', m.away_team]].forEach(([side, team]) => {
      const c = team.code; if (!c) return;
      const players = side === 'home' ? m.home_players : m.away_players;
      players.forEach(p => {
        if (!p.is_goalkeeper) return;
        if (p.total === '0/0' || !p.total || p.total === 0) return; // skip bench entries
        const key = `${c}_${p.number}_${p.name}`;
        if (!allGK[key]) allGK[key] = {
          team: c, teamName: team.name, number: p.number, name: p.name, matches: 0,
          saves: 0, faced: 0,
          fieldS: 0, fieldF: 0, lineS: 0, lineF: 0, wingS: 0, wingF: 0,
          fastS: 0, fastF: 0, brkS: 0, brkF: 0, freeS: 0, freeF: 0, sevenS: 0, sevenF: 0
        };
        const gk = allGK[key]; gk.matches++;
        const shots = [['field_shot', 'field'], ['line_shot', 'line'], ['wing_shot', 'wing'],
        ['fast_break', 'fast'], ['breakthrough', 'brk'], ['free_throw', 'free'], ['seven_m', 'seven']];
        shots.forEach(([k, sk]) => {
          const [s, f] = parseShotStat(p[k]);
          gk[sk + 'S'] += s; gk[sk + 'F'] += f;
        });
        const [ts, tf] = parseShotStat(p.total);
        gk.saves += ts; gk.faced += tf;
      });
    });
  });
  const gkStats = Object.values(allGK).filter(g => g.faced > 0);
  return { teamStats: ts, playerStats: Object.values(allPlayers).filter(p => p.matches > 0), gkStats };
}
function filterMatches(phase) {
  if (!phase || phase === 'ALL') return DATA.matches;
  if (phase === 'MAIN') return DATA.matches.filter(m => {
    const h = m.home_team.code, a = m.away_team.code;
    return MAIN_ROUND.includes(h) && MAIN_ROUND.includes(a);
  });
  if (phase === 'CLASS') return DATA.matches.filter(m => {
    const h = m.home_team.code, a = m.away_team.code;
    return CLASSIFICATION.includes(h) && CLASSIFICATION.includes(a);
  });
  return DATA.matches.filter(m => m.phase === phase);
}
function processData(data) {
  allPhases = [...new Set(data.matches.map(m => m.phase).filter(Boolean))].sort();
  allTeamCodes = [...new Set(data.matches.flatMap(m => [m.home_team.code, m.away_team.code]).filter(Boolean))].sort();
  const r = computeStats(data.matches);
  teamStats = r.teamStats; playerStats = r.playerStats; gkStats = r.gkStats;
}
function setupDropdown(id) {
  const wrap = document.getElementById(id + '-wrap');
  const dd = document.getElementById(id + '-dropdown');
  if (!wrap || !dd) return;
  wrap.addEventListener('click', e => { e.stopPropagation(); dd.style.display = dd.style.display === 'none' ? 'block' : 'none'; });
  document.addEventListener('click', () => { dd.style.display = 'none'; });
  dd.addEventListener('click', e => e.stopPropagation());
}
function getCheckedTeams(id) {
  return Array.from(document.querySelectorAll('.' + id + '-cb:checked')).map(cb => cb.value);
}

// ===== Tab Navigation =====
function initTabs() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });
}

// ===== Sortable Table Helper =====
function makeSortable(tableId) {
  const table = document.getElementById(tableId); if (!table) return;
  const headers = table.querySelectorAll('thead th');
  let sortCol = -1, sortDir = 1;
  headers.forEach((th, i) => {
    th.addEventListener('click', () => {
      if (sortCol === i) sortDir *= -1; else { sortCol = i; sortDir = -1; }
      headers.forEach(h => { h.classList.remove('sorted-asc', 'sorted-desc'); });
      th.classList.add(sortDir === 1 ? 'sorted-asc' : 'sorted-desc');
      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr'));
      rows.sort((a, b) => {
        let av = a.children[i]?.textContent.trim() || '';
        let bv = b.children[i]?.textContent.trim() || '';
        const an = parseFloat(av.replace('%', ''));
        const bn = parseFloat(bv.replace('%', ''));
        if (!isNaN(an) && !isNaN(bn)) return (an - bn) * sortDir;
        return av.localeCompare(bv) * sortDir;
      });
      rows.forEach(r => tbody.appendChild(r));
    });
  });
}

// ===== Header Stats =====
function renderHeaderStats() {
  const totalGoals = DATA.matches.reduce((s, m) => s + m.score.home + m.score.away, 0);
  const avgGoals = (totalGoals / DATA.total_matches).toFixed(1);
  document.getElementById('headerStats').innerHTML = `
    <div class="header-stat"><div class="header-stat-value">${DATA.total_matches}</div><div class="header-stat-label">試合数</div></div>
    <div class="header-stat"><div class="header-stat-value">${Object.keys(teamStats).length}</div><div class="header-stat-label">チーム数</div></div>
    <div class="header-stat"><div class="header-stat-value">${totalGoals}</div><div class="header-stat-label">総得点</div></div>
    <div class="header-stat"><div class="header-stat-value">${avgGoals}</div><div class="header-stat-label">平均得点/試合</div></div>`;
}

// ===== Overview Tab =====
function renderOverview() {
  const el = document.getElementById('tab-overview');
  el.innerHTML = `
    <div class="filters-bar">
      ${phaseFilterHtml('ovPhase')}
      ${teamMultiSelect('ovCompare', '\u30c1\u30fc\u30e0\u6bd4\u8f03 \u25bc')}
    </div>
    <div id="ovContent"></div>
    <div id="ovCompareSection" style="margin-top:24px"></div>
    <div id="ovScatterSection" style="margin-top:24px"></div>`;
  const render = () => {
    const phase = document.getElementById('ovPhase').value;
    const fm = filterMatches(phase);
    const r = computeStats(fm); const ts = r.teamStats;
    const totalGoals = fm.reduce((s, m) => s + m.score.home + m.score.away, 0);
    const cnt = fm.length || 1;
    const draws = fm.filter(m => m.score.home === m.score.away).length;
    const avgMargin = (fm.reduce((s, m) => s + Math.abs(m.score.home - m.score.away), 0) / cnt).toFixed(1);
    const sorted = Object.values(ts).filter(t => t.matches > 0).sort((a, b) => officialRank(a.code) - officialRank(b.code));
    document.getElementById('ovContent').innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-card-icon blue">\u26bd</div><div class="stat-card-info"><div class="stat-card-value">${totalGoals}</div><div class="stat-card-label">\u7dcf\u5f97\u70b9 (${fm.length}\u8a66\u5408)</div></div></div>
        <div class="stat-card"><div class="stat-card-icon cyan">\ud83d\udcc8</div><div class="stat-card-info"><div class="stat-card-value">${(totalGoals / cnt).toFixed(1)}</div><div class="stat-card-label">\u5e73\u5747\u5f97\u70b9/\u8a66\u5408</div></div></div>
        <div class="stat-card"><div class="stat-card-icon green">\ud83e\udd1d</div><div class="stat-card-info"><div class="stat-card-value">${draws}</div><div class="stat-card-label">\u5f15\u304d\u5206\u3051</div></div></div>
        <div class="stat-card"><div class="stat-card-icon orange">\ud83d\udcca</div><div class="stat-card-info"><div class="stat-card-value">${avgMargin}</div><div class="stat-card-label">\u5e73\u5747\u70b9\u5dee</div></div></div>
      </div>
      <div class="charts-grid">
        <div class="chart-card"><div class="chart-card-title">\ud83d\udcca \u30c1\u30fc\u30e0\u5225\u5f97\u70b9</div><div class="chart-wrapper"><canvas id="chartTeamGoals"></canvas></div></div>
        <div class="chart-card"><div class="chart-card-title">\ud83d\udcc8 \u30c1\u30fc\u30e0\u52dd\u6557</div><div class="chart-wrapper"><canvas id="chartTeamWDL"></canvas></div></div>
      </div>
      <div class="section-title"><span class="icon">\ud83c\udfc6</span> \u7dcf\u5408\u9806\u4f4d</div>
      <div class="table-container"><table class="data-table" id="standingsTable"><thead><tr>
        <th>\u9806\u4f4d</th><th>\u30c1\u30fc\u30e0</th><th>\u8a66\u5408</th><th>\u52dd</th><th>\u5206</th><th>\u6557</th><th>\u5f97\u70b9</th><th>\u5931\u70b9</th><th>\u5f97\u5931\u5dee</th><th>\u653b\u6483\u56de\u6570</th><th>\u653b\u6483\u6210\u529f\u7387</th><th>\u5b88\u5099\u56de\u6570</th><th>\u5b88\u5099\u6210\u529f\u7387</th><th>\u52dd\u70b9</th><th>\u6226\u7e3e</th>
      </tr></thead><tbody>
        ${sorted.map((t, i) => {
      const diff = t.goalsFor - t.goalsAgainst; const total = t.wins + t.draws + t.losses;
      const rb = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'default';
      const atkRate = t.attacks ? ((t.goalsFor / t.attacks) * 100).toFixed(1) : '-';
      const defRate = t.defenses ? (((1 - t.goalsAgainst / t.defenses) * 100).toFixed(1)) : '-';
      const isMain = MAIN_ROUND.includes(t.code);
      const groupBadge = isMain ? '<span style="background:rgba(99,115,255,0.15);color:var(--accent-blue);padding:1px 6px;border-radius:4px;font-size:0.7rem;margin-left:4px">メイン</span>' : '<span style="background:rgba(156,163,175,0.15);color:#9ca3af;padding:1px 6px;border-radius:4px;font-size:0.7rem;margin-left:4px">CL</span>';
      const sep = (i === 8) ? '<tr><td colspan="15" style="padding:2px 0;background:var(--accent-blue);opacity:0.3"></td></tr>' : '';
      return `${sep}<tr><td><span class="rank-badge ${rb}">${i + 1}</span></td><td><strong>${t.code}</strong> ${groupBadge} <span style="color:var(--text-muted);font-size:0.78rem">${t.name}</span></td>
          <td class="num">${t.matches}</td><td class="num">${t.wins}</td><td class="num">${t.draws}</td><td class="num">${t.losses}</td>
          <td class="num">${t.goalsFor}</td><td class="num">${t.goalsAgainst}</td>
          <td class="num" style="color:${diff > 0 ? 'var(--accent-green)' : diff < 0 ? 'var(--accent-red)' : 'var(--text-muted)'};">${diff > 0 ? '+' : ''}${diff}</td>
          <td class="num">${t.attacks}</td><td class="num" style="color:var(--accent-cyan)">${atkRate}%</td>
          <td class="num">${t.defenses}</td><td class="num" style="color:var(--accent-green)">${defRate}%</td>
          <td class="num" style="font-weight:700">${t.points}</td>
          <td><div class="wdl-bar"><div class="win" style="width:${(t.wins / total) * 100}%"></div><div class="draw" style="width:${(t.draws / total) * 100}%"></div><div class="loss" style="width:${(t.losses / total) * 100}%"></div></div></td></tr>`;
    }).join('')}
      </tbody></table></div>`;
    makeSortable('standingsTable');
    renderOverviewCharts(sorted);
    renderComparison(ts);
    renderScatter(ts);
  };
  render();
  document.getElementById('ovPhase').addEventListener('change', render);
  setupDropdown('ovCompare');
  document.getElementById('ovCompare-dropdown').addEventListener('change', render);
}

function renderComparison(ts) {
  const sel = getCheckedTeams('ovCompare');
  const sec = document.getElementById('ovCompareSection');
  if (sel.length < 2) { sec.innerHTML = ''; return; }
  const teams = sel.map(c => ts[c]).filter(Boolean);
  const colors = ['#6373ff', '#00d4ff', '#a855f7', '#34d399', '#fb923c'];
  sec.innerHTML = `
    <div class="section-title"><span class="icon">\u2696\ufe0f</span> \u30c1\u30fc\u30e0\u6bd4\u8f03: ${sel.join(' vs ')}</div>
    <div class="charts-grid">
      <div class="chart-card"><div class="chart-card-title">\ud83d\udcca \u30ec\u30fc\u30c0\u30fc\u30c1\u30e3\u30fc\u30c8</div><div class="chart-wrapper"><canvas id="chartRadar"></canvas></div></div>
      <div class="chart-card"><div class="chart-card-title">\ud83d\udcca \u6bd4\u8f03\u30c6\u30fc\u30d6\u30eb</div>
        <div class="table-container"><table class="data-table"><thead><tr><th>\u6307\u6a19</th>${teams.map(t => `<th>${t.code}</th>`).join('')}</tr></thead><tbody>
          <tr><td>\u8a66\u5408</td>${teams.map(t => `<td class="num">${t.matches}</td>`).join('')}</tr>
          <tr><td>\u52dd\u7387</td>${teams.map(t => `<td class="num">${t.matches ? ((t.wins / t.matches) * 100).toFixed(1) : '-'}%</td>`).join('')}</tr>
          <tr><td>\u5f97\u70b9</td>${teams.map(t => `<td class="num">${t.goalsFor}</td>`).join('')}</tr>
          <tr><td>\u5931\u70b9</td>${teams.map(t => `<td class="num">${t.goalsAgainst}</td>`).join('')}</tr>
          <tr><td>\u30b7\u30e5\u30fc\u30c8\u6210\u529f\u7387</td>${teams.map(t => `<td class="num">${pct(t.totalG, t.totalA)}%</td>`).join('')}</tr>
          <tr><td>\u653b\u6483\u6210\u529f\u7387</td>${teams.map(t => `<td class="num">${t.attacks ? ((t.goalsFor / t.attacks) * 100).toFixed(1) : '-'}%</td>`).join('')}</tr>
          <tr><td>\u5b88\u5099\u6210\u529f\u7387</td>${teams.map(t => `<td class="num">${t.defenses ? (((1 - t.goalsAgainst / t.defenses) * 100).toFixed(1)) : '-'}%</td>`).join('')}</tr>
          <tr><td>\u30a2\u30b7\u30b9\u30c8</td>${teams.map(t => `<td class="num">${t.assists}</td>`).join('')}</tr>
          <tr><td>\u30a8\u30e9\u30fc</td>${teams.map(t => `<td class="num">${t.errors}</td>`).join('')}</tr>
        </tbody></table></div>
      </div>
    </div>`;
  if (charts.radar) charts.radar.destroy();
  const maxVals = { winRate: 100, shotRate: 100, atkRate: 100, defRate: 100, avgGoals: 50, assists: 100 };
  charts.radar = new Chart(document.getElementById('chartRadar'), {
    type: 'radar',
    data: {
      labels: ['\u52dd\u7387', '\u30b7\u30e5\u30fc\u30c8\u6210\u529f\u7387', '\u653b\u6483\u6210\u529f\u7387', '\u5b88\u5099\u6210\u529f\u7387', '\u5e73\u5747\u5f97\u70b9', '\u30a2\u30b7\u30b9\u30c8/\u8a66\u5408'],
      datasets: teams.map((t, i) => ({
        label: t.code,
        data: [t.matches ? (t.wins / t.matches) * 100 : 0, t.totalA ? (t.totalG / t.totalA) * 100 : 0,
        t.attacks ? (t.goalsFor / t.attacks) * 100 : 0, t.defenses ? (1 - t.goalsAgainst / t.defenses) * 100 : 0,
        t.matches ? t.goalsFor / t.matches : 0, t.matches ? t.assists / t.matches : 0],
        borderColor: colors[i % colors.length], backgroundColor: colors[i % colors.length] + '33',
        pointBackgroundColor: colors[i % colors.length], borderWidth: 2
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        r: {
          grid: { color: 'rgba(99,115,255,0.12)' }, angleLines: { color: 'rgba(99,115,255,0.12)' },
          pointLabels: { color: '#9a9eb8', font: { size: 11 } }, ticks: { display: false },
          suggestedMin: 0, suggestedMax: 100
        }
      },
      plugins: { legend: { labels: { color: '#9a9eb8' } } }
    }
  });
}

// ===== Scatter Plot: Attack vs Defense =====
const BEST4 = ['BRN', 'QAT', 'KUW', 'JPN'];
function renderScatter(ts) {
  const sec = document.getElementById('ovScatterSection');
  const teams = Object.values(ts).filter(t => t.matches > 0);
  const data = teams.map(t => {
    const atk = t.attacks ? ((t.goalsFor / t.attacks) * 100) : 0;
    const def = t.defenses ? ((1 - t.goalsAgainst / t.defenses) * 100) : 0;
    const group = BEST4.includes(t.code) ? 'best4' : MAIN_ROUND.includes(t.code) ? 'main' : 'class';
    return { code: t.code, atk: +atk.toFixed(1), def: +def.toFixed(1), group };
  });
  const best4 = data.filter(d => d.group === 'best4');
  const main58 = data.filter(d => d.group === 'main');
  const cls = data.filter(d => d.group === 'class');
  const mainAll = [...best4, ...main58];
  const b4atkMin = Math.min(...best4.map(d => d.atk)); const b4atkMax = Math.max(...best4.map(d => d.atk));
  const b4defMin = Math.min(...best4.map(d => d.def)); const b4defMax = Math.max(...best4.map(d => d.def));
  const b4atkAvg = (best4.reduce((s, d) => s + d.atk, 0) / best4.length).toFixed(1);
  const b4defAvg = (best4.reduce((s, d) => s + d.def, 0) / best4.length).toFixed(1);
  const mrAtkMin = Math.min(...mainAll.map(d => d.atk)); const mrDefMin = Math.min(...mainAll.map(d => d.def));
  const mrAtkAvg = (mainAll.reduce((s, d) => s + d.atk, 0) / mainAll.length).toFixed(1);
  const mrDefAvg = (mainAll.reduce((s, d) => s + d.def, 0) / mainAll.length).toFixed(1);

  sec.innerHTML = `
    <div class="section-title"><span class="icon">\ud83d\udcca</span> \u653b\u6483\u6210\u529f\u7387 vs \u5b88\u5099\u6210\u529f\u7387 \u6563\u5e03\u56f3</div>
    <div class="charts-grid">
      <div class="chart-card" style="grid-column:1/-1"><div class="chart-wrapper" style="height:500px"><canvas id="chartScatter"></canvas></div></div>
    </div>
    <div class="chart-card" style="margin-top:16px;padding:20px">
      <div class="chart-card-title">\ud83d\udcdd \u5206\u6790: \u30d9\u30b9\u30c84 & \u30e1\u30a4\u30f3\u30e9\u30a6\u30f3\u30c9\u9032\u51fa\u6761\u4ef6</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px">
        <div style="background:rgba(251,191,36,0.06);border-radius:8px;padding:16px">
          <div style="font-weight:700;color:#fbbf24;margin-bottom:8px">\ud83c\udfc6 \u30d9\u30b9\u30c84 (1-4\u4f4d)</div>
          <div style="font-size:0.9rem;color:var(--text-secondary);line-height:1.7">
            \u653b\u6483: <strong style="color:var(--text-primary)">${b4atkMin}%\u301c${b4atkMax}%</strong> (\u5e73\u5747${b4atkAvg}%)<br>
            \u5b88\u5099: <strong style="color:var(--text-primary)">${b4defMin}%\u301c${b4defMax}%</strong> (\u5e73\u5747${b4defAvg}%)<br>
            ${best4.map(d => `\u30fb<strong>${d.code}</strong> \u653b${d.atk}%/\u5b88${d.def}%`).join('<br>')}
          </div>
        </div>
        <div style="background:rgba(99,115,255,0.06);border-radius:8px;padding:16px">
          <div style="font-weight:700;color:var(--accent-blue);margin-bottom:8px">\ud83c\udfaf \u30e1\u30a4\u30f3\u30e9\u30a6\u30f3\u30c9 (5-8\u4f4d)</div>
          <div style="font-size:0.9rem;color:var(--text-secondary);line-height:1.7">
            \u653b\u6483\u6700\u4f4e: <strong style="color:var(--text-primary)">${mrAtkMin}%</strong> (\u5e73\u5747${mrAtkAvg}%)<br>
            \u5b88\u5099\u6700\u4f4e: <strong style="color:var(--text-primary)">${mrDefMin}%</strong> (\u5e73\u5747${mrDefAvg}%)<br>
            ${main58.map(d => `\u30fb<strong>${d.code}</strong> \u653b${d.atk}%/\u5b88${d.def}%`).join('<br>')}
          </div>
        </div>
      </div>
      <div style="margin-top:16px;background:rgba(52,211,153,0.06);border-radius:8px;padding:16px">
        <div style="font-weight:700;color:var(--accent-green);margin-bottom:8px">\ud83d\udcca \u7d50\u8ad6</div>
        <div style="font-size:0.9rem;color:var(--text-secondary);line-height:1.6">
          \u30e1\u30a4\u30f3\u30e9\u30a6\u30f3\u30c9\u9032\u51fa\u306b\u306f<strong style="color:var(--text-primary)">\u653b\u6483${mrAtkMin}%\u4ee5\u4e0a</strong>\u304b\u3064<strong style="color:var(--text-primary)">\u5b88\u5099${mrDefMin}%\u4ee5\u4e0a</strong>\u304c\u5fc5\u8981\u3002<br>
          \u30d9\u30b9\u30c84\u306b\u306f<strong style="color:var(--text-primary)">\u653b\u6483${b4atkMin}%\u4ee5\u4e0a</strong>\u304b\u3064<strong style="color:var(--text-primary)">\u5b88\u5099${b4defMin}%\u4ee5\u4e0a</strong>\u304c\u5fc5\u8981\u3002
        </div>
      </div>
    </div>`;


  if (charts.scatter) charts.scatter.destroy();
  charts.scatter = new Chart(document.getElementById('chartScatter'), {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: '\u30d9\u30b9\u30c84 (' + BEST4.join(', ') + ')',
          data: best4.map(d => ({ x: d.atk, y: d.def, label: d.code })),
          backgroundColor: 'rgba(251,191,36,0.9)', borderColor: '#fbbf24', pointRadius: 10, pointHoverRadius: 14, borderWidth: 2
        },
        {
          label: '\u30e1\u30a4\u30f3\u30e9\u30a6\u30f3\u30c9 5-8\u4f4d',
          data: main58.map(d => ({ x: d.atk, y: d.def, label: d.code })),
          backgroundColor: 'rgba(99,115,255,0.8)', borderColor: '#6373ff', pointRadius: 9, pointHoverRadius: 12, borderWidth: 2
        },
        {
          label: 'Classification 9-15\u4f4d',
          data: cls.map(d => ({ x: d.atk, y: d.def, label: d.code })),
          backgroundColor: 'rgba(156,163,175,0.5)', borderColor: '#9ca3af', pointRadius: 7, pointHoverRadius: 10, borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#9a9eb8' } },
        tooltip: {
          callbacks: {
            label: ctx => { const d = ctx.raw; return `${d.label}: \u653b\u6483${d.x}% / \u5b88\u5099${d.y}%`; }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: '\u653b\u6483\u6210\u529f\u7387 (%)', color: '#9a9eb8', font: { size: 13 } },
          ticks: { color: '#9a9eb8' }, grid: { color: 'rgba(99,115,255,0.08)' }
        },
        y: {
          title: { display: true, text: '\u5b88\u5099\u6210\u529f\u7387 (%)', color: '#9a9eb8', font: { size: 13 } },
          ticks: { color: '#9a9eb8' }, grid: { color: 'rgba(99,115,255,0.08)' }
        }
      }
    },
    plugins: [{
      id: 'labelPoints', afterDatasetsDraw(chart) {
        const ctx = chart.ctx; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
        chart.data.datasets.forEach((ds, di) => {
          const meta = chart.getDatasetMeta(di);
          meta.data.forEach((pt, pi) => {
            ctx.fillStyle = di === 0 ? '#fbbf24' : di === 1 ? '#6373ff' : '#9ca3af';
            ctx.fillText(ds.data[pi].label, pt.x, pt.y - 14);
          });
        });
      }
    }]
  });
}

function renderOverviewCharts(sorted) {
  const labels = sorted.map(t => t.code);
  const colors = labels.map(c => TEAM_COLORS[c] || '#6373ff');
  if (charts.teamGoals) charts.teamGoals.destroy();
  charts.teamGoals = new Chart(document.getElementById('chartTeamGoals'), {
    type: 'bar',
    data: {
      labels, datasets: [{ label: '得点', data: sorted.map(t => t.goalsFor), backgroundColor: 'rgba(99,115,255,0.7)', borderRadius: 4 },
      { label: '失点', data: sorted.map(t => t.goalsAgainst), backgroundColor: 'rgba(239,68,68,0.5)', borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#9a9eb8' } } },
      scales: {
        x: { ticks: { color: '#9a9eb8' }, grid: { color: 'rgba(99,115,255,0.06)' } },
        y: { ticks: { color: '#9a9eb8' }, grid: { color: 'rgba(99,115,255,0.06)' } }
      }
    }
  });

  if (charts.teamWDL) charts.teamWDL.destroy();
  charts.teamWDL = new Chart(document.getElementById('chartTeamWDL'), {
    type: 'bar',
    data: {
      labels, datasets: [{ label: '勝', data: sorted.map(t => t.wins), backgroundColor: 'rgba(52,211,153,0.7)', borderRadius: 4 },
      { label: '分', data: sorted.map(t => t.draws), backgroundColor: 'rgba(251,191,36,0.7)', borderRadius: 4 },
      { label: '敗', data: sorted.map(t => t.losses), backgroundColor: 'rgba(239,68,68,0.6)', borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#9a9eb8' } } },
      scales: {
        x: { stacked: true, ticks: { color: '#9a9eb8' }, grid: { color: 'rgba(99,115,255,0.06)' } },
        y: { stacked: true, ticks: { color: '#9a9eb8' }, grid: { color: 'rgba(99,115,255,0.06)' } }
      }
    }
  });
}

// ===== Teams Tab =====
function renderTeams() {
  const el = document.getElementById('tab-teams');
  el.innerHTML = `<div class="filters-bar">${phaseFilterHtml('tmPhase')}</div><div id="tmContent"></div>`;
  const render = () => {
    const fm = filterMatches(document.getElementById('tmPhase').value);
    const r = computeStats(fm); const sorted = Object.values(r.teamStats).filter(t => t.matches > 0).sort((a, b) => b.goalsFor - a.goalsFor);
    document.getElementById('tmContent').innerHTML = `
      <div class="charts-grid">
        <div class="chart-card"><div class="chart-card-title">\ud83c\udfaf \u30b7\u30e5\u30fc\u30c8\u6210\u529f\u7387</div><div class="chart-wrapper"><canvas id="chartTeamRate"></canvas></div></div>
        <div class="chart-card"><div class="chart-card-title">\ud83d\udcca \u30b7\u30e5\u30fc\u30c8\u7a2e\u985e\u5225\u5f97\u70b9</div><div class="chart-wrapper"><canvas id="chartShotTypes"></canvas></div></div>
      </div>
      <div class="section-title"><span class="icon">\u2694\ufe0f</span> \u653b\u6483\u7d71\u8a08</div>
      <div class="table-container"><table class="data-table" id="atkTable"><thead><tr>
        <th>\u30c1\u30fc\u30e0</th><th>\u653b\u6483\u56de\u6570</th><th>\u5f97\u70b9</th><th>\u653b\u6483\u6210\u529f\u7387</th>
        <th>SP\u5f97\u70b9</th><th>SP\u30b7\u30e5\u30fc\u30c8</th><th>SP\u6210\u529f\u7387</th>
        <th>\u901f\u653b\u5f97\u70b9</th><th>\u901f\u653b\u30b7\u30e5\u30fc\u30c8</th><th>\u901f\u653b\u6210\u529f\u7387</th>
        <th>Field</th><th>Line</th><th>Wing</th><th>Brk</th><th>Free</th><th>7m</th>
        <th>AST</th><th>ERR</th>
      </tr></thead><tbody>
        ${sorted.map(t => {
      const spG = t.fieldG + t.lineG + t.wingG + t.brkG + t.freeG + t.sevenG;
      const spA = t.fieldA + t.lineA + t.wingA + t.brkA + t.freeA + t.sevenA;
      const atkR = t.attacks ? ((t.goalsFor / t.attacks) * 100).toFixed(1) : '-';
      return `<tr><td><strong>${t.code}</strong></td>
          <td class="num" style="font-weight:600">${t.attacks}</td><td class="num">${t.goalsFor}</td>
          <td class="num" style="color:var(--accent-cyan)">${atkR}%</td>
          <td class="num">${spG}</td><td class="num">${spA}</td><td class="num">${pct(spG, spA)}%</td>
          <td class="num" style="color:var(--accent-green)">${t.fastG}</td><td class="num">${t.fastA}</td><td class="num">${pct(t.fastG, t.fastA)}%</td>
          <td class="num">${t.fieldG}/${t.fieldA}</td><td class="num">${t.lineG}/${t.lineA}</td>
          <td class="num">${t.wingG}/${t.wingA}</td>
          <td class="num">${t.brkG}/${t.brkA}</td><td class="num">${t.freeG}/${t.freeA}</td><td class="num">${t.sevenG}/${t.sevenA}</td>
          <td class="num">${t.assists}</td><td class="num">${t.errors}</td></tr>`;
    }).join('')}
      </tbody></table></div>
      <div class="section-title" style="margin-top:24px"><span class="icon">\ud83d\udee1\ufe0f</span> \u5b88\u5099\u7d71\u8a08</div>
      <div class="table-container"><table class="data-table" id="defTable"><thead><tr>
        <th>チーム</th><th>守備回数</th><th>失点</th><th>守備成功率</th>
        <th>被SP失点</th><th>被SPシュート</th><th>被SP率</th>
        <th>被速攻失点</th><th>被速攻シュート</th><th>被速攻率</th>
        <th>Field</th><th>Line</th><th>Wing</th><th>Brk</th><th>Free</th><th>7m</th>
        <th>相手ERR</th><th>警告</th><th>退場</th>
      </tr></thead><tbody>
        ${sorted.map(t => {
      const dR = t.defenses ? (((1 - t.goalsAgainst / t.defenses) * 100).toFixed(1)) : '-';
      const ospG = t.oppFieldG + t.oppLineG + t.oppWingG + t.oppBrkG + t.oppFreeG + t.oppSevenG;
      const ospA = t.oppFieldA + t.oppLineA + t.oppWingA + t.oppBrkA + t.oppFreeA + t.oppSevenA;
      return `<tr><td><strong>${t.code}</strong></td>
          <td class="num" style="font-weight:600">${t.defenses}</td><td class="num">${t.goalsAgainst}</td>
          <td class="num" style="color:var(--accent-green)">${dR}%</td>
          <td class="num">${ospG}</td><td class="num">${ospA}</td><td class="num">${pct(ospG, ospA)}%</td>
          <td class="num" style="color:var(--accent-red)">${t.oppFastG}</td><td class="num">${t.oppFastA}</td><td class="num">${pct(t.oppFastG, t.oppFastA)}%</td>
          <td class="num">${t.oppFieldG}/${t.oppFieldA}</td><td class="num">${t.oppLineG}/${t.oppLineA}</td>
          <td class="num">${t.oppWingG}/${t.oppWingA}</td>
          <td class="num">${t.oppBrkG}/${t.oppBrkA}</td><td class="num">${t.oppFreeG}/${t.oppFreeA}</td><td class="num">${t.oppSevenG}/${t.oppSevenA}</td>
          <td class="num">${t.oppErrors}</td>
          <td class="num">${t.warnings}</td><td class="num">${t.suspensions}</td></tr>`;
    }).join('')}
      </tbody></table></div>`;
    makeSortable('atkTable'); makeSortable('defTable');
    renderTeamCharts(sorted);
  };
  render();
  document.getElementById('tmPhase').addEventListener('change', render);
}

function renderTeamCharts(sorted) {
  const labels = sorted.map(t => t.code);
  if (charts.teamRate) charts.teamRate.destroy();
  charts.teamRate = new Chart(document.getElementById('chartTeamRate'), {
    type: 'bar',
    data: {
      labels, datasets: [{
        label: '\u6210\u529f\u7387(%)', data: sorted.map(t => t.totalA ? ((t.totalG / t.totalA) * 100).toFixed(1) : 0),
        backgroundColor: labels.map((_, i) => `hsla(${220 + i * 12},70%,60%,0.7)`), borderRadius: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: '#9a9eb8' }, grid: { color: 'rgba(99,115,255,0.06)' } }, y: { ticks: { color: '#9a9eb8' }, grid: { color: 'rgba(99,115,255,0.06)' } } }
    }
  });
  if (charts.shotTypes) charts.shotTypes.destroy();
  const types = [['Field', 'fieldG', '#6373ff'], ['Line', 'lineG', '#a855f7'], ['Wing', 'wingG', '#00d4ff'],
  ['Fast Brk', 'fastG', '#34d399'], ['Brk Thr', 'brkG', '#fb923c'], ['Free Thr', 'freeG', '#f472b6'], ['7m', 'sevenG', '#fbbf24']];
  charts.shotTypes = new Chart(document.getElementById('chartShotTypes'), {
    type: 'bar',
    data: { labels, datasets: types.map(([lbl, key, col]) => ({ label: lbl, data: sorted.map(t => t[key]), backgroundColor: col + '99', borderRadius: 2 })) },
    options: {
      responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#9a9eb8', boxWidth: 12 } } },
      scales: {
        x: { stacked: true, ticks: { color: '#9a9eb8' }, grid: { color: 'rgba(99,115,255,0.06)' } },
        y: { stacked: true, ticks: { color: '#9a9eb8' }, grid: { color: 'rgba(99,115,255,0.06)' } }
      }
    }
  });
}

// ===== Players Tab =====
function renderPlayers() {
  const el = document.getElementById('tab-players');
  el.innerHTML = `<div class="filters-bar">${phaseFilterHtml('plPhase')}
    <select class="filter-select" id="plTeam"><option value="ALL">\u5168\u30c1\u30fc\u30e0</option>${allTeamCodes.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
  </div><div id="plContent"></div>`;
  const render = () => {
    const fm = filterMatches(document.getElementById('plPhase').value);
    const r = computeStats(fm); const ps = r.playerStats;
    const tf = document.getElementById('plTeam').value;
    const fp = tf === 'ALL' ? ps : ps.filter(p => p.team === tf);
    const topS = fp.filter(p => p.totalGoals > 0).sort((a, b) => b.totalGoals - a.totalGoals).slice(0, 30);
    const topA = fp.filter(p => p.assists > 0).sort((a, b) => b.assists - a.assists).slice(0, 20);
    const topR = fp.filter(p => p.totalShots >= 10).sort((a, b) => (b.totalGoals / b.totalShots) - (a.totalGoals / a.totalShots)).slice(0, 20);
    document.getElementById('plContent').innerHTML = `
      <div class="charts-grid">
        <div class="chart-card"><div class="chart-card-title">\u26bd \u5f97\u70b9\u30e9\u30f3\u30ad\u30f3\u30b0 TOP15</div><div class="chart-wrapper"><canvas id="chartTopScorers"></canvas></div></div>
        <div class="chart-card"><div class="chart-card-title">\ud83c\udd70\ufe0f \u30a2\u30b7\u30b9\u30c8 TOP15</div><div class="chart-wrapper"><canvas id="chartTopAssists"></canvas></div></div>
      </div>
      <div class="section-title"><span class="icon">\u2b50</span> \u5f97\u70b9\u30e9\u30f3\u30ad\u30f3\u30b0</div>
      <div class="table-container"><table class="data-table" id="scorerTable"><thead><tr>
        <th>#</th><th>\u9078\u624b</th><th>\u30c1\u30fc\u30e0</th><th>\u8a66\u5408</th><th>\u5f97\u70b9</th><th>\u30b7\u30e5\u30fc\u30c8</th><th>\u7387</th>
        <th>Field</th><th>Line</th><th>Wing</th><th>Fast</th><th>Brk</th><th>Free</th><th>7m</th><th>AST</th>
      </tr></thead><tbody>
        ${topS.map((p, i) => `<tr><td><span class="rank-badge ${i < 3 ? ['gold', 'silver', 'bronze'][i] : 'default'}">${i + 1}</span></td>
          <td><strong>#${p.number} ${p.name}</strong></td><td>${p.team}</td><td class="num">${p.matches}</td>
          <td class="num" style="font-weight:700">${p.totalGoals}</td><td class="num">${p.totalShots}</td>
          <td class="num">${pct(p.totalGoals, p.totalShots)}%</td>
          <td class="num">${p.fieldG}</td><td class="num">${p.lineG}</td><td class="num">${p.wingG}</td>
          <td class="num">${p.fastG}</td><td class="num">${p.brkG}</td><td class="num">${p.freeG}</td>
          <td class="num">${p.sevenG}</td><td class="num">${p.assists}</td></tr>`).join('')}
      </tbody></table></div>
      <div style="margin-top:28px">
      <div class="section-title"><span class="icon">\ud83c\udfaf</span> \u30b7\u30e5\u30fc\u30c8\u6210\u529f\u7387\u30e9\u30f3\u30ad\u30f3\u30b0\uff0810\u672c\u4ee5\u4e0a\uff09</div>
      <div class="table-container"><table class="data-table" id="rateTable"><thead><tr>
        <th>#</th><th>\u9078\u624b</th><th>\u30c1\u30fc\u30e0</th><th>\u5f97\u70b9/\u30b7\u30e5\u30fc\u30c8</th><th>\u7387</th>
      </tr></thead><tbody>
        ${topR.map((p, i) => `<tr><td><span class="rank-badge ${i < 3 ? ['gold', 'silver', 'bronze'][i] : 'default'}">${i + 1}</span></td>
          <td><strong>#${p.number} ${p.name}</strong></td><td>${p.team}</td>
          <td class="num">${p.totalGoals}/${p.totalShots}</td>
          <td class="num" style="font-weight:700">${pct(p.totalGoals, p.totalShots)}%</td></tr>`).join('')}
      </tbody></table></div></div>`;
    makeSortable('scorerTable'); makeSortable('rateTable');
    renderPlayerCharts(topS, topA);
  };
  render();
  document.getElementById('plPhase').addEventListener('change', render);
  document.getElementById('plTeam').addEventListener('change', render);
}

function renderPlayerCharts(scorers, assists) {
  const s15 = scorers.slice(0, 15); const a15 = assists.slice(0, 15);
  if (charts.topScorers) charts.topScorers.destroy();
  charts.topScorers = new Chart(document.getElementById('chartTopScorers'), {
    type: 'bar',
    data: {
      labels: s15.map(p => `#${p.number} ${p.name} (${p.team})`),
      datasets: [{ label: '\u5f97\u70b9', data: s15.map(p => p.totalGoals), backgroundColor: 'rgba(99,115,255,0.7)', borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9a9eb8' }, grid: { color: 'rgba(99,115,255,0.06)' } },
        y: { ticks: { color: '#9a9eb8', font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
  if (charts.topAssists) charts.topAssists.destroy();
  charts.topAssists = new Chart(document.getElementById('chartTopAssists'), {
    type: 'bar',
    data: {
      labels: a15.map(p => `#${p.number} ${p.name} (${p.team})`),
      datasets: [{ label: '\u30a2\u30b7\u30b9\u30c8', data: a15.map(p => p.assists), backgroundColor: 'rgba(0,212,255,0.7)', borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9a9eb8' }, grid: { color: 'rgba(99,115,255,0.06)' } },
        y: { ticks: { color: '#9a9eb8', font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
}
// ===== Matches Tab =====
function renderMatches() {
  const el = document.getElementById('tab-matches');
  const teams = ['ALL', ...Object.keys(teamStats).sort()];
  const phases = [...new Set(DATA.matches.map(m => m.phase).filter(Boolean))].sort();

  el.innerHTML = `
    <div class="filters-bar">
      <select class="filter-select" id="filterTeam"><option value="ALL">全チーム</option>${teams.filter(t => t !== 'ALL').map(t => `<option value="${t}">${t}</option>`).join('')}</select>
      <select class="filter-select" id="filterPhase"><option value="ALL">全ラウンド</option>${phases.map(p => `<option value="${p}">${p}</option>`).join('')}</select>
      <input class="filter-input" id="filterSearch" placeholder="🔍 試合を検索...">
    </div>
    <div class="matches-grid" id="matchesGrid"></div>`;

  const render = () => {
    const ft = document.getElementById('filterTeam').value;
    const fp = document.getElementById('filterPhase').value;
    const fs = document.getElementById('filterSearch').value.toLowerCase();
    let matches = DATA.matches.filter(m => {
      if (ft !== 'ALL' && m.home_team.code !== ft && m.away_team.code !== ft) return false;
      if (fp !== 'ALL' && m.phase !== fp) return false;
      if (fs && !`${m.home_team.code} ${m.away_team.code} ${m.home_team.name} ${m.away_team.name}`.toLowerCase().includes(fs)) return false;
      return true;
    });
    document.getElementById('matchesGrid').innerHTML = matches.map(m => {
      const hw = m.score.home > m.score.away, aw = m.score.away > m.score.home;
      return `<div class="match-card" onclick="showMatchDetail(${m.match_number})">
        <div class="match-card-header"><div class="match-card-meta"><span>M${m.match_number}</span><span>${m.date || ''}</span><span>${m.time || ''}</span></div>
          <div class="match-card-badge">${m.phase || m.group || ''}</div></div>
        <div class="match-card-teams">
          <div class="match-card-team"><div><div class="match-card-team-code">${m.home_team.code}</div><div class="match-card-team-name">${m.home_team.name}</div></div></div>
          <div class="match-card-score"><span class="match-card-score-num ${hw ? 'winner' : 'loser'}">${m.score.home}</span>
            <span class="match-card-score-sep">-</span>
            <span class="match-card-score-num ${aw ? 'winner' : 'loser'}">${m.score.away}</span></div>
          <div class="match-card-team away"><div><div class="match-card-team-code">${m.away_team.code}</div><div class="match-card-team-name">${m.away_team.name}</div></div></div>
        </div>
        <div class="match-card-halftime">HT: ${m.score.home_half} - ${m.score.away_half}</div>
        <div class="match-card-footer"><span>📍 ${m.venue || ''}</span></div></div>`;
    }).join('') || '<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">該当する試合がありません</div></div>';
  };
  render();
  document.getElementById('filterTeam').addEventListener('change', render);
  document.getElementById('filterPhase').addEventListener('change', render);
  document.getElementById('filterSearch').addEventListener('input', render);
}

// ===== Match Detail Modal =====
function showMatchDetail(num) {
  const m = DATA.matches.find(x => x.match_number === num); if (!m) return;
  const modal = document.getElementById('matchModal');
  const content = document.getElementById('matchModalContent');
  const hw = m.score.home > m.score.away;
  const renderPlayerTable = (players, label) => {
    if (!players || !players.length) return '';
    const field = players.filter(p => !p.is_goalkeeper);
    const gks = players.filter(p => p.is_goalkeeper);
    return `<div class="modal-section"><div class="modal-section-title">${label}</div>
      <div class="table-container"><table class="data-table"><thead><tr>
        <th>No</th><th>選手名</th><th>Field</th><th>Line</th><th>Wing</th><th>Fast</th><th>Brk</th><th>Free</th><th>7m</th><th>合計</th><th>率%</th><th>AST</th><th>ERR</th><th>WAR</th><th>2'</th>
      </tr></thead><tbody>
        ${field.map(p => `<tr><td>${p.number}</td><td><strong>${p.name}</strong></td>
          <td class="num">${p.field_shot}</td><td class="num">${p.line_shot}</td><td class="num">${p.wing_shot}</td>
          <td class="num">${p.fast_break}</td><td class="num">${p.breakthrough}</td><td class="num">${p.free_throw}</td>
          <td class="num">${p.seven_m}</td><td class="num" style="font-weight:700">${p.total}</td>
          <td class="num">${p.rate || '-'}</td><td class="num">${p.assists || ''}</td><td class="num">${p.errors || ''}</td>
          <td class="num">${p.warnings || ''}</td><td class="num">${p.suspensions || ''}</td></tr>`).join('')}
        ${gks.length ? `<tr style="background:rgba(99,115,255,0.06)"><td colspan="15" style="font-weight:600;color:var(--text-muted)">GK</td></tr>` : ''}
        ${gks.map(p => `<tr style="background:rgba(99,115,255,0.03)"><td>${p.number}</td><td><strong>${p.name}</strong> 🧤</td>
          <td class="num">${p.field_shot}</td><td class="num">${p.line_shot}</td><td class="num">${p.wing_shot}</td>
          <td class="num">${p.fast_break}</td><td class="num">${p.breakthrough}</td><td class="num">${p.free_throw}</td>
          <td class="num">${p.seven_m}</td><td class="num" style="font-weight:700">${p.total}</td>
          <td class="num">${p.rate || '-'}</td><td class="num">${p.assists || ''}</td><td class="num">${p.errors || ''}</td>
          <td class="num">${p.warnings || ''}</td><td class="num">${p.suspensions || ''}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  };

  content.innerHTML = `
    <div class="modal-header"><div><div style="font-size:0.82rem;color:var(--text-muted)">Match ${m.match_number} · ${m.phase || ''} · ${m.group || ''}</div>
      <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">📍 ${m.venue || ''} · ${m.date || ''} ${m.time || ''}</div></div>
      <button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-score-banner">
      <div class="modal-team"><div class="modal-team-code" style="color:${hw ? 'var(--accent-green)' : 'var(--text-secondary)'}">${m.home_team.code}</div><div class="modal-team-name">${m.home_team.name}</div></div>
      <div class="modal-score-center"><div class="modal-score-main">${m.score.home} : ${m.score.away}</div><div class="modal-score-half">HT ${m.score.home_half} : ${m.score.away_half}</div></div>
      <div class="modal-team"><div class="modal-team-code" style="color:${!hw && m.score.home !== m.score.away ? 'var(--accent-green)' : 'var(--text-secondary)'}">${m.away_team.code}</div><div class="modal-team-name">${m.away_team.name}</div></div>
    </div>
    ${renderPlayerTable(m.home_players, `${m.home_team.code} - ${m.home_team.name}`)}
    ${renderPlayerTable(m.away_players, `${m.away_team.code} - ${m.away_team.name}`)}`;
  modal.classList.add('visible');
}

function closeModal() { document.getElementById('matchModal').classList.remove('visible'); }
document.getElementById('matchModal').addEventListener('click', e => { if (e.target.id === 'matchModal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ===== Shots Tab =====
function renderShots() {
  const el = document.getElementById('tab-shots');
  const types = [{ key: 'field', label: 'Field Shot', icon: '🏃' },
  { key: 'line', label: 'Line Shot (6m)', icon: '📏' }, { key: 'wing', label: 'Wing Shot', icon: '🦅' },
  { key: 'fast', label: 'Fast Break', icon: '⚡' }, { key: 'brk', label: 'Breakthrough', icon: '💥' },
  { key: 'free', label: 'Free Throw', icon: '🎯' }, { key: 'seven', label: '7m Throw', icon: '7️⃣' }];
  const totals = types.map(t => {
    let g = 0, a = 0; Object.values(teamStats).forEach(ts => { g += ts[t.key + 'G']; a += ts[t.key + 'A']; });
    return { ...t, goals: g, attempts: a, rate: a ? (g / a * 100).toFixed(1) : '0' };
  });
  const grandTotal = totals.reduce((s, t) => ({ g: s.g + t.goals, a: s.a + t.attempts }), { g: 0, a: 0 });

  el.innerHTML = `
    <div class="stats-grid">
      ${totals.map(t => `<div class="stat-card"><div class="stat-card-icon blue">${t.icon}</div>
        <div class="stat-card-info"><div class="stat-card-value">${t.goals}<span style="font-size:0.7em;color:var(--text-muted)">/${t.attempts}</span></div>
        <div class="stat-card-label">${t.label} (${t.rate}%)</div>
        <div class="progress-bar-container" style="margin-top:6px"><div class="progress-bar"><div class="progress-bar-fill blue" style="width:${t.rate}%"></div></div><span style="font-size:0.72rem;color:var(--text-muted)">${t.rate}%</span></div>
      </div></div>`).join('')}
    </div>
    <div class="charts-grid">
      <div class="chart-card"><div class="chart-card-title">🥧 シュート種類別構成比</div><div class="chart-wrapper"><canvas id="chartShotDist"></canvas></div></div>
      <div class="chart-card"><div class="chart-card-title">🎯 種類別成功率</div><div class="chart-wrapper"><canvas id="chartShotRate"></canvas></div></div>
    </div>
    <div class="section-title"><span class="icon">📊</span> チーム×シュート種類 成功率</div>
    <div class="table-container"><table class="data-table" id="shotDetailTable"><thead><tr>
      <th>チーム</th>${types.map(t => `<th>${t.label}</th>`).join('')}<th>合計</th>
    </tr></thead><tbody>
      ${Object.values(teamStats).sort((a, b) => b.totalG - a.totalG).map(t =>
    `<tr><td><strong>${t.code}</strong></td>
        ${types.map(ty => `<td class="num">${pct(t[ty.key + 'G'], t[ty.key + 'A'])}%</td>`).join('')}
        <td class="num" style="font-weight:700">${pct(t.totalG, t.totalA)}%</td></tr>`).join('')}
    </tbody></table></div>`;
  makeSortable('shotDetailTable');

  const colors = ['#6373ff', '#a855f7', '#00d4ff', '#34d399', '#fb923c', '#f472b6', '#fbbf24'];
  if (charts.shotDist) charts.shotDist.destroy();
  charts.shotDist = new Chart(document.getElementById('chartShotDist'), {
    type: 'doughnut',
    data: { labels: totals.map(t => t.label), datasets: [{ data: totals.map(t => t.goals), backgroundColor: colors, borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#9a9eb8', padding: 12 } } } }
  });

  if (charts.shotRate) charts.shotRate.destroy();
  charts.shotRate = new Chart(document.getElementById('chartShotRate'), {
    type: 'bar',
    data: { labels: totals.map(t => t.label), datasets: [{ label: '成功率 (%)', data: totals.map(t => +t.rate), backgroundColor: colors.map(c => c + '99'), borderRadius: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9a9eb8' }, grid: { color: 'rgba(99,115,255,0.06)' } },
        y: { ticks: { color: '#9a9eb8' }, grid: { color: 'rgba(99,115,255,0.06)' }, min: 0, max: 100 }
      }
    }
  });
}

// ===== Goalkeepers Tab =====
function renderGoalkeepers() {
  const el = document.getElementById('tab-goalkeepers');
  el.innerHTML = `<div class="filters-bar">${phaseFilterHtml('gkPhase')}
    <select class="filter-select" id="gkTeam"><option value="ALL">全チーム</option>${allTeamCodes.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
  </div><div id="gkContent"></div>`;
  const render = () => {
    const fm = filterMatches(document.getElementById('gkPhase').value);
    const r = computeStats(fm);
    const tf = document.getElementById('gkTeam').value;
    const gks = tf === 'ALL' ? r.gkStats : r.gkStats.filter(g => g.team === tf);
    const sorted = [...gks].sort((a, b) => (b.saves / b.faced) - (a.saves / a.faced));
    const totalSaves = gks.reduce((s, g) => s + g.saves, 0);
    const totalFaced = gks.reduce((s, g) => s + g.faced, 0);
    const avgRate = totalFaced ? ((totalSaves / totalFaced) * 100).toFixed(1) : '-';
    const best = sorted[0];
    const bestRate = best ? ((best.saves / best.faced) * 100).toFixed(1) : '-';

    // Team-level GK aggregation
    const teamGK = {};
    gks.forEach(g => {
      if (!teamGK[g.team]) teamGK[g.team] = { code: g.team, saves: 0, faced: 0, fieldS: 0, fieldF: 0, lineS: 0, lineF: 0, wingS: 0, wingF: 0, fastS: 0, fastF: 0, brkS: 0, brkF: 0, freeS: 0, freeF: 0, sevenS: 0, sevenF: 0 };
      const t = teamGK[g.team];
      t.saves += g.saves; t.faced += g.faced;
      ['field', 'line', 'wing', 'fast', 'brk', 'free', 'seven'].forEach(k => { t[k + 'S'] += g[k + 'S']; t[k + 'F'] += g[k + 'F']; });
    });
    const teamSorted = Object.values(teamGK).sort((a, b) => (b.faced ? b.saves / b.faced : 0) - (a.faced ? a.saves / a.faced : 0));

    document.getElementById('gkContent').innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-card-icon blue">🧤</div><div class="stat-card-info"><div class="stat-card-value">${gks.length}</div><div class="stat-card-label">GK総数</div></div></div>
        <div class="stat-card"><div class="stat-card-icon cyan">🛡️</div><div class="stat-card-info"><div class="stat-card-value">${totalSaves}<span style="font-size:0.7em;color:var(--text-muted)">/${totalFaced}</span></div><div class="stat-card-label">総セーブ数</div></div></div>
        <div class="stat-card"><div class="stat-card-icon green">📊</div><div class="stat-card-info"><div class="stat-card-value">${avgRate}%</div><div class="stat-card-label">平均セーブ率</div></div></div>
        <div class="stat-card"><div class="stat-card-icon orange">⭐</div><div class="stat-card-info"><div class="stat-card-value">${best ? bestRate + '%' : '-'}</div><div class="stat-card-label">${best ? '#' + best.number + ' ' + best.name + ' (' + best.team + ')' : '-'}</div></div></div>
      </div>
      <div class="charts-grid">
        <div class="chart-card"><div class="chart-card-title">🧤 セーブ率 TOP10</div><div class="chart-wrapper"><canvas id="chartGkSaveRate"></canvas></div></div>
        <div class="chart-card"><div class="chart-card-title">🛡️ シュート種類別セーブ率</div><div class="chart-wrapper"><canvas id="chartGkShotTypeSaves"></canvas></div></div>
      </div>
      <div class="charts-grid">
        <div class="chart-card" style="grid-column:1/-1"><div class="chart-card-title">📊 被シュート数 vs セーブ率</div><div class="chart-wrapper" style="height:450px"><canvas id="chartGkScatter"></canvas></div></div>
      </div>
      <div class="section-title"><span class="icon">⭐</span> GKランキング</div>
      <div class="table-container"><table class="data-table" id="gkTable"><thead><tr>
        <th>#</th><th>選手</th><th>チーム</th><th>試合</th><th>セーブ</th><th>被シュート</th><th>セーブ率</th>
        <th>Field</th><th>Line</th><th>Wing</th><th>Fast</th><th>Brk</th><th>Free</th><th>7m</th>
      </tr></thead><tbody>
        ${sorted.map((g, i) => {
      const rate = ((g.saves / g.faced) * 100).toFixed(1);
      const rb = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'default';
      return `<tr><td><span class="rank-badge ${rb}">${i + 1}</span></td>
            <td><strong>#${g.number} ${g.name}</strong></td><td>${g.team}</td><td class="num">${g.matches}</td>
            <td class="num" style="font-weight:700;color:var(--accent-green)">${g.saves}</td>
            <td class="num">${g.faced}</td>
            <td class="num" style="font-weight:700">${rate}%</td>
            <td class="num">${g.fieldS}/${g.fieldF}</td><td class="num">${g.lineS}/${g.lineF}</td>
            <td class="num">${g.wingS}/${g.wingF}</td><td class="num">${g.fastS}/${g.fastF}</td>
            <td class="num">${g.brkS}/${g.brkF}</td><td class="num">${g.freeS}/${g.freeF}</td>
            <td class="num">${g.sevenS}/${g.sevenF}</td></tr>`;
    }).join('')}
      </tbody></table></div>
      <div class="section-title" style="margin-top:24px"><span class="icon">🏆</span> チーム別GKセーブ率</div>
      <div class="table-container"><table class="data-table" id="gkTeamTable"><thead><tr>
        <th>チーム</th><th>セーブ</th><th>被シュート</th><th>セーブ率</th>
        <th>Field</th><th>Line</th><th>Wing</th><th>Fast</th><th>Brk</th><th>Free</th><th>7m</th>
      </tr></thead><tbody>
        ${teamSorted.map(t => {
      const rate = t.faced ? ((t.saves / t.faced) * 100).toFixed(1) : '-';
      return `<tr><td><strong>${t.code}</strong></td>
            <td class="num" style="font-weight:700;color:var(--accent-green)">${t.saves}</td>
            <td class="num">${t.faced}</td>
            <td class="num" style="font-weight:700">${rate}%</td>
            <td class="num">${pct(t.fieldS, t.fieldF)}%</td><td class="num">${pct(t.lineS, t.lineF)}%</td>
            <td class="num">${pct(t.wingS, t.wingF)}%</td><td class="num">${pct(t.fastS, t.fastF)}%</td>
            <td class="num">${pct(t.brkS, t.brkF)}%</td><td class="num">${pct(t.freeS, t.freeF)}%</td>
            <td class="num">${pct(t.sevenS, t.sevenF)}%</td></tr>`;
    }).join('')}
      </tbody></table></div>`;

    makeSortable('gkTable'); makeSortable('gkTeamTable');

    // Chart: Save Rate Top 10
    const top10 = sorted.slice(0, 10);
    if (charts.gkSaveRate) charts.gkSaveRate.destroy();
    charts.gkSaveRate = new Chart(document.getElementById('chartGkSaveRate'), {
      type: 'bar',
      data: {
        labels: top10.map(g => `#${g.number} ${g.name} (${g.team})`),
        datasets: [{ label: 'セーブ率 (%)', data: top10.map(g => ((g.saves / g.faced) * 100).toFixed(1)), backgroundColor: top10.map((_, i) => `hsla(${160 + i * 15}, 65%, 55%, 0.75)`), borderRadius: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } },
        scales: {
          x: { min: 0, max: 100, ticks: { color: '#9a9eb8' }, grid: { color: 'rgba(99,115,255,0.06)' } },
          y: { ticks: { color: '#9a9eb8', font: { size: 11 } }, grid: { display: false } }
        }
      }
    });

    // Chart: Shot Type Save Rates
    const shotTypes = [
      { key: 'field', label: 'Field' }, { key: 'line', label: 'Line' }, { key: 'wing', label: 'Wing' },
      { key: 'fast', label: 'Fast Brk' }, { key: 'brk', label: 'Brk Thr' }, { key: 'free', label: 'Free' }, { key: 'seven', label: '7m' }
    ];
    const stTotals = shotTypes.map(t => {
      let s = 0, f = 0; gks.forEach(g => { s += g[t.key + 'S']; f += g[t.key + 'F']; });
      return { label: t.label, rate: f ? ((s / f) * 100).toFixed(1) : 0 };
    });
    const stColors = ['#6373ff', '#a855f7', '#00d4ff', '#34d399', '#fb923c', '#f472b6', '#fbbf24'];
    if (charts.gkShotTypeSaves) charts.gkShotTypeSaves.destroy();
    charts.gkShotTypeSaves = new Chart(document.getElementById('chartGkShotTypeSaves'), {
      type: 'bar',
      data: {
        labels: stTotals.map(t => t.label),
        datasets: [{ label: 'セーブ率 (%)', data: stTotals.map(t => +t.rate), backgroundColor: stColors.map(c => c + '99'), borderRadius: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#9a9eb8' }, grid: { color: 'rgba(99,115,255,0.06)' } },
          y: { ticks: { color: '#9a9eb8' }, grid: { color: 'rgba(99,115,255,0.06)' }, min: 0, max: 100 }
        }
      }
    });

    // Chart: Scatter — Shots Faced vs Save Rate
    const scatterData = sorted.map(g => ({
      x: g.faced, y: +((g.saves / g.faced) * 100).toFixed(1), label: '#' + g.number + ' ' + g.name, team: g.team
    }));
    // Group by team for coloring
    const teamGroups = {};
    scatterData.forEach(d => {
      if (!teamGroups[d.team]) teamGroups[d.team] = [];
      teamGroups[d.team].push(d);
    });
    const scatterColors = ['#6373ff', '#00d4ff', '#a855f7', '#34d399', '#fb923c', '#f472b6', '#fbbf24', '#ef4444',
      '#8b5cf6', '#06b6d4', '#84cc16', '#f59e0b', '#ec4899', '#14b8a6', '#e11d48'];
    const teamKeys = Object.keys(teamGroups).sort();
    const scatterDatasets = teamKeys.map((team, i) => ({
      label: team,
      data: teamGroups[team],
      backgroundColor: (TEAM_COLORS[team] || scatterColors[i % scatterColors.length]) + 'cc',
      borderColor: TEAM_COLORS[team] || scatterColors[i % scatterColors.length],
      pointRadius: 8, pointHoverRadius: 12, borderWidth: 2
    }));
    if (charts.gkScatter) charts.gkScatter.destroy();
    charts.gkScatter = new Chart(document.getElementById('chartGkScatter'), {
      type: 'scatter',
      data: { datasets: scatterDatasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#9a9eb8', boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: ctx => { const d = ctx.raw; return `${d.label} (${d.team}): 被シュート${d.x} / セーブ率${d.y}%`; }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: '被シュート数', color: '#9a9eb8', font: { size: 13 } },
            ticks: { color: '#9a9eb8' }, grid: { color: 'rgba(99,115,255,0.08)' }
          },
          y: {
            title: { display: true, text: 'セーブ率 (%)', color: '#9a9eb8', font: { size: 13 } },
            ticks: { color: '#9a9eb8' }, grid: { color: 'rgba(99,115,255,0.08)' }, min: 0, max: 60
          }
        }
      },
      plugins: [{
        id: 'gkLabelPoints', afterDatasetsDraw(chart) {
          const ctx = chart.ctx; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
          chart.data.datasets.forEach((ds, di) => {
            const meta = chart.getDatasetMeta(di);
            meta.data.forEach((pt, pi) => {
              ctx.fillStyle = ds.borderColor;
              ctx.fillText('#' + ds.data[pi].label.match(/#(\d+)/)[1] + ' ' + ds.data[pi].label.split(' ').slice(1, 2).join(''), pt.x, pt.y - 12);
            });
          });
        }
      }]
    });
  };
  render();
  document.getElementById('gkPhase').addEventListener('change', render);
  document.getElementById('gkTeam').addEventListener('change', render);
}

// ===== Header scroll effect =====
window.addEventListener('scroll', () => { document.getElementById('header').classList.toggle('scrolled', window.scrollY > 10); });

// ===== Init =====
async function init() {
  initTabs();
  try {
    const resp = await fetch('data.json');
    DATA = await resp.json();
    processData(DATA);
    document.getElementById('loadingIndicator').style.display = 'none';
    renderHeaderStats(); renderOverview(); renderTeams(); renderPlayers(); renderMatches(); renderShots(); renderGoalkeepers();
  } catch (e) {
    document.getElementById('loadingIndicator').innerHTML = `<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-text">データの読み込みに失敗しました: ${e.message}</div></div>`;
  }
}
init();
