/* eslint-disable react/prop-types */
// icons.jsx — 行册统一图标库
// 单色线条 + 可选填充层，统一 24×24 viewBox，stroke 由 currentColor 控制

function Icon({ name, size = 22, stroke = 1.7, fill = false, style = {}, ...rest }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor',
    strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round',
    style: { display: 'block', flexShrink: 0, ...style },
    ...rest,
  };
  const fc = fill ? 'rgba(255,255,255,0.15)' : 'none'; // accent-soft tint when fill=true
  const fillProps = fill ? { style: { opacity: 0.18 } } : {};

  switch (name) {
    /* ─────────── 导航 tab ─────────── */
    case 'itinerary':
      return (
        <svg {...common}>
          {fill && <rect x="4.5" y="3" width="15" height="18" rx="2" fill="currentColor" {...fillProps} stroke="none"/>}
          <rect x="4.5" y="3" width="15" height="18" rx="2"/>
          <path d="M9 8h6M9 12h6M9 16h4"/>
          <circle cx="7" cy="8" r="0.6" fill="currentColor" stroke="none"/>
          <circle cx="7" cy="12" r="0.6" fill="currentColor" stroke="none"/>
          <circle cx="7" cy="16" r="0.6" fill="currentColor" stroke="none"/>
        </svg>
      );
    case 'map':
      return (
        <svg {...common}>
          {fill && <path d="M9 4l-5 2v14l5-2 6 2 5-2V4l-5 2-6-2z" fill="currentColor" {...fillProps} stroke="none"/>}
          <path d="M9 4l-5 2v14l5-2 6 2 5-2V4l-5 2-6-2z"/>
          <path d="M9 4v14M15 6v14"/>
        </svg>
      );
    case 'budget':
      return (
        <svg {...common}>
          {fill && <circle cx="12" cy="12" r="9" fill="currentColor" {...fillProps} stroke="none"/>}
          <circle cx="12" cy="12" r="9"/>
          <path d="M12 6.5v11M14.5 9h-3.5a1.5 1.5 0 000 3h2a1.5 1.5 0 010 3H9"/>
        </svg>
      );
    case 'packing':
      return (
        <svg {...common}>
          {fill && <path d="M6 8h12v12a1 1 0 01-1 1H7a1 1 0 01-1-1V8z" fill="currentColor" {...fillProps} stroke="none"/>}
          <path d="M6 8h12v12a1 1 0 01-1 1H7a1 1 0 01-1-1V8z"/>
          <path d="M9 8V5.5A1.5 1.5 0 0110.5 4h3A1.5 1.5 0 0115 5.5V8"/>
          <path d="M12 11v6"/>
        </svg>
      );

    /* ─────────── 行程内容类型 ─────────── */
    case 'spot': // 景点
      return (
        <svg {...common}>
          {fill && <path d="M12 3c-3.5 0-6 2.6-6 6 0 4.5 6 12 6 12s6-7.5 6-12c0-3.4-2.5-6-6-6z" fill="currentColor" {...fillProps} stroke="none"/>}
          <path d="M12 3c-3.5 0-6 2.6-6 6 0 4.5 6 12 6 12s6-7.5 6-12c0-3.4-2.5-6-6-6z"/>
          <circle cx="12" cy="9" r="2.2"/>
        </svg>
      );
    case 'hotel': // 住宿
      return (
        <svg {...common}>
          {fill && <path d="M3 18V7a1 1 0 011-1h16a1 1 0 011 1v11" fill="currentColor" {...fillProps} stroke="none"/>}
          <path d="M3 18V7a1 1 0 011-1h16a1 1 0 011 1v11"/>
          <path d="M3 14h18"/>
          <path d="M3 18v2M21 18v2"/>
          <circle cx="7.5" cy="11" r="1.2"/>
          <path d="M10 14V12a1 1 0 011-1h6a1 1 0 011 1v2"/>
        </svg>
      );
    case 'meal': // 餐饮
      return (
        <svg {...common}>
          {fill && <path d="M5 3v8a3 3 0 003 3v7M19 3l-1 9h2v9" fill="currentColor" {...fillProps} stroke="none"/>}
          <path d="M5 3v6M8 3v6M5 9a3 3 0 003 3v9M19 3l-1 9h2v9"/>
        </svg>
      );
    case 'transport': // 交通
      return (
        <svg {...common}>
          {fill && <path d="M5 17V8a3 3 0 013-3h8a3 3 0 013 3v9" fill="currentColor" {...fillProps} stroke="none"/>}
          <path d="M5 17V8a3 3 0 013-3h8a3 3 0 013 3v9"/>
          <path d="M5 12h14"/>
          <circle cx="8.5" cy="17.5" r="1.5"/>
          <circle cx="15.5" cy="17.5" r="1.5"/>
        </svg>
      );

    /* ─────────── 状态/操作 ─────────── */
    case 'sparkle': // AI
      return (
        <svg {...common}>
          <path d="M12 4l1.6 4.4 4.4 1.6-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z"/>
          <path d="M19 4l0.6 1.4L21 6l-1.4 0.6L19 8l-0.6-1.4L17 6l1.4-0.6L19 4z"/>
          <path d="M5 14l0.5 1.2L6.7 16l-1.2 0.5L5 18l-0.5-1.5L3 16l1.5-0.5L5 14z"/>
        </svg>
      );
    case 'sparkle-fill':
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M12 4l1.6 4.4 4.4 1.6-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z"/>
          <path d="M19 4l0.6 1.4L21 6l-1.4 0.6L19 8l-0.6-1.4L17 6l1.4-0.6L19 4z" opacity="0.7"/>
          <path d="M5 14l0.5 1.2L6.7 16l-1.2 0.5L5 18l-0.5-1.5L3 16l1.5-0.5L5 14z" opacity="0.7"/>
        </svg>
      );
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14"/>
        </svg>
      );
    case 'check':
      return <svg {...common}><path d="M5 12.5l5 5L19 7"/></svg>;
    case 'close':
      return <svg {...common}><path d="M6 6l12 12M18 6l-12 12"/></svg>;
    case 'menu':
      return <svg {...common}><circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>;
    case 'arrow-right':
      return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'arrow-left':
      return <svg {...common}><path d="M19 12H5M11 18l-6-6 6-6"/></svg>;
    case 'chevron-down':
      return <svg {...common}><path d="M6 9l6 6 6-6"/></svg>;
    case 'chevron-right':
      return <svg {...common}><path d="M9 6l6 6-6 6"/></svg>;
    case 'edit':
      return <svg {...common}><path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="M14 6l4 4"/></svg>;
    case 'share':
      return (
        <svg {...common}>
          <circle cx="6" cy="12" r="2.5"/>
          <circle cx="17" cy="6" r="2.5"/>
          <circle cx="17" cy="18" r="2.5"/>
          <path d="M8.2 11l6.6-3.8M8.2 13l6.6 3.8"/>
        </svg>
      );

    /* ─────────── 行李分类 ─────────── */
    case 'pk-id': // 证件
      return <svg {...common}><rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="9" cy="12" r="2"/><path d="M14 11h4M14 14h3"/></svg>;
    case 'pk-cloth': // 衣物
      return <svg {...common}><path d="M9 4l3 2 3-2 5 3-2 4-3-1v9H6v-9l-3 1-2-4 5-3z"/></svg>;
    case 'pk-elec': // 电子
      return <svg {...common}><rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M9 19h6M12 16v3"/><circle cx="12" cy="10.5" r="0.6" fill="currentColor" stroke="none"/></svg>;
    case 'pk-care': // 洗漱
      return <svg {...common}><path d="M6 8h12l-1.5 12h-9z"/><path d="M9 4h6v4H9z"/></svg>;
    case 'pk-med': // 药品
      return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M4 12h16M12 4v16" strokeDasharray="2 2"/></svg>;

    /* ─────────── misc ─────────── */
    case 'weather-sun':
      return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"/></svg>;
    case 'weather-cloud':
      return <svg {...common}><path d="M7 18a4 4 0 010-8 5 5 0 019.6 1.4 3.5 3.5 0 01-.6 6.6H7z"/></svg>;
    case 'flag':
      return <svg {...common}><path d="M5 21V4l8 2 6-1v10l-6 1-8-2"/></svg>;
    case 'clock':
      return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'people':
      return <svg {...common}><circle cx="9" cy="9" r="3"/><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5"/><circle cx="16" cy="10" r="2.5"/><path d="M16 15c2.5 0 5 2 5 5"/></svg>;
    case 'pin':
      return <svg {...common}><path d="M12 21s-7-7-7-12a7 7 0 0114 0c0 5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>;
    case 'walk':
      return <svg {...common}><circle cx="13" cy="4" r="1.5"/><path d="M13 6l-2 5-3 1M11 11l2 3v6M13 14l3-1 2 3"/></svg>;
    case 'compass':
      return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M15 9l-2 5-4 1 2-5 4-1z"/></svg>;
    default:
      return null;
  }
}

Object.assign(window, { Icon });
