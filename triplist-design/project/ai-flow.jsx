/* eslint-disable react/prop-types, no-undef */
// ai-flow.jsx — AI 采访 + 剧场化生成动效
// 暴露：<AIInterview /> <AILoadingTheater /> <AIReadyStamp /> <AIBadge />

const { useState, useEffect, useRef } = React;

/* ─────────────────────────────────────────────────────
   AI 入口徽章（trip 顶部右上角小浮窗 + 主页 + 按钮）
   ───────────────────────────────────────────────────── */
function AIBadge({ status = 'idle', label, onClick, compact = false }) {
  // status: idle | thinking | ready | error
  const colors = {
    idle:     ['var(--plum)',  'var(--accent)'],
    thinking: ['#6B46C1',      '#FF7A2E'],
    ready:    ['#4FB286',      '#FFC247'],
    error:    ['var(--coral)', '#FF9A4D'],
  };
  const [c1, c2] = colors[status] || colors.idle;
  const text = label || ({
    idle: '让 AI 规划',
    thinking: 'AI 正在编排…',
    ready: '草稿就绪',
    error: '生成失败 · 重试',
  })[status];

  return (
    <button onClick={onClick} className={`ai-badge ai-badge--${status} ${compact ? 'compact' : ''}`}
      style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
      <span className="ai-badge-shine"></span>
      <Icon name="sparkle-fill" size={compact ? 13 : 15} />
      <span className="ai-badge-text">{text}</span>
      {status === 'thinking' && <span className="ai-badge-dots"><i></i><i></i><i></i></span>}
    </button>
  );
}

/* ─────────────────────────────────────────────────────
   AI 采访式表单
   ───────────────────────────────────────────────────── */
