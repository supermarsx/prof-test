'use client';

import { useState } from 'react';
import { t } from '../../i18n';
import { api } from '../../lib/api';

interface DashboardProps {
  activeProject: string | null;
  projects: string[];
  onNavigate: (screen: any) => void;
  onCreateProject: (name: string) => Promise<void>;
  onActivateProject?: (name: string) => void;
  refreshKey: number;
}

export function Dashboard({ activeProject, projects, onNavigate, onCreateProject, onActivateProject, refreshKey }: DashboardProps) {
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);
  const [importPath, setImportPath] = useState('');
  const [importName, setImportName] = useState('');
  const [exportPath, setExportPath] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleCreate = async () => {
    if (!newProjectName.trim()) return;
    setCreating(true);
    await onCreateProject(newProjectName.trim());
    setNewProjectName('');
    setCreating(false);
  };

  const handleExport = async () => {
    if (!activeProject || !exportPath.trim()) {
      setStatus(t('dashboard.exportSelectProject'));
      return;
    }
    setExporting(true);
    try {
      const res = await api.exportProject(activeProject, exportPath.trim());
      setStatus(res?.ok ? t('dashboard.exportSuccess') : (res?.error || t('dashboard.exportFailed')));
    } catch (e) { setStatus(String(e)); } finally { setExporting(false); }
  };

  const handleImport = async () => {
    if (!importPath.trim() || !importName.trim()) {
      setStatus(t('dashboard.importEnterBoth'));
      return;
    }
    setImporting(true);
    try {
      const res = await api.importProject(importPath.trim(), importName.trim());
      if (res?.ok) {
        setStatus(t('dashboard.importSuccess'));
        setImportPath('');
        setImportName('');
      } else {
        setStatus(res?.error || t('dashboard.importFailed'));
      }
    } catch (e) { setStatus(String(e)); } finally { setImporting(false); }
  };

  const quickActions = [
    { label: t('dashboard.newQuestion'), desc: t('dashboard.newQuestionDesc'), screen: 'questions', icon: '+' },
    { label: t('dashboard.buildTest'), desc: t('dashboard.buildTestDesc'), screen: 'builder', icon: '\u2692' },
    { label: t('dashboard.aiAutoBuilder'), desc: t('dashboard.aiAutoBuilderDesc'), screen: 'ai', icon: '\u2728' },
    { label: t('dashboard.exportResults'), desc: t('dashboard.exportResultsDesc'), screen: 'exports', icon: '\u21E9' },
  ];

  return (
    <div className="fade-in flex-col gap-lg" style={{ display: 'flex' }}>
      {/* Header */}
      <div>
        <h1 style={{ marginBottom: 'var(--space-sm)' }}>
          {activeProject ? t('dashboard.welcomeProject', { project: activeProject }) : t('dashboard.welcomeDefault')}
        </h1>
        <p className="text-secondary">
          {activeProject
            ? t('dashboard.subtitleActive')
            : t('dashboard.subtitleInactive')}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid-2" style={{ maxWidth: '600px' }}>
        {quickActions.map(action => (
          <button
            key={action.screen}
            className="glass-card"
            onClick={() => onNavigate(action.screen)}
            style={{
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-sm)',
              minHeight: '90px',
            }}
          >
            <span style={{ fontSize: '24px' }}>{action.icon}</span>
            <strong>{action.label}</strong>
            <span className="text-sm text-secondary">{action.desc}</span>
          </button>
        ))}
      </div>

      {/* Project Management */}
      <div className="panel" style={{ maxWidth: '600px' }}>
        <div className="panel-header">
          <h3>{t('dashboard.projects')}</h3>
        </div>

        {/* Create */}
        <div className="flex gap-sm mb-md">
          <input
            value={newProjectName}
            onChange={e => setNewProjectName(e.target.value)}
            placeholder={t('dashboard.newProjectPlaceholder')}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            style={{ flex: 1 }}
          />
          <button className="btn-primary" onClick={handleCreate} disabled={creating || !newProjectName.trim()}>
            {t('dashboard.create')}
          </button>
        </div>

        {/* Project List */}
        {projects.length > 0 && (
          <div className="flex-col gap-xs mb-md">
            {projects.map(p => (
              <div
                key={p}
                className={`glass-card flex items-center justify-between ${p === activeProject ? 'active' : ''}`}
                style={{ padding: 'var(--space-sm) var(--space-md)', cursor: 'pointer' }}
                onClick={() => onActivateProject?.(p)}
              >
                <span>{p}</span>
                {p === activeProject && <span className="badge badge-accent">{t('dashboard.active')}</span>}
              </div>
            ))}
          </div>
        )}

        <hr className="divider" />

        {/* Export */}
        <div className="flex-col gap-sm mb-md">
          <label>{t('dashboard.exportLabel')}</label>
          <div className="flex gap-sm">
            <input
              value={exportPath}
              onChange={e => setExportPath(e.target.value)}
              placeholder={t('dashboard.exportPlaceholder')}
              style={{ flex: 1 }}
            />
            <button className="btn-sm" onClick={async () => {
              try {
                const result = await api.showSaveDialog({
                  title: t('dashboard.exportDialogTitle'),
                  filters: [{ name: 'Project Archive', extensions: ['examproj'] }],
                });
                if (!result.canceled && result.filePath) setExportPath(result.filePath);
              } catch {}
            }}>{t('common.browse')}</button>
            <button onClick={handleExport} disabled={!activeProject || exporting}>{exporting ? t('dashboard.exporting') : t('dashboard.export')}</button>
          </div>
        </div>

        {/* Import */}
        <div className="flex-col gap-sm">
          <label>{t('dashboard.importLabel')}</label>
          <div className="flex gap-sm">
            <input
              value={importPath}
              onChange={e => setImportPath(e.target.value)}
              placeholder={t('dashboard.archivePlaceholder')}
              style={{ flex: 1 }}
            />
            <button className="btn-sm" onClick={async () => {
              try {
                const result = await api.showOpenDialog({
                  title: t('dashboard.importDialogTitle'),
                  filters: [{ name: 'Project Archive', extensions: ['examproj', 'zip'] }],
                });
                if (!result.canceled && result.filePaths?.length) setImportPath(result.filePaths[0]);
              } catch {}
            }}>{t('common.browse')}</button>
            <input
              value={importName}
              onChange={e => setImportName(e.target.value)}
              placeholder={t('dashboard.projectNamePlaceholder')}
              style={{ flex: 1 }}
            />
            <button onClick={handleImport} disabled={importing}>{importing ? t('dashboard.importing') : t('dashboard.import')}</button>
          </div>
        </div>

        {status && (
          <p className="text-sm mt-md" style={{ color: status.includes('success') ? 'var(--text-success)' : 'var(--text-danger)' }}>
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
