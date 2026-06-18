/* eslint-disable react/prop-types, no-undef */
// app.jsx — 行迹 prototype 主应用

const { useState, useEffect, useRef } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "tegami",
  "screen": "home",
  "lifecycle": "pre",
  "view": "itinerary",
  "aiStatus": "idle",
  "logoStyle": "seal",
  "magCover": "photoframe"
}/*EDITMODE-END*/;

const THEME_LABEL = {
  tegami: '手紙 · 明信片堆',
  magazine: '杂志 · 编辑感',
  postcard: '明信片 · 旅行护照',
  minimal: '极简 · 清单',
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Local UI state
  const [activeTrip, setActiveTrip] = useState(SAMPLE_TRIPS[0]);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [theaterOpen, setTheaterOpen] = useState(false);

  // 屏幕路由
  const goHome = () => setTweak('screen', 'home');
  const openTrip = (trip) => {
    setActiveTrip(trip);
    setTweak('screen', 'trip');
  };

  // AI 流程编排
  const startAIInterview = () => setInterviewOpen(true);
  const handleInterviewSubmit = () => {
    setInterviewOpen(false);
    setTheaterOpen(true);
    setTweak('aiStatus', 'thinking');
  };
  const handleTheaterComplete = () => {
    setTheaterOpen(false);
    setTweak('aiStatus', 'ready');
  };
  const handleAIBadgeClick = () => {
    if (t.aiStatus === 'idle') {
      startAIInterview();
    } else if (t.aiStatus === 'thinking') {
      setTheaterOpen(true);
    } else if (t.aiStatus === 'ready') {
      // 跳到 itinerary 看草稿 banner
      setTweak('view', 'itinerary');
    }
  };
  const handleApplyAI = () => {
    setTweak('aiStatus', 'idle');
  };

  // AI status 同步 theater
  useEffect(() => {
    if (t.aiStatus === 'thinking' && !theaterOpen && !interviewOpen) {
      setTheaterOpen(true);
    }
    if (t.aiStatus === 'idle') {
      setTheaterOpen(false);
      setInterviewOpen(false);
    }
  }, [t.aiStatus]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <IOSDevice width={402} height={874}>
        <div className={`app-root theme-${t.theme}`}>
          <div className="app-scroll">
            {t.screen === 'home' && (
              <HomeScreen
                theme={t.theme}
                logoStyle={t.logoStyle}
                magCover={t.magCover}
                onOpenTrip={openTrip}
                onNewTrip={() => openTrip(SAMPLE_TRIPS[0])}
                onAI={startAIInterview}
                aiStatus={t.aiStatus}
                aiTripId={activeTrip.id}
              />
            )}
            {t.screen === 'trip' && (
              <TripScreen
                trip={activeTrip}
                theme={t.theme}
                lifecycle={t.lifecycle}
                view={t.view}
                setView={(v) => setTweak('view', v)}
                aiStatus={t.aiStatus}
                onAIBadgeClick={handleAIBadgeClick}
                onApplyAI={handleApplyAI}
                onBack={goHome}
              />
            )}
          </div>

          {/* AI 流程 sheet */}
          <AIInterview
            open={interviewOpen}
            onClose={() => setInterviewOpen(false)}
            onSubmit={handleInterviewSubmit}
          />
          <AILoadingTheater
            open={theaterOpen}
            onComplete={handleTheaterComplete}
            onCancel={() => {
              setTheaterOpen(false);
              setTweak('aiStatus', 'idle');
            }}
          />
        </div>
      </IOSDevice>

      <TweaksPanel>
        <TweakSection label="导航 · NAVIGATION" />
        <TweakRadio label="屏幕" value={t.screen}
          options={['home', 'trip']}
          onChange={(v) => setTweak('screen', v)} />

        <TweakSection label="主题 · 4 套" />
        <TweakSelect label="THEME / 首页隐喻" value={t.theme}
          options={[
            { value: 'tegami', label: THEME_LABEL.tegami },
            { value: 'magazine', label: THEME_LABEL.magazine },
            { value: 'postcard', label: THEME_LABEL.postcard },
            { value: 'minimal', label: THEME_LABEL.minimal },
          ]}
          onChange={(v) => setTweak('theme', v)} />

        <TweakSection label="品牌 LOGO · 选一个" />
        <TweakSelect label="LOGO 样式" value={t.logoStyle}
          options={[
            { value: 'seal',     label: 'A · 钤印（红方章 + 反白衡线）' },
            { value: 'masthead', label: 'B · 竖排刊头（双竖线框）' },
            { value: 'script',   label: 'C · 钟笔签名（手写 + 波浪）' },
            { value: 'spine',    label: 'D · 书脊（上下双线 VOL.012）' },
            { value: 'bigtype',  label: 'E · 巨字号（红条 + 角标）' },
          ]}
          onChange={(v) => setTweak('logoStyle', v)} />

        <TweakSection label="杂志封面图 · 选一个 (在 magazine 主题下预览)" />
        <TweakSelect label="封面设计" value={t.magCover}
          options={[
            { value: 'silhouette', label: 'A · 城市天际线剖影' },
            { value: 'type',       label: 'B · 大号排版 + 色块' },
            { value: 'grid',       label: 'C · 分割数据格子' },
            { value: 'photoframe', label: 'D · 照片框 (占位)' },
          ]}
          onChange={(v) => setTweak('magCover', v)} />

        <TweakSection label="行程状态 (Trip 屏幕)" />
        <TweakSelect label="生命周期" value={t.lifecycle}
          options={[
            { value: 'pre',  label: '出行前 · 倒计时' },
            { value: 'live', label: '出行中 · LIVE' },
            { value: 'post', label: '出行后 · 回顾' },
          ]}
          onChange={(v) => setTweak('lifecycle', v)} />
        <TweakRadio label="VIEW" value={t.view}
          options={['itinerary', 'map', 'budget', 'packing']}
          onChange={(v) => setTweak('view', v)} />

        <TweakSection label="AI 流程" />
        <TweakSelect label="AI 状态" value={t.aiStatus}
          options={[
            { value: 'idle',     label: '待发起 (让 AI 规划)' },
            { value: 'thinking', label: '生成中 · 剧场动效' },
            { value: 'ready',    label: '草稿就绪 · 印章' },
          ]}
          onChange={(v) => setTweak('aiStatus', v)} />
        <TweakButton label="打开采访式表单"
          onClick={() => { setTweak('screen', 'home'); setInterviewOpen(true); }} />
        <TweakButton label="重播剧场化动效"
          onClick={() => { setTheaterOpen(false); setTimeout(() => setTheaterOpen(true), 50); }} />
      </TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
