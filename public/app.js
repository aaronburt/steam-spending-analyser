const KEY = 'steam-spending-raw';
const KIND = {own:'Your library',gift:'Gift',game:'In-game purchase'};
const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dt = s => new Date(s + 'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
const sum = a => a.reduce((s,r) => s + r.p, 0);
const pct = (a,b) => b ? Math.round(a / b * 100) : 0;
let CUR = {sym:'£', suffix:false};
const money = n => {
  const v = n.toLocaleString(CUR.suffix ? 'de-DE' : 'en-GB', {minimumFractionDigits:2, maximumFractionDigits:2});
  return CUR.suffix ? v + CUR.sym : CUR.sym + v;
};
const moneyR = n => CUR.suffix ? Math.round(n).toLocaleString('de-DE') + CUR.sym : CUR.sym + Math.round(n).toLocaleString('en-GB');
const disc = (r, big) => r.o
  ? `<span class="disc${big?' big':''}"><span class="pct">-${Math.round((1 - r.p / r.o) * 100)}%</span><span class="px"><span class="was">${money(r.o)}</span><span class="now">${money(r.p)}</span></span></span>`
  : `<span class="disc full"><span class="px"><span class="now">${money(r.p)}</span></span></span>`;
const nice = v => { const e = Math.pow(10, Math.floor(Math.log10(v))); const f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; };
const list = a => a.length < 2 ? a.join('') : a.slice(0,-1).join(', ') + ' and ' + a[a.length-1];


function donut(title, slices, c1, c2, note) {
  slices = slices.filter(s => s.value > 0);
  const total = slices.reduce((s,x) => s + x.value, 0), R = 44, C = 2 * Math.PI * R;
  let off = 0, arcs = '';
  slices.forEach(s => {
    const len = s.value / total * C, gap = slices.length > 1 ? Math.min(1.6, len * 0.3) : 0;
    arcs += `<circle class="sl" cx="60" cy="60" r="${R}" style="stroke:${s.color}" stroke-dasharray="${Math.max(len-gap,0.1).toFixed(2)} ${(C-len+gap).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 60 60)"><title>${esc(s.label)}: ${money(s.value)} (${pct(s.value,total)}%)</title></circle>`;
    off += len;
  });
  return `<div class="donut"><h3>${title}</h3>
    <svg class="dsvg" viewBox="0 0 120 120" role="img" aria-label="${esc(title)}">${arcs}<text class="c1" x="60" y="62">${c1}</text><text class="c2" x="60" y="73">${c2}</text></svg>
    <ul class="dleg">${slices.map(s => `<li><span class="dot" style="--c:${s.color}"></span><span>${esc(s.label)}</span><span>${money(s.value)}</span><span class="p">${pct(s.value,total)}%</span></li>`).join('')}</ul>
    ${note ? `<p class="dnote">${note}</p>` : ''}</div>`;
}

function render(res, isSample) {
  CUR = res.currency.sym ? res.currency : {sym:'', suffix:false};
  const D = res.spend; D.forEach((r,i) => r.i = i);
  document.getElementById('user').textContent = res.user || 'Steam account';
  document.getElementById('banner').hidden = !isSample;

  const gross = sum(D), refundT = res.refundTotal, net = gross - refundT;
  const discd = D.filter(r => r.o), full = D.filter(r => !r.o);
  const listT = discd.reduce((s,r) => s + r.o, 0), paidD = sum(discd);
  const gifts = D.filter(r => r.k === 'gift'), games = D.filter(r => r.k === 'game');
  const by = {}; D.forEach(r => (by[r.d.slice(0,4)] ||= []).push(r));
  const years = Object.keys(by).map(Number);
  const y0 = Math.min(...years), y1 = Math.max(...years);
  const yTot = y => sum(by[y] || []);
  const peakY = years.reduce((a,b) => yTot(b) > yTot(a) ? b : a, y0);
  const first = D[0].d, last = D[D.length-1].d;
  const biggest = D.reduce((a,b) => b.p > a.p ? b : a, D[0]);

  const notes = [];
  const pm = Array(12).fill(0); by[peakY].forEach(r => pm[+r.d.slice(5,7)-1] += r.p);
  const pmI = pm.indexOf(Math.max(...pm));
  notes.push([`${pct(yTot(peakY), gross)}%`, `of everything was spent in ${peakY}: ${money(yTot(peakY))} across ${by[peakY].length} purchase${by[peakY].length>1?'s':''}. ${MN[pmI]} that year came to ${money(pm[pmI])}.`]);
  if (discd.length) notes.push([`-${Math.round((1 - paidD / listT) * 100)}%`, `was the average discount on ${discd.length} sale purchase${discd.length>1?'s':''}: ${money(listT)} at list price, ${money(paidD)} paid. ${full.length} full-price buy${full.length===1?'':'s'} came to ${money(sum(full))}.`]);
  const small = D.filter(r => r.p < 5).length;
  notes.push([`${small} of ${D.length}`, `purchases cost under ${moneyR(5)}. The biggest single purchase was ${esc(biggest.n)} at ${money(biggest.p)}.`]);
  const gaps = []; for (let y = y0; y <= y1; y++) if (!by[y]) gaps.push(y);
  if (y1 - y0 >= 4) {
    const recent = [y1-2, y1-1, y1], rAvg = recent.reduce((s,y) => s + yTot(y), 0) / 3, allAvg = gross / (y1 - y0 + 1);
    notes.push([money(rAvg), `a year on average in ${y1-2}–${y1}, compared with ${money(allAvg)} a year across ${y0}–${y1}.${gaps.length ? ` No purchases in ${list(gaps.map(String))}.` : ''}`]);
  }
  if (res.refunds.length) {
    const br = res.refunds.reduce((a,b) => b.p > a.p ? b : a);
    notes.push([`${res.refunds.length} refund${res.refunds.length>1?'s':''}`, `returned ${money(refundT)}, about ${pct(refundT, gross)}% of gross spend. The largest was ${esc(br.n)} at ${money(br.p)}.`]);
  } else notes.push(['0 refunds', 'Every purchase in this history was kept.']);
  if (gifts.length) {
    const rc = {}; gifts.forEach(g => { if (g.to) rc[g.to] = (rc[g.to]||0) + 1; });
    const topR = Object.entries(rc).sort((a,b) => b[1]-a[1]).slice(0,3).map(([n,c]) => `${esc(n)} (${c})`);
    notes.push([money(sum(gifts)), `on ${gifts.length} gift${gifts.length>1?'s':''}, about ${pct(sum(gifts), gross)}% of gross spend.${topR.length ? ` Most went to ${list(topR)}.` : ''}`]);
  } else if (games.length) {
    notes.push([money(sum(games)), `on ${games.length} in-game purchase${games.length>1?'s':''}, about ${pct(sum(games), gross)}% of gross spend.`]);
  }


  const ownT = sum(D.filter(r => r.k === 'own')), giftT = sum(gifts), gameT = sum(games);
  const yRank = years.slice().sort((a,b) => yTot(b) - yTot(a));
  const SH = ['#66c0f4','#4a9fd0','#3a7ea8','#2d6080'];
  const ySl = yRank.slice(0, years.length > 5 ? 4 : 5).map((y,i) => ({label: String(y), value: yTot(y), color: SH[i] || '#2d6080'}));
  const restT = gross - ySl.reduce((s,x) => s + x.value, 0);
  if (restT > 0.005) ySl.push({label: `Other ${yRank.length - ySl.length} years`, value: restT, color: '#2f4a63'});
  const donuts = [
    donut('By type of purchase', [
      {label:'Your library', value: ownT, color:'var(--own)'}, {label:'Gifts', value: giftT, color:'var(--gift)'}, {label:'In-game', value: gameT, color:'var(--game)'}
    ], moneyR(gross), 'gross'),
    donut('Sale or full price', [
      {label:'Bought on sale', value: paidD, color:'#8cb82a'}, {label:'Full price', value: sum(full), color:'#4f7fa3'}
    ], `${pct(paidD, gross)}%`, 'on sale', discd.length ? `${discd.length} of ${D.length} purchases were discounted.` : ''),
    donut('Share by year', ySl, String(yRank[0]), 'top year')
  ].join('');

  const mv = Array(12).fill(0); D.forEach(r => mv[+r.d.slice(5,7)-1] += r.p);
  const top2 = [...mv.keys()].sort((a,b) => mv[b]-mv[a]).slice(0,2).sort((a,b) => a-b);
  const mmax = Math.max(...mv);

  const bigList = [...D].sort((a,b) => b.p - a.p).slice(0,7);
  const deals = D.filter(r => r.o && !r.r).sort((a,b) => (b.o-b.p) - (a.o-a.p)).slice(0,7);
  const refs = [...res.refunds].sort((a,b) => b.p - a.p);
  const item = r => `<span class="nm">${esc(r.n)}</span>`;
  const more = r => r.more ? ` · +${r.more} more item${r.more>1?'s':''}` : '';

  document.getElementById('report').innerHTML = `
  <div class="hero"><div class="hero-in">
    <div>
      <p class="kicker">${dt(first)} – ${dt(last)} · net spend</p>
      <h1>${money(net)}</h1>
      <p class="lede">${D.length} purchases totalling ${money(gross)}${res.refunds.length ? `, minus ${money(refundT)} refunded` : ''}.</p>
    </div>
    ${discd.length ? `<div class="dealcard">
      <p>Your ${discd.length} discounted purchase${discd.length>1?'s':''}, all added up</p>
      ${disc({o:listT, p:paidD}, true)}
      <p>${money(listT - paidD)} saved against list prices.</p>
    </div>` : ''}
  </div></div>
  <div class="wrap">
    <dl class="stats">
      <div><dt>Purchases</dt><dd>${D.length}</dd></div>
      <div><dt>Average</dt><dd>${money(gross / D.length)}</dd></div>
      <div><dt>Refunds</dt><dd>${res.refunds.length}</dd></div>
      <div><dt>Gifts sent</dt><dd>${gifts.length}</dd></div>
      <div><dt>Peak year</dt><dd>${peakY}</dd></div>
    </dl>

    <section>
      <h2>Every purchase, to scale</h2>
      <p class="intro">Each block is one purchase, and its width is what it cost. All years share one scale. Hover over or tap a block to see what it was. Pick a range of years, or click a year, to zoom in. Zooming into one year lists each purchase on its own row.</p>
      <div class="panel">
        <ul class="legend">
          <li><span class="sw own"></span>Your library</li><li><span class="sw gift"></span>Gift</li>
          <li><span class="sw game"></span>In-game purchase</li><li><span class="sw ref"></span>Refunded</li>
        </ul>
        <div class="zoom">
          <label for="zf">Zoom</label><select id="zf"></select><span>to</span><select id="zt" aria-label="Zoom to year"></select>
          <button class="zbtn" id="zall" type="button">All years</button>
          <button class="zbtn" id="zlast" type="button">Last 5 years</button>
          <button class="zbtn" id="zpeak" type="button">Peak year</button>
          <span class="zinfo" id="zinfo"></span>
        </div>
        <div class="chartwrap" id="chartwrap">
          <div class="chart" id="chart"></div>
          <div class="axis" aria-hidden="true"><span></span><div id="axisTicks"></div><span></span></div>
        </div>
        <div class="readout" id="readout" aria-live="polite"></div>
      </div>
    </section>

    <section>
      <h2>What your history says</h2>
      <ul class="notes">${notes.map(([f,t]) => `<li><span class="fig">${f}</span><p>${t}</p></li>`).join('')}</ul>
    </section>

    <section>
      <h2>Spending by month</h2>
      <p class="intro">All years combined. The busiest months are ${MN[top2[0]]} and ${MN[top2[1]]}, together ${pct(mv[top2[0]] + mv[top2[1]], gross)}% of the total.</p>
      <div class="panel">
        <div class="months">${mv.map((v,i) => `<div class="m${top2.includes(i)?' hi':''}" title="${MN[i]}: ${money(v)}"><b>${moneyR(v)}</b><i style="height:${mmax ? (v/mmax*100).toFixed(1) : 0}%"></i></div>`).join('')}</div>
        <div class="mlabels">${MN.map(m => `<span>${m}</span>`).join('')}</div>
      </div>
    </section>

    <section>
      <h2>Where the money goes</h2>
      <div class="donuts">${donuts}</div>
    </section>

    <section>
      <h2>Purchase ledger highlights</h2>
      <div class="ledgers">
        <div class="ledger"><h3>Biggest single purchases</h3><div class="tw"><table>
          <tbody>${bigList.map(r => `<tr><td>${item(r)}<small>${dt(r.d)}${r.k!=='own'?' · '+KIND[r.k]:''}${more(r)}</small></td><td class="r">${disc(r)}</td></tr>`).join('')}</tbody>
        </table></div></div>
        <div class="ledger"><h3>Deepest discounts</h3>${deals.length ? `<div class="tw"><table>
          <tbody>${deals.map(r => `<tr><td>${item(r)}<small>Saved ${money(r.o-r.p)}${r.k==='gift'&&r.to?' · gift to '+esc(r.to):''}${more(r)}</small></td><td class="r">${disc(r)}</td></tr>`).join('')}</tbody>
        </table></div>` : `<p class="empty">No discounted purchases found.</p>`}</div>
        <div class="ledger wide"><h3>Refunds</h3>${refs.length ? `<div class="tw"><table>
          <tbody>${refs.map(r => `<tr><td>${item(r)}<small>Refunded ${dt(r.d)}</small></td><td class="r refund-amt">${money(r.p)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td>Total refunded</td><td class="r">${money(refundT)}</td></tr></tfoot>
        </table></div>` : `<p class="empty">No refunds in this history.</p>`}</div>
      </div>
    </section>

    <footer>
      <p>Figures use the Total column of each transaction. Wallet top-ups (${res.topupN}, ${money(res.topups)}) are left out because that money is already counted in the purchases it paid for. Gross spend includes gifts and in-game purchases. Market trades (${res.market}) and gift card redemptions are left out. Bundles are listed under their first item.</p>
      <p>Unofficial tool. Not affiliated with Valve or Steam.</p>
    </footer>
  </div>`;

  const chart = document.getElementById('chart'), ro = document.getElementById('readout');
  const show = i => {
    const r = D[i];
    chart.querySelectorAll('.s.on').forEach(e => e.classList.remove('on'));
    chart.querySelector(`[data-i="${i}"]`)?.classList.add('on');
    const tags = [];
    if (r.k === 'gift') tags.push(`<span class="tag gift">Gift</span>${r.to ? `Sent to <b>${esc(r.to)}</b>` : ''}`);
    if (r.r) tags.push(`<span class="tag ref">Refunded</span>The money was returned`);
    ro.innerHTML = `<div class="ro-meta">${dt(r.d)} · ${KIND[r.k]}</div>
      <div class="ro-name">${esc(r.n)}${r.more ? `<small>+ ${r.more} more item${r.more>1?'s':''} in this purchase</small>` : ''}</div>
      <div>${disc(r)}</div>${tags.length ? `<div class="ro-tag">${tags.join('<br>')}</div>` : ''}`;
  };
  const pick = e => { const b = e.target.closest('.s'); if (b) show(+b.dataset.i); };
  chart.addEventListener('pointerover', pick); chart.addEventListener('focusin', pick); chart.addEventListener('click', pick);
  let zf = y0, zt = y1;
  const $ = id => document.getElementById(id);
  const wrap = $('chartwrap'), axisEl = $('axisTicks'), zfEl = $('zf'), ztEl = $('zt'), zinfo = $('zinfo');
  const opts = []; for (let y = y0; y <= y1; y++) opts.push(`<option value="${y}">${y}</option>`);
  zfEl.innerHTML = ztEl.innerHTML = opts.join('');
  const mk = (r, w) => `<button class="s ${r.k}${r.r?' ref':''}" style="--w:${w}" data-i="${r.i}" aria-label="${esc(r.n)}, ${money(r.p)}, ${dt(r.d)}"></button>`;
  const drawChart = () => {
    zfEl.value = zf; ztEl.value = zt;
    const one = zf === zt, ticks = []; let rows = '', scaleMax;
    if (one) {
      const a = (by[zf] || []).slice().sort((x,y) => x.d < y.d ? -1 : 1), maxP = Math.max(...a.map(r => r.p), 1);
      const step = nice(maxP / 3); scaleMax = Math.ceil(maxP * 1.6 / step) * step;
      rows = a.map(r => `<div class="yr"><span class="y">${+r.d.slice(8)} ${MN[+r.d.slice(5,7)-1]}</span><div class="lane"><div class="strip one" style="width:${(r.p/scaleMax*100).toFixed(2)}%;min-width:3px">${mk(r,1)}</div><span class="nm2">${esc(r.n)}</span></div><span class="t">${money(r.p)}</span></div>`).join('') || '<span class="none">No purchases</span>';
      for (let v = 0; v < scaleMax; v += step) ticks.push(v);
    } else {
      const vis = []; for (let y = zf; y <= zt; y++) vis.push(y);
      const ymax = Math.max(...vis.map(yTot), 1), step = nice(ymax / 3); scaleMax = Math.ceil(ymax / step) * step;
      for (let v = 0; v < scaleMax; v += step) ticks.push(v);
      rows = vis.map(y => {
        const a = by[y] || [], tot = sum(a);
        const strip = a.length
          ? `<div class="strip" style="width:${(tot/scaleMax*100).toFixed(2)}%;min-width:${Math.min(a.length*3, 400)}px">${a.map(r => mk(r, r.p || 0.01)).join('')}</div>`
          : `<span class="none">No purchases</span>`;
        return `<div class="yr${y===peakY?' peak':''}"><button class="y" type="button" data-y="${y}" title="Zoom into ${y}">${y}</button><div class="lane">${strip}</div><span class="t">${a.length?money(tot):'—'}</span></div>`;
      }).join('');
    }
    wrap.classList.toggle('one', one);
    chart.innerHTML = rows;
    axisEl.innerHTML = ticks.map(v => `<span style="left:${v/scaleMax*100}%">${moneyR(v)}</span>`).join('');
    const inView = D.filter(r => +r.d.slice(0,4) >= zf && +r.d.slice(0,4) <= zt);
    zinfo.textContent = `${inView.length} purchase${inView.length===1?'':'s'} · ${money(sum(inView))}`;
    if (inView.length) show(inView.reduce((m,r) => r.p > m.p ? r : m).i); else ro.innerHTML = '';
  };
  const zoomTo = (a, b) => { zf = Math.max(y0, Math.min(a, b)); zt = Math.min(y1, Math.max(a, b)); drawChart(); };
  zfEl.addEventListener('change', () => zoomTo(+zfEl.value, Math.max(+zfEl.value, zt)));
  ztEl.addEventListener('change', () => zoomTo(Math.min(+ztEl.value, zf), +ztEl.value));
  $('zall').addEventListener('click', () => zoomTo(y0, y1));
  $('zlast').addEventListener('click', () => zoomTo(y1 - 4, y1));
  $('zpeak').addEventListener('click', () => zoomTo(peakY, peakY));
  chart.addEventListener('click', e => { const b = e.target.closest('button.y'); if (b) zoomTo(+b.dataset.y, +b.dataset.y); });
  drawChart();
}

const status = document.getElementById('status'), rawEl = document.getElementById('raw'), imp = document.getElementById('import');
const setStatus = (msg, ok) => { status.textContent = msg; status.className = 'status ' + (ok ? 'ok' : 'err'); };

function analyse(text, fromStore) {
  if (/<html|<table|<!doctype/i.test(text.slice(0, 2000))) {
    setStatus('That looks like a saved web page. Copy the page text instead: select all on the history page, copy, and paste here.'); return false;
  }
  const res = parseSteamHistory(text);
  if (!res.spend.length) {
    setStatus('No purchases found. Make sure you copied the whole Purchase History page with Steam set to English, including the table.'); return false;
  }
  render(res, false);
  document.getElementById('hint').textContent = `Showing your history: ${res.spend.length} purchases from ${res.blocks} transactions. Open to import another.`;
  setStatus(`Read ${res.blocks} transactions: ${res.spend.length} purchases, ${res.refunds.length} refunds, ${res.topupN} wallet top-ups, ${res.market} market trades.`, true);
  if (!fromStore) { try { localStorage.setItem(KEY, text); } catch (e) {} }
  imp.open = false;
  return true;
}

document.getElementById('go').addEventListener('click', () => {
  const t = rawEl.value.trim();
  if (!t) { setStatus('Paste your purchase history into the box first.'); rawEl.focus(); return; }
  if (analyse(t)) document.getElementById('report').scrollIntoView({behavior: 'smooth'});
});
document.getElementById('file').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const fr = new FileReader();
  fr.onload = () => { rawEl.value = fr.result; analyse(fr.result); };
  fr.onerror = () => setStatus('That file could not be read. Try pasting the text instead.');
  fr.readAsText(f);
  e.target.value = '';
});
document.getElementById('reset').addEventListener('click', () => {
  try { localStorage.removeItem(KEY); } catch (e) {}
  rawEl.value = '';
  render(parseSteamHistory(SAMPLE), true);
  setStatus('Showing the example account. Your saved history was cleared from this browser.', true);
  document.getElementById('hint').textContent = 'Runs in your browser. Nothing is uploaded.';
  imp.open = true;
});

let saved = null;
try { saved = localStorage.getItem(KEY); } catch (e) {}
if (!(saved && analyse(saved, true))) render(parseSteamHistory(SAMPLE), true);
