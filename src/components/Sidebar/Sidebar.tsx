import { useState, useEffect, useMemo } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useChatStore } from '@/stores/useChatStore';
import { claudeApi, isElectron } from '@/lib/claude-api';
import styles from './Sidebar.module.css';

interface ClaudeConfig {
  model: string;
  baseUrl: string | null;
  sonnetModel: string;
  opusModel: string;
  haikuModel: string;
}

const CC_BUILTIN_MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-opus-4-6', label: 'Opus 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
];

interface SidebarProps {
  projectPath: string;
  onNewChat: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
}

function Sidebar({ projectPath, onNewChat, onClose, onOpenSettings, onToggleTheme, style }: SidebarProps & { style?: React.CSSProperties }) {
  const { settings, updateSetting } = useSettingsStore();
  const currentModel = useChatStore((s) => s.currentModel) || settings.defaultModel;
  const [claudeConfig, setClaudeConfig] = useState<ClaudeConfig | null>(null);

  useEffect(() => {
    if (isElectron()) {
      claudeApi.getClaudeConfig().then(setClaudeConfig).catch(() => {});
    }
  }, []);

  const modelOptions = useMemo(() => {
    const list = [...CC_BUILTIN_MODELS];
    if (claudeConfig) {
      const known = new Set(list.map(m => m.id));
      for (const key of ['model', 'sonnetModel', 'opusModel', 'haikuModel'] as const) {
        const m = claudeConfig[key];
        if (m && !known.has(m)) {
          const label = m.replace('claude-', '').replace(/-\d{8}$/, '').replace(/^glm-/, 'GLM ');
          list.unshift({ id: m, label });
          known.add(m);
        }
      }
    }
    return list;
  }, [claudeConfig]);

  const projectName = projectPath
    ? projectPath.split('/').pop() || projectPath
    : '无项目';

  return (
    <aside className={styles.sidebar} style={style}>
      <div className={styles.sidebarTop}>
        <div className={styles.projectRow}>
          <span className={styles.projectIcon}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>account_tree</span>
          </span>
          <span className={styles.projectName} title={projectPath}>{projectName}</span>
          <button className={styles.newChatBtn} onClick={onNewChat} title="新建对话 (⌘N)">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
          </button>
        </div>
        <div className={styles.modelRow}>
          <select
            className={styles.modelSelect}
            value={currentModel}
            onChange={(e) => updateSetting('defaultModel', e.target.value)}
            title="选择模型"
          >
            {modelOptions.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.sessionList}>
        <div className={styles.sessionEmpty}>暂无历史会话</div>
      </div>

      <div className={styles.sidebarFooter}>
        <button className={styles.footerBtn} onClick={onToggleTheme} title="切换主题">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>dark_mode</span>
        </button>
        <button className={styles.footerBtn} onClick={onOpenSettings} title="设置 (⌘,)">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>settings</span>
        </button>
        <button className={styles.footerBtn} onClick={onClose} title="关闭侧栏 (⌘B)">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
        </button>
      </div>
    </aside>
  );
}

export { Sidebar };
