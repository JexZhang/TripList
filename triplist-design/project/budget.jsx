/* eslint-disable react/prop-types, no-undef */
// budget.jsx — 开销页：环形图 + 每日折线 + 最贵一笔高亮

const { useMemo } = React;

function BudgetView({ trip }) {
  const total = BUDGET_BUCKETS.reduce((s, b) => s + b.value, 0);
  const perPax = Math.round(total / trip.pax);

  // 计算 donut 角度
  let acc = 0;
  const segments = BUDGET_BUCKETS.map(b => {
    const start = acc;
    const angle = (b.value / total) * 360;
    acc += angle;
    return { ...b, start, end: acc, pct: (b.value / total) * 100 };
  });

  // conic-gradient 字符串
  const conic = segments.map(s =>
    `${s.color} ${s.start}deg ${s.end}deg`
  ).join(', ');

  // 折线图：宽 268 高 70，6 点（含起点）
  const maxV = Math.max(...BUDGET_DAILY.map(d => d.v));
  const w = 268, h = 64, pad = 6;
  const pts = BUDGET_DAILY.map((d, i) => {
    const x = pad + (i / (BUDGET_DAILY.length - 1)) * (w - pad * 2);
    const y = h - pad - (d.v / maxV) * (h - pad * 2);
    return { x, y, d };
  });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${path} L${pts[pts.length-1].x.toFixed(1)},${h} L${pts[0].x.toFixed(1)},${h} Z`;
  const maxIdx = pts.findIndex(p => p.d.v === maxV);

  return (
    <div className="bv">
      {/* 标题与总览 */}
      <div className="bv-head">
        <div>
          <div className="bv-total-label">本次总开销</div>
          <div className="bv-total-value">¥{total.toLocaleString()}</div>
          <div className="bv-perpax">
            人均 <b>¥{perPax.toLocaleString()}</b>
            <span className="bv-perpax-meta">· 比常规旅人省 12%</span>
          </div>
        </div>
        <div className="bv-donut-wrap">
          <div className="bv-donut" style={{ background: `conic-gradient(${conic})` }}>
            <div className="bv-donut-hole"></div>
          </div>
          <div className="bv-donut-center">
            <span className="bv-donut-pct">36%</span>
            <span className="bv-donut-cap">住宿占比</span>
          </div>
        </div>
      </div>

      {/* 图例 */}
      <div className="bv-legend">
        {segments.map(s => (
          <div key={s.key} className="bv-legend-row">
            <span className="bv-legend-sw" style={{ background: s.color }}></span>
            <span className="bv-legend-label">{s.label}</span>
            <span className="bv-legend-pct">{s.pct.toFixed(0)}%</span>
            <span className="bv-legend-v">¥{s.value.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* 每日折线 */}
      <div className="bv-card">
        <div className="bv-card-head">
          <span className="bv-card-title">每日花销</span>
          <span className="bv-card-cap">5 天 · 走势</span>
        </div>
        <svg className="bv-chart" viewBox={`0 0 ${w} ${h + 22}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="bv-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28"/>
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d={area} fill="url(#bv-fill)" />
          <path d={path} fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={i === maxIdx ? 3.5 : 2.2}
                fill={i === maxIdx ? 'var(--coral)' : 'var(--accent)'} />
              {i === maxIdx && (
                <>
                  <circle cx={p.x} cy={p.y} r="6" fill="none" stroke="var(--coral)" strokeWidth="1" opacity="0.4">
                    <animate attributeName="r" values="4;8;4" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <text x={p.x} y={p.y - 8} fontSize="9" fill="var(--coral)" textAnchor="middle"
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    ¥{p.d.v}
                  </text>
                </>
              )}
              <text x={p.x} y={h + 16} fontSize="8" fill="var(--ink-3)" textAnchor="middle"
                style={{ fontFamily: 'var(--font-mono)' }}>
                {p.d.d}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* 最贵一笔高亮 */}
      <div className="bv-card bv-highlight">
        <div className="bv-highlight-ribbon">本次最贵的一笔</div>
        <div className="bv-highlight-body">
          <div className="bv-highlight-icon">
            <Icon name={BUDGET_HIGHLIGHT.type} size={22} />
          </div>
          <div className="bv-highlight-info">
            <div className="bv-highlight-name">{BUDGET_HIGHLIGHT.name}</div>
            <div className="bv-highlight-meta">
              <Icon name="clock" size={11} /> {BUDGET_HIGHLIGHT.date}
              <span className="bv-highlight-cap">· {BUDGET_HIGHLIGHT.caption}</span>
            </div>
          </div>
          <div className="bv-highlight-price">¥{BUDGET_HIGHLIGHT.price}</div>
        </div>
      </div>

      {/* 按天展开的明细 */}
      <BudgetDailyBreakdown />

      <div className="bv-fade"></div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   开销明细：按天 group，每个 spot 一行，最贵的标红
   ───────────────────────────────────────────────────── */
const CAT_LABEL = { spot: '景', hotel: '宿', meal: '食', transport: '行' };

function BudgetDailyBreakdown() {
  // 找出全局最贵的一笔，用于高亮
  let maxPrice = 0;
  let maxKey = '';
  ACTIVE_TRIP_DAYS.forEach((d, di) => {
    d.spots.forEach((s, si) => {
      if ((s.price || 0) > maxPrice) {
        maxPrice = s.price || 0;
        maxKey = `${di}-${si}`;
      }
    });
  });

  return (
    <div className="bv-days">
      <div className="bv-days-head">
        <span className="bv-days-title">每日明细</span>
        <span className="bv-days-cap">5 DAYS · BREAKDOWN</span>
      </div>
      {ACTIVE_TRIP_DAYS.map((d, di) => {
        const dayTotal = d.spots.reduce((s, sp) => s + (sp.price || 0), 0);
        if (dayTotal === 0) return null;
        return (
          <div key={d.date} className="bv-day">
            <div className="bv-day-head">
              <span className="bv-day-no">DAY {String(di + 1).padStart(2, '0')}</span>
              <span className="bv-day-date">{d.date}</span>
              <span className="bv-day-total">¥{dayTotal.toLocaleString()}</span>
            </div>
            <div className="bv-day-list">
              {d.spots.filter(s => s.price).map((s, si) => {
                const k = `${di}-${si}`;
                const isMax = k === maxKey;
                return (
                  <div key={si} className={`bv-spot ${isMax ? 'bv-spot--max' : ''}`}>
                    <span className={`bv-spot-cat bv-spot-cat--${s.type}`}>{CAT_LABEL[s.type]}</span>
                    <span className="bv-spot-name">{s.name}</span>
                    {isMax && <span className="bv-spot-crown">最贵</span>}
                    <span className="bv-spot-price">¥{s.price}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, { BudgetView });
