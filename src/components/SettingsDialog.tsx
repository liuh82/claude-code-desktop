import { useState, useCallback, useEffect } from 'react';
import { useSettingsStore, type AppSettings } from '@/stores/useSettingsStore';
import { claudeApi, isElectron } from '@/lib/claude-api';
import './SettingsDialog.css';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const FONT_OPTIONS = [
  'JetBrains Mono',
  'Fira Code',
  'Source Code Pro',
  'Cascadia Code',
  'Menlo',
  'Monaco',
  'Consolas',
  'monospace',
];

const MODEL_OPTIONS = [
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-haiku-4-5-20251001',
  'glm-4-plus',
  'glm-4-flash',
  'glm-5-turbo',
];

const LOG_LEVEL_OPTIONS = ['debug', 'info', 'warn', 'error'] as const;

type TabId = 'general' | 'appearance' | 'claude' | 'advanced';

const TABS: { id: TabId; label: string }[] = [
  { id: 'general', label: '通用' },
  { id: 'appearance', label: '外观' },
  { id: 'claude', label: 'Claude Code' },
  { id: 'advanced', label: '高级' },
];

function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const { settings, loaded, updateSetting, saveSettings, resetSettings } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [dirty, setDirty] = useState(false);
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

  // Sync local state when settings load
  useEffect(() => {
    if (loaded) {
      setLocalSettings(settings);
      setDirty(false);
    }
  }, [loaded, settings]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (dirty) {
          setLocalSettings(settings);
          setDirty(false);
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, dirty, settings]);

  const handleChange = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setLocalSettings((prev) => ({ ...prev, [key]: value }));
      setDirty(true);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    // Apply each changed setting
    for (const key of Object.keys(localSettings) as (keyof AppSettings)[]) {
      if (localSettings[key] !== settings[key]) {
        updateSetting(key, localSettings[key]);
      }
    }
    await saveSettings();
    setDirty(false);
    onClose();
  }, [localSettings, settings, updateSetting, saveSettings, onClose]);

  const handleReset = useCallback(() => {
    resetSettings();
    setLocalSettings({ ...useSettingsStore.getState().settings });
    setDirty(false);
  }, [resetSettings]);

  const [detectStatus, setDetectStatus] = useState('');

  const handleDetectCli = useCallback(async () => {
    setDetectStatus('检测中...');
    try {
      
      if (!isElectron()) {
        setDetectStatus('仅在桌面应用中可用');
        return;
      }
      const info = await claudeApi.checkClaudeCli();
      if (info.available) {
        handleChange('claudeCliPath', info.path);
        setDetectStatus(`已找到 v${info.version}`);
      } else {
        setDetectStatus('未找到 Claude CLI');
      }
    } catch {
      setDetectStatus('检测失败');
    }
  }, [handleChange]);

  if (!isOpen) return null;

  return (
    <div className="sd-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !dirty) onClose(); }}>
      <div className="sd-container" role="dialog" aria-label="Settings">
        <div className="sd-header">
          <h2 className="sd-title">设置</h2>
          <button className="sd-close" onClick={() => { if (dirty) { setLocalSettings(settings); setDirty(false); } onClose(); }} aria-label="Close settings">
            &times;
          </button>
        </div>

        <div className="sd-body">
          <nav className="sd-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`sd-tab ${activeTab === tab.id ? 'sd-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="sd-content">
            {activeTab === 'general' && (
              <SettingsSection>
                <SettingsField label="默认项目路径">
                  <input
                    className="sd-input"
                    type="text"
                    value={localSettings.defaultProjectPath}
                    onChange={(e) => handleChange('defaultProjectPath', e.target.value)}
                    placeholder="/home/user/projects"
                  />
                </SettingsField>
                <SettingsField label="自动保存间隔（秒）">
                  <input
                    className="sd-input sd-input--number"
                    type="number"
                    min={5}
                    max={300}
                    value={localSettings.autoSaveInterval}
                    onChange={(e) => handleChange('autoSaveInterval', parseInt(e.target.value, 10) || 30)}
                  />
                </SettingsField>
                <SettingsField label="最大并发会话数">
                  <input
                    className="sd-input sd-input--number"
                    type="number"
                    min={1}
                    max={50}
                    value={localSettings.maxConcurrentSessions}
                    onChange={(e) => handleChange('maxConcurrentSessions', parseInt(e.target.value, 10) || 10)}
                  />
                </SettingsField>
              </SettingsSection>
            )}

            {activeTab === 'appearance' && (
              <SettingsSection>
                <SettingsField label="主题">
                  <select
                    className="sd-select"
                    value={localSettings.theme}
                    onChange={(e) => handleChange('theme', e.target.value as AppSettings['theme'])}
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="system">System</option>
                  </select>
                </SettingsField>
                <SettingsField label="字体大小">
                  <input
                    className="sd-input sd-input--number"
                    type="number"
                    min={10}
                    max={24}
                    value={localSettings.fontSize}
                    onChange={(e) => handleChange('fontSize', parseInt(e.target.value, 10) || 14)}
                  />
                </SettingsField>
                <SettingsField label="字体">
                  <select
                    className="sd-select"
                    value={localSettings.fontFamily}
                    onChange={(e) => handleChange('fontFamily', e.target.value)}
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </SettingsField>
              </SettingsSection>
            )}

            {activeTab === 'claude' && (
              <SettingsSection>
                <SettingsField label="Claude CLI 路径">
                  <div className="sd-row">
                    <input
                      className="sd-input"
                      type="text"
                      value={localSettings.claudeCliPath}
                      onChange={(e) => handleChange('claudeCliPath', e.target.value)}
                      placeholder="自动检测"
                    />
                    <button className="sd-btn" onClick={handleDetectCli}>{detectStatus || '检测'}</button>
                  </div>
                </SettingsField>
                <SettingsField label="默认模型">
                  <select
                    className="sd-select"
                    value={localSettings.defaultModel}
                    onChange={(e) => handleChange('defaultModel', e.target.value)}
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </SettingsField>
                <SettingsField label="权限模式">
                  <select
                    className="sd-select"
                    value={localSettings.permissionMode}
                    onChange={(e) => handleChange('permissionMode', e.target.value as AppSettings['permissionMode'])}
                  >
                    <option value="default">Default</option>
                    <option value="strict">Strict</option>
                    <option value="permissive">Permissive</option>
                  </select>
                </SettingsField>
                <SettingsField label="最大 Token 数">
                  <input
                    className="sd-input sd-input--number"
                    type="number"
                    min={1024}
                    max={200000}
                    step={1024}
                    value={localSettings.maxTokens}
                    onChange={(e) => handleChange('maxTokens', parseInt(e.target.value, 10) || 16384)}
                  />
                </SettingsField>
                <SettingsField label="API 模式">
                  <select
                    className="sd-select"
                    value={(localSettings as any).apiMode || 'direct'}
                    onChange={(e) => handleChange('apiMode' as any, e.target.value as any)}
                  >
                    <option value="direct">Direct API（推荐，实时流式输出）</option>
                    <option value="cli">Claude CLI（claude -p 模式）</option>
                  </select>
                </SettingsField>
                {(localSettings as any).apiMode === 'direct' && (
                  <>
                    <SettingsField label="API Key">
                      <input
                        className="sd-input"
                        type="password"
                        value={(localSettings as any).directApiKey || ''}
                        onChange={(e) => handleChange('directApiKey' as any, e.target.value)}
                        placeholder="sk-ant-... 或从 ~/.claude/settings.json 自动读取"
                      />
                    </SettingsField>
                    <SettingsField label="API Base URL">
                      <input
                        className="sd-input"
                        type="text"
                        value={(localSettings as any).directBaseUrl || ''}
                        onChange={(e) => handleChange('directBaseUrl' as any, e.target.value)}
                        placeholder="https://api.anthropic.com（默认）"
                      />
                      <span className="sd-field__helper">Anthropic 官方留空即可；智谱填 https://open.bigmodel.cn/api/anthropic；自定义代理可填完整路径</span>
                    </SettingsField>
                    <SettingsField label="Direct API 模型">
                      <input
                        className="sd-input"
                        type="text"
                        value={(localSettings as any).directModel || ''}
                        onChange={(e) => handleChange('directModel' as any, e.target.value)}
                        placeholder="留空使用 Claude CLI 配置的模型"
                      />
                    </SettingsField>
                  </>
                )}
              </SettingsSection>
            )}

            {activeTab === 'advanced' && (
              <SettingsSection>
                <SettingsField label="日志级别">
                  <select
                    className="sd-select"
                    value={localSettings.logLevel}
                    onChange={(e) => handleChange('logLevel', e.target.value as AppSettings['logLevel'])}
                  >
                    {LOG_LEVEL_OPTIONS.map((l) => (
                      <option key={l} value={l}>{l.toUpperCase()}</option>
                    ))}
                  </select>
                </SettingsField>
                <SettingsField label="数据目录">
                  <input
                    className="sd-input"
                    type="text"
                    value={localSettings.dataDirectory}
                    onChange={(e) => handleChange('dataDirectory', e.target.value)}
                    placeholder="自动检测"
                  />
                </SettingsField>
                <SettingsField label="">
                  <button className="sd-btn sd-btn--danger" onClick={handleReset}>
                    恢复默认设置
                  </button>
                </SettingsField>
              </SettingsSection>
            )}
          </div>
        </div>

        <div className="sd-footer">
          <button className="sd-btn" onClick={() => { setLocalSettings(settings); setDirty(false); onClose(); }}>
            Cancel
          </button>
          <button className="sd-btn sd-btn--primary" onClick={handleSave} disabled={!dirty}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsSection({ children }: { children: React.ReactNode }) {
  return <div className="sd-section">{children}</div>;
}

function SettingsField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="sd-field">
      {label && <label className="sd-field__label">{label}</label>}
      <div className="sd-field__control">{children}</div>
    </div>
  );
}

export { SettingsDialog };
