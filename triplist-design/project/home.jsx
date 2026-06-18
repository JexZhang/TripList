/* eslint-disable react/prop-types, no-undef */
// home.jsx — 4 套主题各自的首页隐喻
//   tegami   → 明信片堆叠（去掉印章，留位置给 AI/其它标记）
//   magazine → 杂志封面 / 编辑栏（封面图多方案 by magCover tweak）
//   postcard → 旅行护照页（信息丰富的盖戳，大小按天数动态）
//   minimal  → 极简清单
// brand logo 由 logoStyle tweak 决定（多方案）

const { useState } = React;

function HomeScreen({ theme, logoStyle, magCover, onOpenTrip, onNewTrip, onAI, aiStatus, aiTripId }) {
  const props = { onOpenTrip, onNewTrip, onAI, aiStatus, aiTripId, logoStyle, magCover };
  return (
    <div className={`home home--${theme}`}>
      {theme === 'tegami'   && <HomeTegami   {...props} />}
      {theme === 'magazine' && <HomeMagazine {...props} />}
      {theme === 'postcard' && <HomePostcard {...props} />}
      {theme === 'minimal'  && <HomeMinimal  {...props} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   行迹 logo 多方案（重做）
   logoStyle: seal | masthead | script | spine | bigtype
   ───────────────────────────────────────────────────── */
function BrandLogo({ style = 'seal', size = 'lg', theme = 'tegami' }) {
  if (style === 'seal') {
    // 钤印：红方章 + 反白衬线“行迹” + 旁注小字
    return (
      <div className={`brand brand--seal brand--${theme}`}>
        <div className="brand-seal-mark">
          <span className="brand-seal-chars">
            <span>行</span>
            <span>册</span>
          </span>
          <span className="brand-seal-corner-tl"></span>
          <span className="brand-seal-corner-br"></span>
        </div>
        <div className="brand-seal-side">
          <div className="brand-seal-en">XING · CE</div>
          <div className="brand-seal-cap">旅 行 簿 · 2026</div>
        </div>
      </div>
    );
  }

  if (style === 'masthead') {
    // 竖排刊头：行/册 上下排，左右双竖线
    return (
      <div className={`brand brand--masthead brand--${theme}`}>
        <div className="brand-mh-rules">
          <span className="brand-mh-rule"></span>
          <span className="brand-mh-rule brand-mh-rule-r"></span>
        </div>
        <div className="brand-mh-stack">
          <span className="brand-mh-ch">行</span>
          <span className="brand-mh-bar"></span>
          <span className="brand-mh-ch">册</span>
        </div>
        <div className="brand-mh-foot">TRAVEL · JOURNAL</div>
      </div>
    );
  }

  if (style === 'script') {
    // 钢笔签名风：手写感“行迹” + 下划波浪 + 小印
    return (
      <div className={`brand brand--script brand--${theme}`}>
        <div className="brand-sc-mark">行迹</div>
        <svg className="brand-sc-flourish" viewBox="0 0 120 18" preserveAspectRatio="none">
          <path d="M 0 9 Q 20 0 40 9 T 80 9 T 120 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          <circle cx="118" cy="9" r="2.2" fill="currentColor"/>
        </svg>
        <div className="brand-sc-foot">
          <span className="brand-sc-en">est. MMXXVI</span>
          <span className="brand-sc-dot"></span>
          <span className="brand-sc-en">a travel journal</span>
        </div>
      </div>
    );
  }

  if (style === 'spine') {
    // 书脊：上下双线 + VOL + 行迹 + 装订标记
    return (
      <div className={`brand brand--spine brand--${theme}`}>
        <div className="brand-sp-double"><span></span><span></span></div>
        <div className="brand-sp-vol">VOL. 012 — 2026</div>
        <div className="brand-sp-title">行 册</div>
        <div className="brand-sp-strap">TRAVEL · JOURNAL · 旅 行 簿</div>
        <div className="brand-sp-double"><span></span><span></span></div>
      </div>
    );
  }

  if (style === 'bigtype') {
    // 巨字号 + 红条 accent + 角标
    return (
      <div className={`brand brand--bigtype brand--${theme}`}>
        <div className="brand-bt-bar"></div>
        <div className="brand-bt-row">
          <h1 className="brand-bt-cn">行迹</h1>
          <div className="brand-bt-side">
            <span className="brand-bt-no">N°012</span>
            <span className="brand-bt-yr">2026</span>
          </div>
        </div>
        <div className="brand-bt-foot">
          <span className="brand-bt-dot"></span>
          <span className="brand-bt-en">XING CE · TRAVEL JOURNAL</span>
        </div>
      </div>
    );
  }

  // fallback
  return <div className={`brand brand--seal brand--${theme}`}>行迹</div>;
}

/* ─────────────────────────────────────────────────────
   首页 trip 卡上的 AI 状态行
   ───────────────────────────────────────────────────── */
function HomeCardAIRow({ status }) {
  if (status === 'thinking') {
    return (
      <div className="hc-ai hc-ai--thinking">
        <span className="hc-ai-shine"></span>
        <span className="hc-ai-icon"><Icon name="sparkle-fill" size={11} /></span>
        <span className="hc-ai-text">AI 正在为你编排 · 预计 30s</span>
        <span className="hc-ai-dots"><i></i><i></i><i></i></span>
      </div>
    );
  }
  if (status === 'ready') {
    return (
      <div className="hc-ai hc-ai--ready">
        <span className="hc-ai-icon"><Icon name="sparkle-fill" size={11} /></span>
        <span className="hc-ai-text">AI 草稿就绪 · 点击查看</span>
        <span className="hc-ai-arrow"><Icon name="chevron-right" size={11} /></span>
      </div>
    );
  }
  return null;
}

/* ─────────────────────────────────────────────────────
   手紙 · 明信片堆叠（无印章版）
   ───────────────────────────────────────────────────── */
function HomeTegami({ onOpenTrip, onNewTrip, aiStatus, aiTripId, logoStyle }) {
  return (
    <div className="home-tegami">
      <header className="ht-head">
        <div className="ht-issue">行迹 · No. 012 · 2026 春</div>
        <BrandLogo style={logoStyle} size="lg" theme="tegami" />
        <p className="ht-tag">你的旅行，值得被好好记录</p>
      </header>

      <div className="ht-stack">
        {SAMPLE_TRIPS.map((t, i) => {
          const ai = (t.id === aiTripId) ? aiStatus : null;
          return (
            <article key={t.id}
              className={`ht-card ht-card-${i} ${ai && ai !== 'idle' ? `ht-card--ai-${ai}` : ''}`}
              onClick={() => onOpenTrip(t)}
              style={{
                '--c1': t.color[0], '--c2': t.color[1],
                animationDelay: `${i * 80}ms`,
              }}>
              <div className="ht-card-edge"></div>
              <div className="ht-card-body">
                {ai && ai !== 'idle' && <HomeCardAIRow status={ai} />}
                <div className="ht-card-meta">{t.startDate.replace(/-/g, '.')} → {t.endDate.slice(5).replace('-', '.')}</div>
                <h3 className="ht-card-name">{t.name}</h3>
                <div className="ht-card-foot">
                  <span><Icon name="pin" size={11}/> {t.destFull}</span>
                  <span><Icon name="people" size={11}/> {t.pax} 人</span>
                  <span>{t.days} 天</span>
                  <span><Icon name="spot" size={11}/> {t.spotsCount}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <HomeBottomActions onNewTrip={onNewTrip} accentLabel="新建明信片" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   杂志 · 封面图多方案
   magCover: silhouette | type | grid | photoframe
   ───────────────────────────────────────────────────── */
function MagFeatureArt({ trip, mode = 'silhouette' }) {
  if (mode === 'type') {
    // 大号 typo + 色块编辑感
    return (
      <div className="hm-art hm-art--type" style={{ '--c1': trip.color[0], '--c2': trip.color[1] }}>
        <div className="hm-art-type-l1">DAY 01 — 05</div>
        <div className="hm-art-type-l2">{trip.destFull}</div>
        <div className="hm-art-type-l3">
          <span className="hm-art-type-tag">{trip.pax} PAX</span>
          <span className="hm-art-type-tag">{trip.spotsCount} SPOTS</span>
          <span className="hm-art-type-tag">¥{(trip.spent/1000).toFixed(1)}K</span>
        </div>
        <div className="hm-art-type-stripe"></div>
      </div>
    );
  }

  if (mode === 'grid') {
    // 三分割构图 + 数字 + 标签
    return (
      <div className="hm-art hm-art--grid">
        <div className="hm-art-grid-l" style={{ background: `linear-gradient(160deg, ${trip.color[0]}, ${trip.color[1]})` }}>
          <div className="hm-art-grid-big">{trip.days}</div>
          <div className="hm-art-grid-lbl">DAYS</div>
        </div>
        <div className="hm-art-grid-r">
          <div className="hm-art-grid-cell">
            <div className="hm-art-grid-cell-v">{trip.spotsCount}</div>
            <div className="hm-art-grid-cell-l">SPOTS</div>
          </div>
          <div className="hm-art-grid-cell">
            <div className="hm-art-grid-cell-v">{trip.pax}</div>
            <div className="hm-art-grid-cell-l">PAX</div>
          </div>
          <div className="hm-art-grid-cell">
            <div className="hm-art-grid-cell-v">¥{Math.round(trip.spent / trip.pax / 100) / 10}k</div>
            <div className="hm-art-grid-cell-l">PER PAX</div>
          </div>
          <div className="hm-art-grid-cell hm-art-grid-cell--accent">
            <div className="hm-art-grid-cell-v">{trip.daysToGo > 0 ? `D-${trip.daysToGo}` : 'PAST'}</div>
            <div className="hm-art-grid-cell-l">{trip.daysToGo > 0 ? 'COUNTDOWN' : 'RECAP'}</div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'photoframe') {
    // 杂志封面照：默认图 + 杂志构图（角标 / 期号 / 条形码）
    return (
      <div className="hm-art hm-art--photo">
        <div className="hm-art-photo-frame">
          <img
            className="hm-art-photo-img"
            src="https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=900&h=560&fit=crop&q=85"
            alt={trip.destFull}
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div className="hm-art-photo-grain"></div>
          <div className="hm-art-photo-overlay">
            <div className="hm-art-photo-tl">
              <div className="hm-art-photo-issue">VOL. 012 / SPRING</div>
              <div className="hm-art-photo-edition">2026</div>
            </div>
            <div className="hm-art-photo-tr">
              <div className="hm-art-photo-barcode">
                {Array.from({ length: 24 }).map((_, i) => (
                  <span key={i} style={{ width: `${1 + (i % 4)}px` }}></span>
                ))}
              </div>
              <div className="hm-art-photo-price">¥ 0 · MMXXVI</div>
            </div>
            <div className="hm-art-photo-bl">
              <div className="hm-art-photo-kicker">FEATURE</div>
              <div className="hm-art-photo-headline">{trip.destFull}</div>
              <div className="hm-art-photo-deck">{trip.days} DAYS · {trip.pax} TRAVELERS</div>
            </div>
            <div className="hm-art-photo-br">
              <span className="hm-art-photo-replace">
                <Icon name="edit" size={11}/> 替换封面
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // default: silhouette — 城市天际线剪影
  return (
    <div className="hm-art hm-art--silhouette" style={{ '--c1': trip.color[0], '--c2': trip.color[1] }}>
      <svg viewBox="0 0 320 130" className="hm-art-sky" preserveAspectRatio="xMidYMid slice">
        {/* sun/moon */}
        <circle cx="240" cy="40" r="22" fill="rgba(255,255,255,0.3)"/>
        <circle cx="240" cy="40" r="14" fill="rgba(255,255,255,0.5)"/>
        {/* clouds */}
        <ellipse cx="60" cy="35" rx="22" ry="5" fill="rgba(255,255,255,0.25)"/>
        <ellipse cx="120" cy="22" rx="18" ry="4" fill="rgba(255,255,255,0.20)"/>
        {/* silhouette buildings */}
        <path d="M0,130 L0,90 L20,90 L20,70 L35,70 L35,82 L55,82 L55,60 L75,60 L75,50 L90,50 L90,72 L110,72 L110,58 L130,58 L130,40 L150,40 L150,55 L165,55 L165,75 L185,75 L185,65 L205,65 L205,80 L225,80 L225,68 L245,68 L245,55 L260,55 L260,72 L280,72 L280,85 L300,85 L300,75 L320,75 L320,130 Z" fill="rgba(0,0,0,0.45)"/>
        {/* windows */}
        {[[25,75],[42,87],[60,68],[78,55],[95,77],[115,63],[135,45],[155,60],[170,80],[190,70],[210,72],[230,73],[250,60],[265,77],[285,78],[305,80]].map((p,i) => (
          <rect key={i} x={p[0]} y={p[1]} width="2" height="2" fill="rgba(255,194,71,0.6)"/>
        ))}
      </svg>
      <div className="hm-art-overlay-name">{trip.destFull}</div>
    </div>
  );
}

function HomeMagazine({ onOpenTrip, onNewTrip, aiStatus, aiTripId, logoStyle, magCover }) {
  const featured = SAMPLE_TRIPS[0];
  const rest = SAMPLE_TRIPS.slice(1);
  const featAI = (featured.id === aiTripId) ? aiStatus : null;
  return (
    <div className="home-mag">
      <header className="hm-masthead">
        <div className="hm-issueno">VOL. 012</div>
        <div className="hm-title-row">
          <BrandLogo style={logoStyle} size="lg" theme="magazine" />
          <div className="hm-meta-stack">
            <span className="hm-meta">2026 · 春</span>
            <span className="hm-meta">{SAMPLE_TRIPS.length} 段旅程</span>
          </div>
        </div>
        <div className="hm-rule"></div>
        <div className="hm-strap">EDITORIAL · TRAVEL · PERSONAL</div>
      </header>

      <article className={`hm-feature ${featAI && featAI !== 'idle' ? `hm-feature--ai-${featAI}` : ''}`} onClick={() => onOpenTrip(featured)}>
        {featAI && featAI !== 'idle' && <HomeCardAIRow status={featAI} />}
        <div className="hm-feature-tag">本期封面 / COVER STORY</div>
        <h2 className="hm-feature-title">{featured.name}</h2>
        <div className="hm-feature-deck">
          倒计时 <b>{featured.daysToGo} 天</b> · {featured.destFull} · {featured.pax} 人 · {featured.days} 天行程
        </div>
        <MagFeatureArt trip={featured} mode={magCover} />
        <div className="hm-feature-foot">
          <span>P. 01 — P. 28</span>
          <span><Icon name="arrow-right" size={12}/> 翻开</span>
        </div>
      </article>

      <section className="hm-index">
        <div className="hm-index-head">
          <span>本期目录</span>
          <span>INDEX</span>
        </div>
        {rest.map((t, i) => (
          <div key={t.id} className="hm-index-row" onClick={() => onOpenTrip(t)}>
            <span className="hm-index-no">P. {String(i + 2).padStart(2, '0')}</span>
            <span className="hm-index-name">{t.name}</span>
            <span className="hm-index-dots"></span>
            <span className="hm-index-date">{t.startDate.slice(0, 7)}</span>
          </div>
        ))}
      </section>

      <HomeBottomActions onNewTrip={onNewTrip} accentLabel="发起新刊" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   明信片 · 旅行护照（信息丰富 · 大小动态）
   ───────────────────────────────────────────────────── */
function HomePostcard({ onOpenTrip, onNewTrip, aiStatus, aiTripId, logoStyle }) {
  // 按天数 sort 决定 z-order / size
  // 大小 scale: 3 天最小，14+ 天最大
  const sizedTrips = SAMPLE_TRIPS.map(t => {
    const scale = Math.min(1.0, Math.max(0.62, 0.5 + t.days * 0.06));
    return { ...t, _scale: scale };
  });

  return (
    <div className="home-pp">
      <header className="hpp-cover">
        <div className="hpp-cover-lab">XING CE · PASSPORT</div>
        <BrandLogo style={logoStyle} size="lg" theme="postcard" />
        <div className="hpp-cover-no">
          <span>No. XC · 2026 · 0012</span>
          <span>· {SAMPLE_TRIPS.length} VISAS</span>
        </div>
      </header>

      <section className="hpp-page">
        <div className="hpp-page-head">
          <span className="hpp-page-l">VISA / 签 证 · 已盖 {SAMPLE_TRIPS.length} 枚</span>
          <span className="hpp-page-r">{SAMPLE_TRIPS.reduce((s,t)=>s+t.days,0)} 天</span>
        </div>

        <div className="hpp-stamps">
          {sizedTrips.map((t, i) => {
            const ai = (t.id === aiTripId) ? aiStatus : null;
            const size = 96 * t._scale;
            return (
              <button key={t.id} className={`hpp-stamp hpp-stamp-${i} ${ai && ai !== 'idle' ? `hpp-stamp--ai-${ai}` : ''}`}
                onClick={() => onOpenTrip(t)}
                style={{ width: `${size}px`, height: `${size}px`, '--stamp-scale': t._scale }}>
                <span className="hpp-stamp-name">{t.destFull}</span>
                <span className="hpp-stamp-divider"></span>
                <span className="hpp-stamp-date">{t.startDate.slice(0, 7).replace('-', '.')}</span>
                <span className="hpp-stamp-days">{t.days} DAYS · {t.pax}P</span>
                {ai === 'thinking' && <span className="hpp-stamp-aiglow"></span>}
                {ai === 'ready' && <span className="hpp-stamp-aiready"><Icon name="sparkle-fill" size={10}/></span>}
              </button>
            );
          })}
        </div>

        <div className="hpp-watermark">行迹</div>

        {/* 底部小情报区 */}
        <div className="hpp-info">
          <div className="hpp-info-row">
            <span className="hpp-info-l">TOTAL DISTANCE</span>
            <span className="hpp-info-v">{SAMPLE_TRIPS.reduce((s,t)=>s+(t.walked||0),0)} km</span>
          </div>
          <div className="hpp-info-row">
            <span className="hpp-info-l">TOTAL SPENT</span>
            <span className="hpp-info-v">¥{(SAMPLE_TRIPS.reduce((s,t)=>s+(t.spent||0),0)/1000).toFixed(1)}k</span>
          </div>
        </div>
      </section>

      <HomeBottomActions onNewTrip={onNewTrip} accentLabel="新一页签证" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   极简 · 清单
   ───────────────────────────────────────────────────── */
function HomeMinimal({ onOpenTrip, onNewTrip, aiStatus, aiTripId, logoStyle }) {
  return (
    <div className="home-min">
      <header className="hmin-head">
        <div className="hmin-eyebrow">CHRONICLE</div>
        <BrandLogo style={logoStyle} size="lg" theme="minimal" />
        <div className="hmin-stats">
          <span><b>{SAMPLE_TRIPS.length}</b> 段</span>
          <span><b>{SAMPLE_TRIPS.reduce((s,t)=>s+t.days,0)}</b> 天</span>
          <span><b>{SAMPLE_TRIPS.reduce((s,t)=>s+t.spotsCount,0)}</b> 处</span>
        </div>
      </header>

      <div className="hmin-list">
        {SAMPLE_TRIPS.map((t, i) => {
          const ai = (t.id === aiTripId) ? aiStatus : null;
          return (
            <button key={t.id} className={`hmin-row ${ai && ai !== 'idle' ? `hmin-row--ai-${ai}` : ''}`} onClick={() => onOpenTrip(t)}>
              <span className="hmin-row-no">{String(i + 1).padStart(2, '0')}</span>
              <div className="hmin-row-body">
                <div className="hmin-row-top">
                  <span className="hmin-row-name">{t.name}</span>
                  <span className="hmin-row-arrow"><Icon name="chevron-right" size={14}/></span>
                </div>
                <div className="hmin-row-meta">
                  <span>{t.startDate.replace(/-/g,'.')} → {t.endDate.slice(5).replace('-','.')}</span>
                  <span>·</span>
                  <span>{t.pax} 人 · {t.days} 天</span>
                </div>
                {ai && ai !== 'idle' && <HomeCardAIRow status={ai} />}
              </div>
            </button>
          );
        })}
      </div>

      <HomeBottomActions onNewTrip={onNewTrip} accentLabel="新建" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   底部 CTA — 只保留"新建"（AI 入口移到 trip 攻略页内）
   ───────────────────────────────────────────────────── */
function HomeBottomActions({ onNewTrip, accentLabel }) {
  return (
    <div className="home-cta">
      <button className="home-cta-self home-cta-only" onClick={onNewTrip}>
        <Icon name="plus" size={16} />
        <span>{accentLabel}</span>
      </button>
    </div>
  );
}

Object.assign(window, { HomeScreen, BrandLogo });
