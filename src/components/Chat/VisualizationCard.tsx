import { useMemo } from 'react';
import styles from './VisualizationCard.module.css';

/* ── JSON schema types ── */

interface VizModule {
  name: string;
  color?: 'primary' | 'secondary' | 'tertiary';
  icon?: string;
  children?: string[];
  detail?: string;
}

interface VizFlowStep {
  endpoint: string;
  method?: string;
  duration?: string;
  active?: boolean;
  success?: boolean;
}

interface VizCompareSide {
  name: string;
  icon?: string;
  badge?: string;
  badgeVariant?: 'default' | 'highlight';
  rows: Array<{ label: string; value: string; highlight?: boolean }>;
}

interface VizTimelineStep {
  title: string;
  description: string;
  status: 'completed' | 'active' | 'pending';
  detail?: string;
  icon?: string;
}

interface VizStat {
  label: string;
  value: string;
  trend?: string;
  trendIcon?: 'trending_up' | 'check_circle' | 'token';
  trendColor?: 'success' | 'muted' | 'secondary';
}

interface VizBarData {
  values: number[];
  highlight?: number;
}

type VizCard =
  | { type: 'architecture'; title: string; subtitle?: string; icon?: string; label?: string; modules: VizModule[]; }
  | { type: 'dataflow'; title: string; subtitle?: string; label?: string; steps: VizFlowStep[]; metric?: { value: string; label: string }; sidebar?: { title: string; description: string; saturation: number }; }
  | { type: 'comparison'; title: string; subtitle?: string; label?: string; sides: [VizCompareSide, VizCompareSide]; insight?: string; }
  | { type: 'statistics'; title: string; subtitle?: string; label?: string; stats: VizStat[]; bars?: VizBarData; }
  | { type: 'timeline'; title: string; subtitle?: string; label?: string; steps: VizTimelineStep[]; };

/* ── Main component ── */

function VisualizationCard({ code }: { code: string }) {
  const card = useMemo(() => parseCard(code), [code]);

  // Always return a stable <div> wrapper to avoid React #301 when card type changes
  // during streaming (e.g., incomplete JSON parsing differently on each render).
  return (
    <div className={styles.vizWrapper}>
      {!card ? (
        <div className={styles.error}>
          <span className="material-symbols-outlined">error</span>
          Visualization card JSON parse error
        </div>
      ) : (
        <VizCardInner card={card} />
      )}
    </div>
  );
}

function VizCardInner({ card }: { card: VizCard }) {
  switch (card.type) {
    case 'architecture': return <ArchitectureCard card={card} />;
    case 'dataflow': return <DataFlowCard card={card} />;
    case 'comparison': return <ComparisonCard card={card} />;
    case 'statistics': return <StatisticsCard card={card} />;
    case 'timeline': return <TimelineCard card={card} />;
  }
}

/* ── Shared header ── */

function CardHeader({ title, subtitle, label, icon }: { title: string; subtitle?: string; label?: string; icon?: string }) {
  return (
    <div className={styles.cardHeader}>
      <div>
        {label && <span className={styles.cardLabel}>{label}</span>}
        <h3 className={styles.cardTitle}>{title}</h3>
        {subtitle && <p className={styles.cardSubtitle}>{subtitle}</p>}
      </div>
      {icon && (
        <span className={`${styles.cardIcon} material-symbols-outlined`}>{icon}</span>
      )}
    </div>
  );
}

/* ── 1. Architecture Card ── */

