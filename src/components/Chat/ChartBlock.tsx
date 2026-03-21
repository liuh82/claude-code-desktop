import { useRef, useCallback, useState } from 'react';
import ReactECharts from 'echarts-for-react';

interface ChartBlockProps {
  code: string;
}

type ThemeType = 'default' | 'dark' | 'vintage' | 'macarons' | 'infographic' | 'shine' | 'roma' | 'westeros' | 'wonderland' | 'chalk' | 'essos' | 'halloween' | 'jazz' | 'aurora' | 'azul' | 'bee-inspired' | 'blue' | 'caravan' | 'cool' | 'dark-blue' | 'eduardo' | 'forest' | 'fresh-cut' | 'fruit' | 'gray' | 'green' | 'helianthus' | 'inspired' | 'ios-classic' | 'jupiter' | 'kawaii' | 'london' | 'macarons2' | 'mint' | 'morning' | 'purple-passion' | 'red' | 'red-velvet' | 'royal' | 'sakura' | 'south-africa' | 'starry-night' | 'tech-blue' | 'vintage' | 'walden' | 'wef';

const THEME_OPTIONS: Array<{ label: string; value: ThemeType }> = [
  { label: '默认', value: 'default' },
  { label: '暗夜', value: 'dark' },
  { label: '极光', value: 'aurora' },
  { label: '科技蓝', value: 'tech-blue' },
  { label: '紫韵', value: 'purple-passion' },
  { label: '樱花', value: 'sakura' },
  { label: '星空', value: 'starry-night' },
  { label: '森林', value: 'forest' },
  { label: '蜜桃', value: 'macarons' },
  { label: '复古', value: 'vintage' },
  { label: '爵士', value: 'jazz' },
  { label: '清新', value: 'fresh-cut' },
];

function ChartBlock({ code }: ChartBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeType>('default');
  const [showPanel, setShowPanel] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);

  const parseConfig = useCallback(() => {
    try {
      // Try parsing as JSON first
      return typeof code === 'string' ? JSON.parse(code) : code;
    } catch {
      // Try evaluating as JS expression (e.g., without quotes on keys)
      try {
        return new Function('return (' + code + ')')();
      } catch (e) {
        setError('图表配置解析失败: ' + (e as Error).message);
        return null;
      }
    }
  }, [code]);

  const option = parseConfig();

  if (error) {
    return (
      <div style={{
        padding: '12px 16px',
        background: 'var(--bg-error, #fef2f2)',
        border: '1px solid var(--border-error, #fecaca)',
        borderRadius: 'var(--radius-md, 8px)',
        color: 'var(--text-error, #dc2626)',
        fontSize: 'var(--font-size-sm, 13px)',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 6 }}>
          error
        </span>
        {error}
      </div>
    );
  }

  if (!option) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: fullScreen ? 'fixed' : 'relative',
        top: fullScreen ? 0 : 'auto',
        left: fullScreen ? 0 : 'auto',
        width: fullScreen ? '100vw' : '100%',
        height: fullScreen ? '100vh' : '350px',
        zIndex: fullScreen ? 1000 : 'auto',
        background: fullScreen ? 'var(--bg-primary)' : 'transparent',
        borderRadius: fullScreen ? 0 : 'var(--radius-md, 8px)',
        overflow: 'hidden',
      }}
    >
      {/* Toolbar */}
      <div style={{
        position: 'absolute',
        top: 6,
        right: 6,
        display: 'flex',
        gap: 2,
        zIndex: 10,
        opacity: showPanel ? 1 : 0.4,
        transition: 'opacity 0.2s',
      }}
        onMouseEnter={() => setShowPanel(true)}
        onMouseLeave={() => setShowPanel(false)}
      >
        {/* Theme selector */}
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as ThemeType)}
          style={{
            fontSize: 11,
            padding: '2px 6px',
            borderRadius: 4,
            border: '1px solid var(--border-ghost)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {THEME_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {/* Fullscreen toggle */}
        <button
          onClick={() => setFullScreen(!fullScreen)}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-ghost)',
            borderRadius: 4,
            padding: '2px 6px',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
          }}
          title={fullScreen ? '退出全屏' : '全屏'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            {fullScreen ? 'fullscreen_exit' : 'fullscreen'}
          </span>
        </button>
      </div>

      <ReactECharts
        option={option}
        theme={theme === 'default' ? undefined : theme}
        style={{ height: '100%', width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
}

export { ChartBlock };
