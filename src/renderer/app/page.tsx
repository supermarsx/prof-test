'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Dashboard } from '../components/screens/Dashboard';
import { QuestionBankScreen } from '../components/screens/QuestionBankScreen';
import { TestBuilderScreen } from '../components/screens/TestBuilderScreen';
import { AIAssistantScreen } from '../components/screens/AIAssistantScreen';
import { ExportsScreen } from '../components/screens/ExportsScreen';
import { SettingsScreen } from '../components/screens/SettingsScreen';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { initI18n } from '../i18n/setup';
import { setLocale, t, Locale } from '../i18n';
import { api, initAPI } from '../lib/api';
import type { Settings } from '../../models';

type Screen = 'dashboard' | 'questions' | 'builder' | 'ai' | 'exports' | 'settings';

function extractSettingsResponse(
  response: Awaited<ReturnType<typeof api.getSettings>> | undefined,
): Settings | undefined {
  if (!response) return undefined;
  return 'settings' in response ? response.settings : undefined;
}

export default function HomePage() {
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [theme, setTheme] = useState<'dark' | 'light' | 'high-contrast'>('dark');
  const [fontScale, setFontScale] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');
  const [locale, setLocaleState] = useState<Locale>('en');
  const [projects, setProjects] = useState<string[]>([]);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Compute NAV_ITEMS inside the component so t() uses the current locale
  const NAV_ITEMS: { id: Screen; label: string; icon: string; shortcut: string }[] = useMemo(() => [
    { id: 'dashboard', label: t('nav.dashboard'), icon: '\u2302', shortcut: 'Ctrl+1' },
    { id: 'questions', label: t('nav.questionBank'), icon: '\u2630', shortcut: 'Ctrl+2' },
    { id: 'builder', label: t('nav.testBuilder'), icon: '\u2692', shortcut: 'Ctrl+3' },
    { id: 'ai', label: t('nav.aiAssistant'), icon: '\u2728', shortcut: 'Ctrl+4' },
    { id: 'exports', label: t('nav.exports'), icon: '\u21E9', shortcut: 'Ctrl+5' },
    { id: 'settings', label: t('nav.settings'), icon: '\u2699', shortcut: 'Ctrl+,' },
  ], [locale]);

  const refreshProjects = useCallback(async () => {
    try {
      const listRes = await api.listProjects();
      if (listRes?.projects) setProjects(listRes.projects);
      const activeRes = await api.getActiveProject();
      setActiveProject(activeRes?.active || null);
    } catch {}
  }, []);

  // Initialize Tauri API layer on mount
  useEffect(() => { initAPI(); }, []);

  // Initialize i18n and load stored language on mount
  useEffect(() => {
    initI18n();
    (async () => {
      try {
        const res = await api.getSettings();
        const s = extractSettingsResponse(res);
        if (s?.language) {
          const lang = s.language as Locale;
          setLocale(lang);
          setLocaleState(lang);
          document.documentElement.lang = lang;
          // Set RTL direction for Arabic
          document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        }
      } catch {}
    })();
  }, []);

  // Detect OS color scheme preference, restore saved theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('proftest_theme_override');
    if (savedTheme && (savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'high-contrast')) {
      setTheme(savedTheme);
      return;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
    }
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('proftest_theme_override')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    refreshProjects();
    // Apply theme and font scale classes
    document.body.className = `theme-${theme} font-scale-${fontScale}`;
  }, [theme, fontScale, refreshProjects]);

  const activateProject = async (name: string) => {
    if (!name) return;
    setStatus(null);
    try {
      const res = await api.activateProject(name);
      if (res?.ok) {
        setActiveProject(name);
        setRefreshKey(k => k + 1);
      } else {
        setStatus(res?.error || 'Failed to activate project');
      }
    } catch (e) {
      setStatus(String(e));
    }
  };

  const createProject = async (name: string) => {
    setStatus(null);
    try {
      const res = await api.createProject(name);
      if (res?.ok) {
        await refreshProjects();
        await activateProject(name);
      } else {
        setStatus(res?.error || 'Failed to create project');
      }
    } catch (e) {
      setStatus(String(e));
    }
  };

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : prev === 'light' ? 'high-contrast' : 'dark';
      localStorage.setItem('proftest_theme_override', next);
      return next;
    });
  }, []);

  const refresh = () => setRefreshKey(k => k + 1);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs/textareas
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+1..6: Navigate to screens
      if (ctrl && e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (NAV_ITEMS[idx]) setScreen(NAV_ITEMS[idx].id);
        return;
      }

      // Ctrl+D: Dashboard
      if (ctrl && e.key === 'd') {
        e.preventDefault();
        setScreen('dashboard');
        return;
      }

      // Ctrl+Q: Question Bank
      if (ctrl && e.key === 'q') {
        e.preventDefault();
        setScreen('questions');
        return;
      }

      // Ctrl+B: Test Builder
      if (ctrl && e.key === 'b') {
        e.preventDefault();
        setScreen('builder');
        return;
      }

      // Ctrl+T: Toggle theme
      if (ctrl && e.key === 't') {
        e.preventDefault();
        toggleTheme();
        return;
      }

      // Ctrl+R or F5: Refresh
      if ((ctrl && e.key === 'r') || e.key === 'F5') {
        e.preventDefault();
        refresh();
        refreshProjects();
        return;
      }

      // Ctrl+,: Settings
      if (ctrl && e.key === ',') {
        e.preventDefault();
        setScreen('settings');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleTheme, refreshProjects]);

  const renderScreen = () => {
    switch (screen) {
      case 'dashboard':
        return <Dashboard
          activeProject={activeProject}
          onNavigate={setScreen}
          onCreateProject={createProject}
          onActivateProject={activateProject}
          projects={projects}
          refreshKey={refreshKey}
        />;
      case 'questions':
        return <QuestionBankScreen
          refreshKey={refreshKey}
          onRefresh={refresh}
        />;
      case 'builder':
        return <TestBuilderScreen
          refreshKey={refreshKey}
          onRefresh={refresh}
        />;
      case 'ai':
        return <AIAssistantScreen
          refreshKey={refreshKey}
          onRefresh={refresh}
        />;
      case 'exports':
        return <ExportsScreen refreshKey={refreshKey} />;
      case 'settings':
        return <SettingsScreen
          theme={theme}
          onToggleTheme={toggleTheme}
          fontScale={fontScale}
          onFontScaleChange={setFontScale}
        />;
      default:
        return null;
    }
  };

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <nav className="sidebar">
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--text-accent)' }}>
            ProfTest
          </h3>
          <span className="text-xs text-tertiary">LaTeX Test Generator</span>
        </div>

        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`sidebar-item ${screen === item.id ? 'active' : ''}`}
            onClick={() => setScreen(item.id)}
            title={item.shortcut}
            aria-label={item.label}
            aria-current={screen === item.id ? 'page' : undefined}
          >
            <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>{item.icon}</span>
            {item.label}
            <span className="text-xs text-tertiary" style={{ marginLeft: 'auto', fontSize: '10px' }}>
              {item.shortcut}
            </span>
          </button>
        ))}

        <div style={{ marginTop: 'auto', paddingTop: 'var(--space-md)' }}>
          <hr className="divider" />
          <div className="text-xs text-tertiary" style={{ padding: 'var(--space-sm)' }}>
            {activeProject ? (
              <span>Project: <strong style={{ color: 'var(--text-primary)' }}>{activeProject}</strong></span>
            ) : (
              <span>No project selected</span>
            )}
          </div>
        </div>
      </nav>

      {/* Main Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Bar */}
        <div className="top-bar">
          <div className="flex items-center gap-sm">
            <select
              value={activeProject || ''}
              onChange={e => activateProject(e.target.value)}
              style={{ width: 'auto', minWidth: '160px' }}
            >
              <option value="">Select project...</option>
              {projects.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            {status && <span className="text-sm text-danger">{status}</span>}
          </div>
          <div className="flex items-center gap-sm">
            <button className="btn-ghost btn-sm" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? '\u2600' : theme === 'light' ? '\u25D1' : '\u263D'}
            </button>
          </div>
        </div>

        {/* Content */}
        <main className="main-content">
          <ErrorBoundary key={screen}>
            {renderScreen()}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
