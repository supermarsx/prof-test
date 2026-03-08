'use client';

import { useState, useEffect, useCallback } from 'react';
import { t } from '../../i18n';
import { api } from '../../lib/api';

interface Props {
  theme: 'dark' | 'light' | 'high-contrast';
  onToggleTheme: () => void;
  fontScale: 'sm' | 'md' | 'lg' | 'xl';
  onFontScaleChange: (scale: 'sm' | 'md' | 'lg' | 'xl') => void;
}

interface SettingsState {
  // LaTeX
  latex_path: string;
  use_embedded_latex: boolean;
  latex_detected: boolean;
  latex_detection_info: string;

  // AI
  ai_provider: string;
  ai_api_key: string;
  ai_model: string;
  ai_base_url: string;

  // General
  language: string;
}

export function SettingsScreen({ theme, onToggleTheme, fontScale, onFontScaleChange }: Props) {
  const [settings, setSettings] = useState<SettingsState>({
    latex_path: '',
    use_embedded_latex: true,
    latex_detected: false,
    latex_detection_info: '',
    ai_provider: 'openai',
    ai_api_key: '',
    ai_model: '',
    ai_base_url: '',
    language: 'en',
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [section, setSection] = useState<'general' | 'latex' | 'ai' | 'cache'>('general');
  const [cacheClearing, setCacheClearing] = useState(false);

  // Header presets
  const [headerPresets, setHeaderPresets] = useState<any[]>([]);
  const [layoutPresets, setLayoutPresets] = useState<any[]>([]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await api.getSettings();
      const s = res?.settings || res;
      if (s) {
        setSettings(prev => ({
          ...prev,
          latex_path: s.latex_path || '',
          use_embedded_latex: s.use_embedded_latex !== false,
          ai_provider: s.ai_provider || 'openai',
          ai_api_key: '', // Never pre-fill API keys
          language: s.language || 'en',
        }));
      }
    } catch {}
  }, []);

  const loadPresets = useCallback(async () => {
    try {
      const [hRes, lRes] = await Promise.all([
        api.listHeaderPresets(),
        api.listLayoutPresets(),
      ]);
      if (hRes?.presets && Array.isArray(hRes.presets)) setHeaderPresets(hRes.presets);
      else if (Array.isArray(hRes)) setHeaderPresets(hRes);
      if (lRes?.presets && Array.isArray(lRes.presets)) setLayoutPresets(lRes.presets);
      else if (Array.isArray(lRes)) setLayoutPresets(lRes);
    } catch {}
  }, []);

  useEffect(() => {
    loadSettings();
    loadPresets();
    detectLatex();
  }, [loadSettings, loadPresets]);

  const detectLatex = async () => {
    try {
      const res = await api.detectLatex();
      if (res) {
        setSettings(prev => ({
          ...prev,
          latex_detected: !!res.found,
          latex_detection_info: res.found
             ? t('settings.latexFoundAt', { engine: res.engine ?? '', path: res.path ?? '' })
            : t('settings.noLatexDetected'),
          latex_path: res.path || prev.latex_path,
        }));
      }
    } catch {}
  };

  const saveSettings = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const toSave: Record<string, any> = {
        latex_path: settings.latex_path,
        use_embedded_latex: settings.use_embedded_latex,
        ai_provider: settings.ai_provider,
        language: settings.language,
      };
      // Only save API key if user entered one
      if (settings.ai_api_key.trim()) {
        toSave.ai_api_key_encrypted = settings.ai_api_key;
      }
      const res = await api.saveSettings(toSave);
      if (res?.ok) {
        setStatus(t('settings.saved'));
      } else {
        setStatus(res?.error || t('settings.saveFailed'));
      }
    } catch (e) {
      setStatus(String(e));
    }
    setLoading(false);
  };

  const configureAI = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const config: { provider: string; apiKey?: string; model?: string; baseUrl?: string } = {
        provider: settings.ai_provider,
      };
      if (settings.ai_api_key.trim()) config.apiKey = settings.ai_api_key;
      if (settings.ai_model.trim()) config.model = settings.ai_model;
      if (settings.ai_base_url.trim()) config.baseUrl = settings.ai_base_url;

      const res = await api.configureAI(config);
      if (res?.ok) {
        setStatus(t('settings.aiConfigured'));
      } else {
        setStatus(res?.error || t('settings.aiConfigFailed'));
      }
    } catch (e) {
      setStatus(String(e));
    }
    setLoading(false);
  };

  const clearAiCache = async () => {
    setCacheClearing(true);
    try {
      const res = await api.clearAiCache();
      setStatus(res?.ok ? t('settings.aiCacheCleared') : (res?.error || t('settings.cacheClearFailed')));
    } catch (e) { setStatus(String(e)); }
    setCacheClearing(false);
  };

  const removeHeaderPreset = async (id: string) => {
    try {
      await api.removeHeaderPreset(id);
      await loadPresets();
      setStatus(t('settings.headerPresetRemoved'));
    } catch (e) { setStatus(String(e)); }
  };

  const removeLayoutPreset = async (id: string) => {
    try {
      await api.removeLayoutPreset(id);
      await loadPresets();
      setStatus(t('settings.layoutPresetRemoved'));
    } catch (e) { setStatus(String(e)); }
  };

  const sections: { id: typeof section; label: string }[] = [
    { id: 'general', label: t('settings.general') },
    { id: 'latex', label: t('settings.latex') },
    { id: 'ai', label: t('settings.aiProvider') },
    { id: 'cache', label: t('settings.cacheData') },
  ];

  return (
    <div className="fade-in flex-col gap-md" style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <h2>{t('settings.title')}</h2>

      {status && (
        <div className="text-sm" style={{
          color: status.includes('success') || status.includes('saved') || status.includes('configured') || status.includes('cleared') || status.includes('removed')
            ? 'var(--text-success)'
            : 'var(--text-danger)',
        }}>
          {status}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-md)', flex: 1, overflow: 'hidden' }}>
        {/* Section nav */}
        <div className="flex-col gap-xs" role="tablist" aria-label="Settings sections" style={{ width: '160px', minWidth: '160px' }}>
          {sections.map(s => (
            <button
              key={s.id}
              role="tab"
              aria-selected={section === s.id}
              className={`sidebar-item ${section === s.id ? 'active' : ''}`}
              onClick={() => { setSection(s.id); setStatus(null); }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Settings panels */}
        <div className="panel" style={{ flex: 1, overflow: 'auto', maxWidth: '600px' }}>
          {/* General */}
          {section === 'general' && (
            <div className="flex-col gap-md">
              <h4>{t('settings.generalHeading')}</h4>

              {/* Theme */}
              <div className="flex items-center justify-between">
                <div>
                  <strong>{t('settings.theme')}</strong>
                  <p className="text-sm text-secondary">{t('settings.themeCycleDesc')}</p>
                </div>
                <button onClick={onToggleTheme} className="btn-primary btn-sm">
                  {theme === 'dark' ? t('settings.switchLight') : theme === 'light' ? t('settings.switchHighContrast') : t('settings.switchDark')}
                </button>
              </div>

              <hr className="divider" />

              {/* Font Size */}
              <div>
                <label>{t('settings.fontSize')}</label>
                <select value={fontScale} onChange={e => onFontScaleChange(e.target.value as any)}>
                  <option value="sm">{t('settings.fontSm')}</option>
                  <option value="md">{t('settings.fontMd')}</option>
                  <option value="lg">{t('settings.fontLg')}</option>
                  <option value="xl">{t('settings.fontXl')}</option>
                </select>
                <p className="text-xs text-tertiary">{t('settings.fontSizeDesc')}</p>
              </div>

              <hr className="divider" />

              {/* Language */}
              <div>
                <label>{t('settings.language')}</label>
                <select value={settings.language} onChange={e => setSettings(s => ({ ...s, language: e.target.value }))}>
                  <option value="en">English</option>
                  <option value="fr">French</option>
                  <option value="es">Spanish</option>
                  <option value="de">German</option>
                  <option value="ar">Arabic</option>
                </select>
              </div>

              <button className="btn-primary" onClick={saveSettings} disabled={loading}>
                {loading ? t('settings.saving') : t('settings.saveGeneral')}
              </button>
            </div>
          )}

          {/* LaTeX */}
          {section === 'latex' && (
            <div className="flex-col gap-md">
              <h4>{t('settings.latexHeading')}</h4>

              {/* Detection status */}
              <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
                <div className="flex items-center gap-sm mb-sm">
                  <span style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: settings.latex_detected ? 'var(--success)' : 'var(--danger)',
                    display: 'inline-block',
                  }} />
                  <strong>{settings.latex_detected ? t('settings.latexDetected') : t('settings.latexNotFound')}</strong>
                </div>
                <p className="text-sm text-secondary">{settings.latex_detection_info || t('settings.latexDetectDefault')}</p>
                <button className="btn-sm mt-sm" onClick={detectLatex}>{t('settings.reDetect')}</button>
              </div>

              <div>
                <label>{t('settings.customLatexPath')}</label>
                <div className="flex gap-sm">
                  <input value={settings.latex_path}
                    onChange={e => setSettings(s => ({ ...s, latex_path: e.target.value }))}
                    placeholder={t('settings.latexPathPlaceholder')} style={{ flex: 1 }} />
                  <button className="btn-sm" onClick={async () => {
                    try {
                      const result = await api.showOpenDialog({
                        title: t('settings.selectLatexExe'),
                        multiple: false,
                      });
                      if (!result.canceled && result.filePaths?.length) {
                        setSettings(s => ({ ...s, latex_path: result.filePaths[0] }));
                      }
                    } catch {}
                  }}>{t('common.browse')}</button>
                </div>
                <p className="text-xs text-tertiary">{t('settings.latexPathOverride')}</p>
              </div>

              <div className="flex items-center gap-sm">
                <input type="checkbox" id="embedded-latex"
                  checked={settings.use_embedded_latex}
                  onChange={e => setSettings(s => ({ ...s, use_embedded_latex: e.target.checked }))} />
                <label htmlFor="embedded-latex" style={{ margin: 0 }}>{t('settings.useEmbeddedLatex')}</label>
              </div>

              <hr className="divider" />

              {/* Header Presets */}
              <div>
                <h5 className="mb-sm">{t('settings.headerPresets')}</h5>
                {headerPresets.length === 0 && (
                  <p className="text-sm text-tertiary">{t('settings.noHeaderPresets')}</p>
                )}
                {headerPresets.map(p => (
                  <div key={p.id} className="flex items-center justify-between mb-xs"
                    style={{ padding: 'var(--space-xs) var(--space-sm)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                    <span className="text-sm">{p.name} <span className="badge">{p.scope}</span></span>
                    <button className="btn-ghost btn-sm btn-danger" onClick={() => removeHeaderPreset(p.id)}>{t('settings.remove')}</button>
                  </div>
                ))}
              </div>

              {/* Layout Presets */}
              <div>
                <h5 className="mb-sm">{t('settings.layoutPresets')}</h5>
                {layoutPresets.length === 0 && (
                  <p className="text-sm text-tertiary">{t('settings.noLayoutPresets')}</p>
                )}
                {layoutPresets.map(p => (
                  <div key={p.id} className="flex items-center justify-between mb-xs"
                    style={{ padding: 'var(--space-xs) var(--space-sm)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                    <span className="text-sm">{p.name}</span>
                    <button className="btn-ghost btn-sm btn-danger" onClick={() => removeLayoutPreset(p.id)}>{t('settings.remove')}</button>
                  </div>
                ))}
              </div>

              <button className="btn-primary" onClick={saveSettings} disabled={loading}>
                {loading ? t('settings.saving') : t('settings.saveLaTeX')}
              </button>
            </div>
          )}

          {/* AI Provider */}
          {section === 'ai' && (
            <div className="flex-col gap-md">
              <h4>{t('settings.aiHeading')}</h4>
              <p className="text-sm text-secondary">
                {t('settings.aiDesc')}
              </p>

              <div>
                <label>{t('settings.provider')}</label>
                <select value={settings.ai_provider}
                  onChange={e => setSettings(s => ({ ...s, ai_provider: e.target.value }))}>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="local">Local (Ollama)</option>
                </select>
              </div>

              <div>
                <label>{t('settings.apiKey')}</label>
                <input type="password" value={settings.ai_api_key}
                  onChange={e => setSettings(s => ({ ...s, ai_api_key: e.target.value }))}
                  placeholder={t('settings.apiKeyPlaceholder')} />
                <p className="text-xs text-tertiary">{t('settings.apiKeyHint')}</p>
              </div>

              <div>
                <label>{t('settings.model')}</label>
                <input value={settings.ai_model}
                  onChange={e => setSettings(s => ({ ...s, ai_model: e.target.value }))}
                  placeholder={settings.ai_provider === 'openai' ? 'gpt-4' : settings.ai_provider === 'anthropic' ? 'claude-3-sonnet' : 'llama2'} />
              </div>

              {settings.ai_provider === 'local' && (
                <div>
                  <label>{t('settings.baseUrl')}</label>
                  <input value={settings.ai_base_url}
                    onChange={e => setSettings(s => ({ ...s, ai_base_url: e.target.value }))}
                    placeholder="http://localhost:11434" />
                </div>
              )}

              <div className="flex gap-sm">
                <button className="btn-primary" onClick={configureAI} disabled={loading}>
                  {loading ? t('settings.configuring') : t('settings.configureAI')}
                </button>
                <button onClick={saveSettings} disabled={loading}>
                  {t('settings.saveToSettings')}
                </button>
              </div>
            </div>
          )}

          {/* Cache & Data */}
          {section === 'cache' && (
            <div className="flex-col gap-md">
              <h4>{t('settings.cacheHeading')}</h4>

              <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
                <strong>{t('settings.aiCacheLabel')}</strong>
                <p className="text-sm text-secondary mt-xs">
                  {t('settings.aiCacheDesc')}
                </p>
                <button className="btn-sm mt-sm" onClick={clearAiCache} disabled={cacheClearing}>
                  {cacheClearing ? t('settings.clearing') : t('settings.clearAiCache')}
                </button>
              </div>

              <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
                <strong>{t('settings.appCacheLabel')}</strong>
                <p className="text-sm text-secondary mt-xs">
                  {t('settings.appCacheDesc')}
                </p>
              </div>

              <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
                <strong>{t('settings.dataStorageLabel')}</strong>
                <p className="text-sm text-secondary mt-xs">
                  {t('settings.dataStorageDesc')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