function AIInterview({ open, onClose, onSubmit }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [freeText, setFreeText] = useState('');

  useEffect(() => {
    if (open) {
      setStep(0); setAnswers({}); setFreeText('');
    }
  }, [open]);

  if (!open) return null;
  const q = AI_INTERVIEW[step];
  const total = AI_INTERVIEW.length;
  const done = step >= total;

  const pickSingle = (opt) => {
    setAnswers(a => ({ ...a, [q.id]: opt }));
    setTimeout(() => setStep(s => s + 1), 320);
  };
  const toggleMulti = (opt) => {
    setAnswers(a => {
      const arr = a[q.id] || [];
      return { ...a, [q.id]: arr.includes(opt) ? arr.filter(x => x !== opt) : [...arr, opt] };
    });
  };
  const submitFree = () => {
    setAnswers(a => ({ ...a, [q.id]: freeText.trim() }));
    setStep(s => s + 1);
  };
  const skipFree = () => {
    setAnswers(a => ({ ...a, [q.id]: '' }));
    setStep(s => s + 1);
  };
  const finishAll = () => {
    onSubmit?.(answers);
  };

  return (
    <div className="aiv-mask" onClick={onClose}>
      <div className="aiv-sheet" onClick={e => e.stopPropagation()}>
        <div className="aiv-head">
          <div className="aiv-progress">
            {AI_INTERVIEW.map((_, i) => (
              <span key={i} className={`aiv-dot ${i < step ? 'done' : ''} ${i === step ? 'now' : ''}`} />
            ))}
          </div>
          <button className="aiv-close" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>

        {/* 已答的问题：缩为一行小总结 */}
        <div className="aiv-history">
          {AI_INTERVIEW.slice(0, step).map((qq, i) => {
            const v = answers[qq.id];
            const display = Array.isArray(v) ? (v.join('、') || '随意') : (v || '随意');
            return (
              <div key={qq.id} className="aiv-history-row" style={{ animationDelay: `${i * 60}ms` }}>
                <span className="aiv-history-q">{qq.q}</span>
                <span className="aiv-history-a">{display}</span>
              </div>
            );
          })}
        </div>

        {!done && (
          <div className="aiv-current" key={step}>
            <div className="aiv-bubble">
              <span className="aiv-bubble-avatar"><Icon name="sparkle-fill" size={14} /></span>
              <div className="aiv-bubble-text">{q.q}</div>
            </div>

            {q.type === 'single' && (
              <div className="aiv-chips">
                {q.options.map(opt => (
                  <button key={opt}
                    className={`aiv-chip ${answers[q.id] === opt ? 'on' : ''}`}
                    onClick={() => pickSingle(opt)}>
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {q.type === 'multi' && (
              <>
                <div className="aiv-chips">
                  {q.options.map(opt => {
                    const on = (answers[q.id] || []).includes(opt);
                    return (
                      <button key={opt}
                        className={`aiv-chip ${on ? 'on' : ''}`}
                        onClick={() => toggleMulti(opt)}>
                        {opt}
                      </button>
                    );
                  })}
                </div>
                <button className="aiv-next" onClick={() => setStep(s => s + 1)}>
                  下一题 <Icon name="arrow-right" size={14} />
                </button>
              </>
            )}

            {q.type === 'free' && (
              <>
                <textarea className="aiv-textarea"
                  value={freeText}
                  placeholder={q.placeholder}
                  onChange={e => setFreeText(e.target.value)}
                  rows={3} />
                <div className="aiv-foot">
                  <button className="aiv-skip" onClick={skipFree}>跳过</button>
                  <button className="aiv-next" onClick={submitFree}>
                    下一步 <Icon name="arrow-right" size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {done && (
          <div className="aiv-confirm">
            <div className="aiv-confirm-title">我听明白了</div>
            <div className="aiv-confirm-sub">将基于你的偏好为你生成 5 天的行程草稿</div>
            <button className="aiv-go" onClick={finishAll}>
              <Icon name="sparkle-fill" size={16} />
              <span>开始生成</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   AI 剧场化生成中（精简版：只有 title + 循环 sub）
   ───────────────────────────────────────────────────── */
function AILoadingTheater({ open, onComplete, onCancel }) {
  const [streamText, setStreamText] = useState('');
  const [phase, setPhase] = useState('thinking'); // thinking → done

  useEffect(() => {
    if (!open) { setStreamText(''); setPhase('thinking'); return; }
    setPhase('thinking');
    // 总时长 ~4.5s 演示
    const t = setTimeout(() => setPhase('done'), 4200);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (phase === 'done' && open) {
      const t = setTimeout(() => onComplete?.(), 700);
      return () => clearTimeout(t);
    }
  }, [phase, open]);

  // 循环 sub text
  useEffect(() => {
    if (!open || phase !== 'thinking') return;
    const messages = [
      '分析你的偏好…',
      '搜索 5 段目的地周边亮点…',
      '为你规划最优路线…',
      '估算每日开销…',
      '正在为你编排成册…',
    ];
    let i = 0;
    setStreamText(messages[0]);
    const t = setInterval(() => {
      i = (i + 1) % messages.length;
      setStreamText(messages[i]);
    }, 1100);
    return () => clearInterval(t);
  }, [open, phase]);

  if (!open) return null;
  const done = phase === 'done';

  return (
    <div className="ait-mask">
      <div className="ait-sheet">
        <div className="ait-stage">
          <div className="ait-orb">
            <span className="ait-orb-core"></span>
            <span className="ait-orb-ring r1"></span>
            <span className="ait-orb-ring r2"></span>
            <span className="ait-orb-ring r3"></span>
            {done && <span className="ait-orb-check"><Icon name="check" size={20} stroke={3} /></span>}
          </div>
          <div className="ait-title">{done ? '已为你编排好' : 'AI 正在为你编排'}</div>
          <div className="ait-stream">
            <span key={streamText} className="ait-stream-text">
              {done ? '5 天 · 28 个点位 · 即将就绪' : streamText}
            </span>
          </div>
        </div>

        {!done && <button className="ait-cancel" onClick={onCancel}>停止生成</button>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   AI 就绪后落下的"印章"
   ───────────────────────────────────────────────────── */
function AIReadyStamp({ onClick }) {
  return (
    <button className="ai-stamp" onClick={onClick}>
      <span className="ai-stamp-inner">
        <span className="ai-stamp-l1">就绪</span>
        <span className="ai-stamp-l2">5 DAYS</span>
      </span>
    </button>
  );
}

Object.assign(window, { AIBadge, AIInterview, AILoadingTheater, AIReadyStamp });
