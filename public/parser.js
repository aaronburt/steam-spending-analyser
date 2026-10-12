function parseSteamHistory(raw) {
  const MON = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  const DATE_DMY = /^(\d{1,2}) ([A-Za-z]{3}),? (\d{4})\s*(.*)$/;
  const DATE_MDY = /^([A-Za-z]{3}) (\d{1,2}),? (\d{4})\s*(.*)$/;
  const MONEY = /(?:(R\$|[A-Z]{0,3}[£$€¥₩₹₺₽])\s?(\d[\d.,  ]*\d|\d))|(?:(\d[\d.,  ]*\d|\d)\s?(€|zł|kr|руб\.?|pуб\.?|₴|TL|₸|CHF))/g;
  const TYPES = ['Purchase','Refund','Gift Purchase','In-Game Purchase'];
  const lines = raw.replace(/\r/g,'').split('\n');
  let user = null;
  const um = raw.match(/^\s*(.+?)'s Purchase History/m);
  if (um) user = um[1].trim();

  const symCount = {};
  const toNum = s => {
    s = s.replace(/[  ]/g,'');
    const m = s.match(/[.,](\d{1,2})$/);
    let intPart = s, dec = '';
    if (m) { intPart = s.slice(0, -m[0].length); dec = m[1]; }
    return parseFloat(intPart.replace(/[.,]/g,'') + (dec ? '.' + dec : '')) || 0;
  };
  const amounts = l => {
    const out = []; let m; MONEY.lastIndex = 0;
    while ((m = MONEY.exec(l))) {
      const sym = m[1] || m[4], num = m[2] || m[3];
      const key = (m[1] ? 'p:' : 's:') + sym; symCount[key] = (symCount[key]||0) + 1;
      out.push(toNum(num));
    }
    return out;
  };
  const parseDate = l => {
    const t = l.trim(); let m;
    if (/^\d/.test(t) && (m = t.match(DATE_DMY)) && MON[m[2].toLowerCase()] !== undefined)
      return {y:+m[3], mo:MON[m[2].toLowerCase()], d:+m[1], head:m[4]};
    if ((m = t.match(DATE_MDY)) && MON[m[1].toLowerCase()] !== undefined)
      return {y:+m[3], mo:MON[m[1].toLowerCase()], d:+m[2], head:m[4]};
    return null;
  };

  const blocks = []; let cur = null;
  for (const line of lines) {
    if (/^\s*©/.test(line)) break;
    const pd = parseDate(line);
    if (pd && !/^\s/.test(line)) {
      cur = {date: `${pd.y}-${String(pd.mo+1).padStart(2,'0')}-${String(pd.d).padStart(2,'0')}`, head: pd.head, lines: []};
      blocks.push(cur);
    } else if (cur) cur.lines.push(line);
  }

  const spend = [], refunds = []; let topups = 0, topupN = 0, market = 0, other = 0;
  const clean = s => s.replace(/&amp;amp;/g,'&').replace(/&amp;/g,'&').replace(/&trade;/g,'™').replace(/&reg;/g,'®');
  for (const b of blocks) {
    const {lines: ls, head} = b;
    const allText = head + '\n' + ls.join('\n');
    const firstAmountLine = () => {
      for (const l of ls) if (l.includes('\t')) { const a = amounts(l); if (a.length) return a[0]; }
      for (const l of ls) { const t = l.trim(), a = amounts(t); if (a.length === 2 && t.replace(MONEY,'').trim() === '') return a[1]; }
      for (const l of ls) { const t = l.trim(), a = amounts(t); if (a.length === 1 && t.replace(MONEY,'').trim() === '') return a[0]; }
      return 0;
    };
    if (/Market/i.test(head) || /Market Transaction/.test(ls.slice(0,3).join(' '))) { market++; amounts(allText); continue; }
    if (/Redemption/i.test(head)) { other++; continue; }
    if (/^Purchased .*Wallet Credit/i.test(head)) { topups += firstAmountLine(); topupN++; continue; }
    const names = []; let kind = null, to = null;
    for (const l of ls) {
      const s = l.trim();
      if (TYPES.includes(s)) { kind = s; break; }
      if (!s || s === 'Refund') continue;
      const g = s.match(/^Gift sent to (.+)$/);
      if (g) { to = g[1]; continue; }
      names.push(clean(s));
    }
    const isRefund = ls.some(l => l.trim() === 'Refund');
    const p = firstAmountLine();
    let o = null;
    for (const l of ls) {
      if (l.includes('\t')) continue;
      const t = l.trim();
      const a = amounts(t);
      if (a.length === 2 && t.replace(MONEY,'').trim() === '') { o = a[0]; break; }
    }
    const rec = {d: b.date, n: names[0] || 'Unknown item', more: Math.max(names.length - 1, 0), p, o: (o && o > p) ? o : null};
    if (isRefund) refunds.push(rec);
    else if (kind) {
      rec.k = kind === 'Gift Purchase' ? 'gift' : kind === 'In-Game Purchase' ? 'game' : 'own';
      if (to) rec.to = to;
      spend.push(rec);
    } else other++;
  }
  spend.sort((a,b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
  for (const r of refunds) {
    const c = spend.filter(s => s.n === r.n && s.d <= r.d && !s.r);
    if (c.length) c[c.length-1].r = 1;
    else { r.k = 'own'; r.r = 1; r.orphan = 1; }
  }
  const top = Object.entries(symCount).sort((a,b) => b[1]-a[1])[0];
  const currency = top ? {sym: top[0].slice(2), suffix: top[0][0] === 's'} : {sym:'', suffix:false};
  return {user, spend, refunds, refundTotal: refunds.reduce((s,r)=>s+r.p,0), topups, topupN, market, other, blocks: blocks.length, currency};
}
if (typeof module !== 'undefined') module.exports = parseSteamHistory;