function ArchitectureCard({ card }: { card: Extract<VizCard, { type: 'architecture' }> }) {
  return (
    <div className={styles.card}>
      <CardHeader title={card.title} subtitle={card.subtitle} label={card.label} icon={card.icon || 'account_tree'} />
      <div className={styles.moduleGrid}>
        {card.modules.map((mod, i) => {
          const colorClass = mod.color === 'secondary' ? styles.moduleSecondary
            : mod.color === 'tertiary' ? styles.moduleTertiary
            : styles.modulePrimary;
          return (
            <div key={i} className={`${styles.module} ${colorClass}`}>
              <div className={styles.moduleIconWrap}>
                <span className="material-symbols-outlined">{mod.icon || 'widgets'}</span>
              </div>
              <div className={styles.moduleName}>{mod.name}</div>
              {mod.detail && <div className={styles.moduleDetail}>{mod.detail}</div>}
              {mod.children && (
                <div className={styles.moduleChildren}>
                  {mod.children.map((c, j) => (
                    <span key={j} className={styles.moduleChild}>{c}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 2. Data Flow Card ── */

function DataFlowCard({ card }: { card: Extract<VizCard, { type: 'dataflow' }> }) {
  return (
    <div className={styles.flowLayout}>
      <div className={`${styles.card} ${styles.flowMain}`}>
        <CardHeader title={card.title} subtitle={card.subtitle} label={card.label || 'Active Stream'} />
        <div className={styles.flowSteps}>
          {card.steps.map((step, i) => (
            <div key={i} className={`${styles.flowStep} ${step.active ? styles.flowStepActive : ''}`}>
              <div className={`${styles.flowDot} ${step.active ? styles.flowDotActive : step.success ? styles.flowDotSuccess : ''}`} />
              <span className={styles.flowEndpoint}>{step.method ? `${step.method} ` : ''}{step.endpoint}</span>
              {step.duration && <span className={styles.flowDuration}>{step.duration}</span>}
            </div>
          ))}
        </div>
        {card.metric && (
          <div className={styles.flowMetric}>
            <div className={styles.flowMetricValue}>{card.metric.value}</div>
            <div className={styles.flowMetricLabel}>{card.metric.label}</div>
          </div>
        )}
      </div>
      {card.sidebar && (
        <div className={styles.flowSidebar}>
          <h4 className={styles.flowSidebarTitle}>{card.sidebar.title}</h4>
          <p className={styles.flowSidebarDesc}>{card.sidebar.description}</p>
          <div className={styles.flowBar}>
            <div className={styles.flowBarFill} />
          </div>
          <div className={styles.flowBarLabel}>System Saturation</div>
        </div>
      )}
    </div>
  );
}

/* ── 3. Comparison Card ── */

function ComparisonCard({ card }: { card: Extract<VizCard, { type: 'comparison' }> }) {
  return (
    <div className={styles.card}>
      <CardHeader title={card.title} subtitle={card.subtitle} label={card.label || 'A/B Intelligence'} />
      <div className={styles.compareGrid}>
        {card.sides.map((side, i) => (
          <div key={i} className={`${styles.compareSide} ${side.badgeVariant === 'highlight' ? styles.compareSideHighlight : ''}`}>
            <div className={styles.compareSideHeader}>
              <div className={styles.compareSideIcon}>
                <span className="material-symbols-outlined">{side.icon || (i === 0 ? 'terminal' : 'bolt')}</span>
              </div>
              <span className={styles.compareSideName}>{side.name}</span>
              {side.badge && (
                <span className={`${styles.compareBadge} ${side.badgeVariant === 'highlight' ? styles.compareBadgeHighlight : ''}`}>
                  {side.badge}
                </span>
              )}
            </div>
            <ul className={styles.compareRows}>
              {side.rows.map((row, j) => (
                <li key={j} className={styles.compareRow}>
                  <span className={styles.compareRowLabel}>{row.label}</span>
                  <span className={`${styles.compareRowValue} ${row.highlight ? styles.compareRowHighlight : ''}`}>
                    {row.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {card.insight && (
        <div className={styles.cardInsight}>
          <span className="material-symbols-outlined">info</span>
          <p>{card.insight}</p>
        </div>
      )}
    </div>
  );
}

/* ── 4. Statistics Card ── */

function StatisticsCard({ card }: { card: Extract<VizCard, { type: 'statistics' }> }) {
  return (
    <div className={styles.card}>
      <CardHeader title={card.title} subtitle={card.subtitle} label={card.label || 'Performance Index'} />
      <div className={styles.statsGrid}>
        {card.stats.map((stat, i) => (
          <div key={i} className={styles.statItem}>
            <div className={styles.statLabel}>{stat.label}</div>
            <div className={`${styles.statValue} ${stat.label.toLowerCase().includes('error') ? styles.statError : ''}`}>
              {stat.value}
            </div>
            {stat.trend && (
              <div className={`${styles.statTrend} ${stat.trendColor === 'success' ? styles.trendSuccess : stat.trendColor === 'secondary' ? styles.trendSecondary : ''}`}>
                {stat.trendIcon && <span className="material-symbols-outlined">{stat.trendIcon}</span>}
                <span>{stat.trend}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      {card.bars && (
        <div className={styles.barsSection}>
          <div className={styles.barsLabel}>Performance History</div>
          <div className={styles.barsContainer}>
            {card.bars.values.map((v, i) => (
              <div
                key={i}
                className={styles.bar}
                style={{ height: `${v}%` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 5. Timeline Card ── */

function TimelineCard({ card }: { card: Extract<VizCard, { type: 'timeline' }> }) {
  return (
    <div className={styles.card}>
      <CardHeader title={card.title} subtitle={card.subtitle} label={card.label || 'Workflow Pipeline'} />
      <div className={styles.timeline}>
        <div className={styles.timelineLine} />
        <div className={styles.timelineSteps}>
          {card.steps.map((step, i) => {
            const dotClass = step.status === 'completed' ? styles.timelineDotCompleted
              : step.status === 'active' ? styles.timelineDotActive
              : styles.timelineDotPending;
            const itemClass = step.status === 'pending' ? styles.timelineItemPending : '';
            return (
              <div key={i} className={`${styles.timelineItem} ${itemClass}`}>
                <div className={`${styles.timelineDot} ${dotClass}`}>
                  {step.status === 'completed' && <span className="material-symbols-outlined">check</span>}
                  {step.status === 'active' && <div className={styles.timelineDotPulse} />}
                  {step.status === 'pending' && <span className="material-symbols-outlined">{step.icon || 'more_horiz'}</span>}
                </div>
                <div className={styles.timelineContent}>
                  <div className={styles.timelineTitle}>{step.title}</div>
                  <div className={styles.timelineDesc}>{step.description}</div>
                  {step.detail && (
                    <div className={styles.timelineDetail}>{step.detail}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── JSON parser ── */

function parseCard(code: string): VizCard | null {
  try {
    const raw = typeof code === 'string' ? JSON.parse(code) : code;
    const validTypes = ['architecture', 'dataflow', 'comparison', 'statistics', 'timeline'];
    if (raw && typeof raw.type === 'string' && validTypes.includes(raw.type)) {
      return raw as VizCard;
    }
    return null;
  } catch {
    try {
      const raw = new Function('return (' + code + ')')();
      const validTypes = ['architecture', 'dataflow', 'comparison', 'statistics', 'timeline'];
      if (raw && typeof raw.type === 'string' && validTypes.includes(raw.type)) {
        return raw as VizCard;
      }
      return null;
    } catch {
      return null;
    }
  }
}

export { VisualizationCard };
