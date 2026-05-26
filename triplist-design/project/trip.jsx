/* eslint-disable react/prop-types, no-undef */
// trip.jsx — trip 详情页
// 3 态生命周期 + 4 tab 内容 + 主题驱动的 day-tab / map-mode 变体

const { useState } = React;

const TYPE_LABEL = {
  spot: '景', hotel: '宿', meal: '食', transport: '行',
};

// 主题 → day-tab variant / map-mode variant 映射
//   ticket   = 票根撕口式 (tegami)
//   spine    = 时间轴脊柱 (magazine)
//   calendar = 日历方块   (postcard)
//   simple   = 极简文字   (minimal)
const DAYTAB_VARIANT = {
  tegami:   'ticket',
  magazine: 'spine',
  postcard: 'calendar',
  minimal:  'simple',
};
//   track     = 颜色胶囊条 (tegami)
//   segmented = 分段控制器 (magazine)
//   route     = 路线卡片条 (postcard)
//   pill      = 极简胶囊   (minimal)
const MAPMODE_VARIANT = {
  tegami:   'track',
  magazine: 'segmented',
  postcard: 'route',
  minimal:  'pill',
};

function TripScreen({
  trip, theme, lifecycle, view, setView,
  aiStatus, onAIBadgeClick, onApplyAI,
  onBack,
}) {
  return (
    <div className="trip-page">
      <TripHeader trip={trip} onBack={onBack} view={view} aiStatus={aiStatus} onAIBadgeClick={onAIBadgeClick} />
      <TripBody trip={trip} theme={theme} lifecycle={lifecycle} view={view} aiStatus={aiStatus} onApplyAI={onApplyAI} />
      <TripTabBar view={view} setView={setView} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   顶部头：AI 徽章只在 itinerary tab 显示
   ───────────────────────────────────────────────────── */
function TripHeader({ trip, onBack, view, aiStatus, onAIBadgeClick }) {
  const showAI = view === 'itinerary' && (aiStatus === 'idle' || aiStatus === 'thinking');
  return (
    <header className="th">
      <button className="th-back" onClick={onBack}><Icon name="arrow-left" size={18}/></button>
      <div className="th-titleblock">
        <h1 className="th-name">{trip.name}</h1>
        <div className="th-meta">
          <span>{trip.startDate.replace(/-/g,'.')} → {trip.endDate.slice(5).replace('-','.')}</span>
          <span>·</span>
          <span>{trip.days} 天</span>
          <span>·</span>
          <span>{trip.pax} 人</span>
        </div>
      </div>
      <button className="th-menu"><Icon name="menu" size={18}/></button>

      {showAI && (
        <div className="th-ai-corner">
          <AIBadge status={aiStatus} compact onClick={onAIBadgeClick} />
        </div>
      )}
    </header>
  );
}

/* ─────────────────────────────────────────────────────
   主体（hero 只在 itinerary tab 显示）
   ───────────────────────────────────────────────────── */
function TripBody({ trip, theme, lifecycle, view, aiStatus, onApplyAI }) {
  const showHero = view === 'itinerary';
  return (
    <main className="tb">
      {showHero && lifecycle === 'pre'  && <PreTripHero  trip={trip} />}
      {showHero && lifecycle === 'live' && <LiveTripHero trip={trip} />}
      {showHero && lifecycle === 'post' && <PostTripHero trip={trip} />}

      {aiStatus === 'ready' && view === 'itinerary' && (
        <AIDraftBanner trip={trip} onApply={onApplyAI} />
      )}

      <section className="tb-section">
        {view === 'itinerary' && <ItineraryView trip={trip} theme={theme} />}
        {view === 'map'       && <MapView trip={trip} theme={theme} />}
        {view === 'budget'    && <BudgetView trip={trip} />}
        {view === 'packing'   && <PackingView trip={trip} />}
      </section>
    </main>
  );
}

/* ─────────────────────────────────────────────────────
   生命周期 hero
   ───────────────────────────────────────────────────── */
function PreTripHero({ trip }) {
  const pct = Math.round((trip.progress.packed / trip.progress.total) * 100);
  return (
    <div className="lc-pre">
      <div className="lc-pre-card">
        <div className="lc-pre-left">
          <div className="lc-pre-eyebrow">距出发 · D−{trip.daysToGo}</div>
          <div className="lc-pre-bignum">
            <span className="lc-pre-num">{trip.daysToGo}</span>
            <span className="lc-pre-unit">天</span>
          </div>
          <div className="lc-pre-dest"><Icon name="pin" size={12}/> {trip.destFull}</div>
        </div>
        <div className="lc-pre-right">
          <div className="lc-pre-pack-l">行李清单</div>
          <div className="lc-pre-pack-v">{trip.progress.packed}<span>/{trip.progress.total}</span></div>
          <div className="lc-pre-pack-bar">
            <span style={{ width: `${pct}%` }}></span>
          </div>
          <div className="lc-pre-pack-pct">{pct}% 已准备</div>
        </div>
      </div>
    </div>
  );
}

function LiveTripHero({ trip }) {
  return (
    <div className="lc-live">
      <div className="lc-eyebrow lc-eyebrow-live">
        <span className="lc-live-pulse"></span>
        LIVE / 第 2 天 · 14:30
      </div>
      <div className="lc-live-now">
        <div className="lc-live-now-tag">现在</div>
        <h3 className="lc-live-now-name">景山公园</h3>
        <div className="lc-live-now-meta">
          <span><Icon name="weather-cloud" size={12}/> 18° 阴</span>
          <span>·</span>
          <span>停留约 45 min</span>
        </div>
      </div>
      <div className="lc-live-next">
        <div className="lc-live-next-tag">下一站 · 15:30</div>
        <div className="lc-live-next-name">什刹海 · 银锭桥</div>
        <div className="lc-live-next-meta">
          <Icon name="walk" size={11}/> 步行 1.2 km · 18 min
          <span className="lc-live-next-cta">导航 <Icon name="arrow-right" size={11}/></span>
        </div>
      </div>
    </div>
  );
}

function PostTripHero({ trip }) {
  return (
    <div className="lc-post">
      <div className="lc-eyebrow">RECAP / 回 顾</div>
      <div className="lc-post-cover" style={{ '--c1': trip.color[0], '--c2': trip.color[1] }}>
        <div className="lc-post-cover-meta">{trip.startDate.slice(0,4)} · 春</div>
        <div className="lc-post-cover-dest">{trip.destFull}</div>
        <div className="lc-post-cover-days">{trip.days} 天 · {trip.pax} 人同行</div>
        <div className="lc-post-stats">
          <div className="lc-post-stat">
            <span className="v">{trip.spotsCount}</span>
            <span className="l">SPOTS</span>
          </div>
          <div className="lc-post-stat">
            <span className="v">{trip.walked}<i>km</i></span>
            <span className="l">WALKED</span>
          </div>
          <div className="lc-post-stat">
            <span className="v">¥{(trip.spent/1000).toFixed(1)}k</span>
            <span className="l">SPENT</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   AI 草稿就绪横幅
   ───────────────────────────────────────────────────── */
function AIDraftBanner({ trip, onApply }) {
  return (
    <div className="ai-banner">
      <div className="ai-banner-icon">
        <Icon name="sparkle-fill" size={18} />
      </div>
      <div className="ai-banner-body">
        <div className="ai-banner-title">AI 草稿 · 5 天 · 28 个点位</div>
        <div className="ai-banner-sub">基于你的偏好已生成完整行程，确认应用？</div>
      </div>
      <button className="ai-banner-cta" onClick={onApply}>预览</button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   攻略视图 + 4 套 day-tab variant
   ───────────────────────────────────────────────────── */
function ItineraryView({ trip, theme }) {
  const [activeDay, setActiveDay] = useState(0);
  const day = ACTIVE_TRIP_DAYS[activeDay] || ACTIVE_TRIP_DAYS[0];
  const variant = DAYTAB_VARIANT[theme] || 'ticket';

  return (
    <div className="iv">
      <DayTabs variant={variant} activeDay={activeDay} setActiveDay={setActiveDay} />

      <div className="iv-dayhead">
        <div>
          <div className="iv-dayhead-no">DAY {activeDay + 1} · {day.date}</div>
          <div className="iv-dayhead-summary">{day.spots.length} 个安排</div>
        </div>
        <div className="iv-weather">
          <Icon name={day.weather.type === 'sun' ? 'weather-sun' : 'weather-cloud'} size={18} />
          <span>{day.weather.temp}</span>
          <span className="iv-weather-cap">{day.weather.label}</span>
        </div>
      </div>

      <div className="iv-spots">
        {day.spots.map((s, i) => (
          <div key={i} className="iv-spot" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="iv-spot-time">
              <span className="iv-spot-time-v">{s.time}</span>
              <span className="iv-spot-line"></span>
            </div>
            <div className={`iv-spot-card iv-spot-card--${s.type}`}>
              <span className={`iv-spot-tag iv-spot-tag--${s.type}`}>
                <Icon name={s.type} size={11} />
              </span>
              <div className="iv-spot-body">
                <div className="iv-spot-name">{s.name}</div>
                {s.note && <div className="iv-spot-note">{s.note}</div>}
              </div>
              {s.price ? <div className="iv-spot-price">¥{s.price}</div> : null}
            </div>
          </div>
        ))}
        <button className="iv-add">
          <Icon name="plus" size={14}/> 添加地点
        </button>
      </div>
    </div>
  );
}

/* ── DayTabs 多变体 ─────────────────────────────── */
function DayTabs({ variant, activeDay, setActiveDay }) {
  const days = ACTIVE_TRIP_DAYS;
  return (
    <div className={`dt dt--${variant}`}>
      <div className="dt-scroll">
        {days.map((d, i) => {
          const date = d.date;
          const m = date.slice(5, 7);
          const day = date.slice(8, 10);
          const on = i === activeDay;
          return (
            <button key={d.date}
              className={`dt-item ${on ? 'on' : ''}`}
              onClick={() => setActiveDay(i)}>
              {variant === 'ticket' && (
                <>
                  <span className="dt-no">{String(i + 1).padStart(2, '0')}</span>
                  <span className="dt-sep"></span>
                  <span className="dt-date">{m}/{day}</span>
                  <span className="dt-label">Day {i + 1}</span>
                  <span className="dt-notch dt-notch-t"></span>
                  <span className="dt-notch dt-notch-b"></span>
                </>
              )}
              {variant === 'spine' && (
                <>
                  <span className="dt-dot"></span>
                  <span className="dt-no">D{i + 1}</span>
                  <span className="dt-date">{m}/{day}</span>
                </>
              )}
              {variant === 'calendar' && (
                <>
                  <span className="dt-month">{Number(m)} 月</span>
                  <span className="dt-bigday">{Number(day)}</span>
                  <span className="dt-label">Day {i + 1}</span>
                </>
              )}
              {variant === 'simple' && (
                <>
                  <span className="dt-simple-num">{i + 1}</span>
                  <span className="dt-simple-date">{m}.{day}</span>
                </>
              )}
            </button>
          );
        })}
        <button className="dt-add" onClick={() => {}}>
          {variant === 'calendar' ? <Icon name="plus" size={16}/> : '+'}
        </button>
      </div>
      {variant === 'spine' && <div className="dt-spine-line"></div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   地图视图 + 4 套 map-mode variant（模仿当前项目）
   ───────────────────────────────────────────────────── */
const MAP_DAYS = [
  {
    label: 'Day 1', date: '4/26', color: '#FF7A2E',
    pins: [
      { x: 80, y: 100, label: '故宫', n: 1, type: 'spot' },
      { x: 120, y: 140, label: '景山', n: 2, type: 'spot' },
      { x: 160, y: 130, label: '什刹海', n: 3, type: 'spot' },
      { x: 200, y: 170, label: '同和居', n: 4, type: 'meal' },
      { x: 240, y: 200, label: '后海', n: 5, type: 'spot' },
    ],
    route: 'M80,100 L120,140 L160,130 L200,170 L240,200',
    summary: '故宫 → 景山 → 什刹海 → 同和居 → 后海',
    distance: '8.4 km',
  },
  {
    label: 'Day 2', date: '4/27', color: '#4FB286',
    pins: [
      { x: 60, y: 80, label: '颐和园', n: 1, type: 'spot' },
      { x: 130, y: 130, label: '同和居', n: 2, type: 'meal' },
      { x: 180, y: 200, label: '银锭桥', n: 3, type: 'spot' },
      { x: 240, y: 230, label: '后海酒吧', n: 4, type: 'meal' },
    ],
    route: 'M60,80 L130,130 L180,200 L240,230',
    summary: '颐和园 → 同和居 → 银锭桥 → 后海酒吧',
    distance: '14.2 km',
  },
  {
    label: 'Day 3', date: '4/28', color: '#6B46C1',
    pins: [
      { x: 90, y: 60, label: '八达岭', n: 1, type: 'spot' },
      { x: 170, y: 130, label: '十三陵', n: 2, type: 'spot' },
      { x: 220, y: 220, label: '簋街', n: 3, type: 'meal' },
    ],
    route: 'M90,60 L170,130 L220,220',
    summary: '八达岭 → 十三陵 → 簋街',
    distance: '120 km',
  },
];

function MapView({ trip, theme }) {
  const [mode, setMode] = useState(0); // index OR 'all'
  const variant = MAPMODE_VARIANT[theme] || 'track';
  const isAll = mode === 'all';
  const showDay = isAll ? null : MAP_DAYS[mode];
  // 'all' 模式：合并所有 pin
  const allPins = MAP_DAYS.flatMap((d, di) => d.pins.map(p => ({ ...p, dayIdx: di, color: d.color })));

  return (
    <div className="mv">
      <MapModeBar variant={variant} mode={mode} onChange={setMode} />
      <div className="mv-canvas">
        <svg className="mv-svg" viewBox="0 0 320 320" preserveAspectRatio="xMidYMid slice" key={String(mode)}>
          <defs>
            <pattern id="mv-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0H0V32" stroke="var(--line)" strokeWidth="0.6" fill="none"/>
            </pattern>
          </defs>
          <rect width="320" height="320" fill="url(#mv-grid)"/>
          <path d="M30,60 Q120,40 200,80 T310,140" stroke="var(--line-2)" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.5"/>
          <path d="M40,200 Q150,180 240,220 T320,260" stroke="var(--line-2)" strokeWidth="8" fill="none" strokeLinecap="round" opacity="0.4"/>
          {!isAll && (
            <path d={showDay.route} stroke={showDay.color} strokeWidth="2.2" strokeDasharray="4 3" fill="none">
              <animate attributeName="stroke-dashoffset" from="40" to="0" dur="0.6s" />
            </path>
          )}
        </svg>

        {(isAll ? allPins : showDay.pins).map((p, idx) => (
          <div key={`${mode}-${idx}-${p.n}`} className={`mv-pin mv-pin--${p.type}`}
            style={{
              left: `${p.x/3.2}%`, top: `${p.y/3.2}%`,
              animationDelay: `${idx * 40}ms`,
              '--pin-c': p.color || (showDay && showDay.color) || 'var(--accent)',
            }}>
            <span className="mv-pin-no">{p.n}</span>
            <span className="mv-pin-label">{p.label}</span>
          </div>
        ))}
      </div>
      <div className="mv-card" key={String(mode)}>
        <div className="mv-card-head">
          <Icon name="compass" size={14}/>
          {isAll
            ? <span>全部 · {allPins.length} 个点位 · {MAP_DAYS.length} 天</span>
            : <span>{showDay.label} 路线 · {showDay.pins.length} 个点位 · {showDay.distance}</span>}
        </div>
        <div className="mv-card-body">
          {isAll ? '查看全部日程合并视图' : showDay.summary}
        </div>
      </div>
    </div>
  );
}

/* ── MapModeBar 多变体 ─────────────────────────── */
function MapModeBar({ variant, mode, onChange }) {
  return (
    <div className={`mb mb--${variant}`}>
      {variant === 'track' && <ModeTrack mode={mode} onChange={onChange} />}
      {variant === 'segmented' && <ModeSegmented mode={mode} onChange={onChange} />}
      {variant === 'route' && <ModeRoute mode={mode} onChange={onChange} />}
      {variant === 'pill' && <ModePill mode={mode} onChange={onChange} />}
    </div>
  );
}

function ModeTrack({ mode, onChange }) {
  return (
    <div className="mb-track-scroll">
      <button className={`mb-track-item ${mode === 'all' ? 'on' : ''}`}
        style={{ '--c': '#2B1A10' }}
        onClick={() => onChange('all')}>
        <span className="mb-track-dot"></span>
        <span className="mb-track-label">全部</span>
      </button>
      {MAP_DAYS.map((d, i) => (
        <button key={i}
          className={`mb-track-item ${mode === i ? 'on' : ''}`}
          style={{ '--c': d.color }}
          onClick={() => onChange(i)}>
          <span className="mb-track-dot"></span>
          <span className="mb-track-label">D{i + 1} {d.date}</span>
        </button>
      ))}
    </div>
  );
}

function ModeSegmented({ mode, onChange }) {
  const items = [{ label: '全部', mode: 'all' }, ...MAP_DAYS.map((d, i) => ({ label: `D${i+1}`, sub: d.date, mode: i }))];
  return (
    <div className="mb-seg">
      {items.map((it, i) => (
        <button key={i}
          className={`mb-seg-item ${mode === it.mode ? 'on' : ''}`}
          onClick={() => onChange(it.mode)}>
          <span className="mb-seg-label">{it.label}</span>
          {it.sub && <span className="mb-seg-sub">{it.sub}</span>}
        </button>
      ))}
    </div>
  );
}

function ModeRoute({ mode, onChange }) {
  return (
    <div className="mb-route-scroll">
      <button className={`mb-route-item mb-route-all ${mode === 'all' ? 'on' : ''}`}
        onClick={() => onChange('all')}>
        <span className="mb-route-no">全部</span>
        <span className="mb-route-sub">{MAP_DAYS.length} 天</span>
      </button>
      {MAP_DAYS.map((d, i) => (
        <div key={i} className="mb-route-cell">
          <span className="mb-route-link"></span>
          <button className={`mb-route-item ${mode === i ? 'on' : ''}`}
            style={{ '--c': d.color }}
            onClick={() => onChange(i)}>
            <span className="mb-route-no">D{i + 1}</span>
            <span className="mb-route-date">{d.date}</span>
            <span className="mb-route-sub">{d.pins.length} 点</span>
          </button>
        </div>
      ))}
    </div>
  );
}

function ModePill({ mode, onChange }) {
  const items = [{ label: '全部', mode: 'all' }, ...MAP_DAYS.map((d, i) => ({ label: `Day ${i+1}`, mode: i }))];
  return (
    <div className="mb-pill">
      {items.map((it, i) => (
        <button key={i}
          className={`mb-pill-item ${mode === it.mode ? 'on' : ''}`}
          onClick={() => onChange(it.mode)}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   行李清单
   ───────────────────────────────────────────────────── */
const PACK_CATS = [
  { id: 'id', icon: 'pk-id', label: '证件', items: [
    { l: '身份证', c: true }, { l: '护照', c: true }, { l: '驾照', c: false },
  ]},
  { id: 'cloth', icon: 'pk-cloth', label: '衣物', items: [
    { l: '外套 × 2', c: true }, { l: 'T 恤 × 5', c: true }, { l: '内衣', c: false }, { l: '泳衣', c: false },
  ]},
  { id: 'elec', icon: 'pk-elec', label: '电子', items: [
    { l: '手机充电器', c: true }, { l: '充电宝', c: true }, { l: '相机', c: false },
  ]},
  { id: 'care', icon: 'pk-care', label: '洗漱', items: [
    { l: '牙刷牙膏', c: true }, { l: '护肤水乳', c: false }, { l: '防晒霜', c: false },
  ]},
];
function PackingView({ trip }) {
  const total = PACK_CATS.reduce((s, c) => s + c.items.length, 0);
  const done = PACK_CATS.reduce((s, c) => s + c.items.filter(i => i.c).length, 0);
  return (
    <div className="pv">
      <div className="pv-head">
        <div>
          <div className="pv-head-l">已收拾</div>
          <div className="pv-head-v">{done}<span>/{total}</span></div>
        </div>
        <div className="pv-head-bar">
          <span style={{ width: `${(done/total)*100}%` }}></span>
        </div>
      </div>
      {PACK_CATS.map(cat => (
        <div key={cat.id} className="pv-group">
          <div className="pv-group-head">
            <Icon name={cat.icon} size={16}/>
            <span>{cat.label}</span>
            <span className="pv-group-count">{cat.items.filter(i=>i.c).length}/{cat.items.length}</span>
          </div>
          {cat.items.map((it, i) => (
            <div key={i} className={`pv-item ${it.c ? 'done' : ''}`}>
              <span className="pv-check">{it.c && <Icon name="check" size={11} stroke={2.5}/>}</span>
              <span className="pv-label">{it.l}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   底部 tab bar
   ───────────────────────────────────────────────────── */
const TABS = [
  { key: 'itinerary', label: '攻略', icon: 'itinerary' },
  { key: 'map',       label: '地图', icon: 'map' },
  { key: 'budget',    label: '开销', icon: 'budget' },
  { key: 'packing',   label: '清单', icon: 'packing' },
];
function TripTabBar({ view, setView }) {
  return (
    <nav className="tab-bar">
      {TABS.map(t => (
        <button key={t.key}
          className={`tb-item ${view === t.key ? 'on' : ''}`}
          onClick={() => setView(t.key)}>
          <span className="tb-icon"><Icon name={t.icon} size={20} fill={view === t.key}/></span>
          <span className="tb-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

Object.assign(window, { TripScreen });
