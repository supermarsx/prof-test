'use client';

import { useState, useEffect, useCallback } from 'react';
import { t } from '../../i18n';
import { api } from '../../lib/api';

interface Props {
  refreshKey: number;
}

interface ExportProfile {
  id: string;
  name: string;
  format?: 'csv' | 'xlsx';
  includes?: string[];
  options?: Record<string, any>;
}

type ExportTab = 'answerKey' | 'gradingMatrix' | 'metadata' | 'questionJson' | 'questionYaml' | 'profiles';

export function ExportsScreen({ refreshKey }: Props) {
  const [tab, setTab] = useState<ExportTab>('answerKey');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Templates & instances for answer key / grading matrix
  const [templates, setTemplates] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);

  // Export paths
  const [answerKeyPath, setAnswerKeyPath] = useState('');
  const [gradingPath, setGradingPath] = useState('');
  const [metadataPath, setMetadataPath] = useState('');
  const [jsonPath, setJsonPath] = useState('');
  const [yamlPath, setYamlPath] = useState('');
  const [importPath, setImportPath] = useState('');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');

  // Export profiles
  const [profiles, setProfiles] = useState<ExportProfile[]>([]);
  const [editingProfile, setEditingProfile] = useState<ExportProfile | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileFormat, setNewProfileFormat] = useState<'csv' | 'xlsx'>('csv');

  const browseForSavePath = async (title: string, filters: { name: string; extensions: string[] }[]): Promise<string | null> => {
    try {
      const result = await api.showSaveDialog({ title, filters });
      if (!result.canceled && result.filePath) return result.filePath;
    } catch {}
    return null;
  };

  const browseForOpenPath = async (title: string, filters: { name: string; extensions: string[] }[]): Promise<string | null> => {
    try {
      const result = await api.showOpenDialog({ title, filters });
      if (!result.canceled && result.filePaths?.length) return result.filePaths[0];
    } catch {}
    return null;
  };

  const loadData = useCallback(async () => {
    try {
      const [tRes, pRes] = await Promise.all([
        api.listTestTemplates(),
        api.listExportProfiles(),
      ]);
      if (tRes?.templates && Array.isArray(tRes.templates)) setTemplates(tRes.templates);
      if (pRes?.profiles && Array.isArray(pRes.profiles)) setProfiles(pRes.profiles);
    } catch {}
  }, []);

  const loadInstances = useCallback(async (templateId: string) => {
    if (!templateId) { setInstances([]); return; }
    try {
      const res = await api.listTestInstances(templateId);
      if (res?.instances && Array.isArray(res.instances)) setInstances(res.instances);
      else if (Array.isArray(res)) setInstances(res);
    } catch {}
  }, []);

  const STORAGE_KEY = 'proftest_export_settings';

  // Restore last export settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.tab) setTab(data.tab);
        if (data.selectedTemplateId) setSelectedTemplateId(data.selectedTemplateId);
        if (data.importMode) setImportMode(data.importMode);
        if (data.answerKeyPath) setAnswerKeyPath(data.answerKeyPath);
        if (data.gradingPath) setGradingPath(data.gradingPath);
        if (data.metadataPath) setMetadataPath(data.metadataPath);
        if (data.jsonPath) setJsonPath(data.jsonPath);
        if (data.yamlPath) setYamlPath(data.yamlPath);
        if (data.newProfileFormat) setNewProfileFormat(data.newProfileFormat);
      }
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist export settings to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        tab,
        selectedTemplateId,
        importMode,
        answerKeyPath,
        gradingPath,
        metadataPath,
        jsonPath,
        yamlPath,
        newProfileFormat,
      }));
    } catch {}
  }, [tab, selectedTemplateId, importMode, answerKeyPath, gradingPath, metadataPath, jsonPath, yamlPath, newProfileFormat]);

  useEffect(() => {
    loadData();
  }, [refreshKey, loadData]);

  useEffect(() => {
    loadInstances(selectedTemplateId);
  }, [selectedTemplateId, loadInstances]);

  const handleExportAnswerKey = async () => {
    if (!selectedTemplateId || selectedInstanceIds.length === 0 || !answerKeyPath.trim()) {
      setStatus(t('exports.selectTemplateVersionPath'));
      return;
    }
    setLoading(true);
    try {
      const versions = instances.filter(i => selectedInstanceIds.includes(i.id));
      const res = await api.exportAnswerKeyCsv(selectedTemplateId, versions, answerKeyPath.trim());
      setStatus(res?.ok ? t('exports.answerKeySuccess') : (res?.error || t('exports.exportFailed')));
    } catch (e) { setStatus(String(e)); }
    setLoading(false);
  };

  const handleExportGradingMatrix = async () => {
    if (!selectedTemplateId || selectedInstanceIds.length === 0 || !gradingPath.trim()) {
      setStatus(t('exports.selectTemplateVersionPath'));
      return;
    }
    setLoading(true);
    try {
      const versions = instances.filter(i => selectedInstanceIds.includes(i.id));
      const res = await api.exportGradingMatrixXlsx(selectedTemplateId, versions, gradingPath.trim());
      setStatus(res?.ok ? t('exports.gradingMatrixSuccess') : (res?.error || t('exports.exportFailed')));
    } catch (e) { setStatus(String(e)); }
    setLoading(false);
  };

  const handleExportMetadata = async () => {
    if (!metadataPath.trim()) { setStatus(t('exports.enterOutputPath')); return; }
    setLoading(true);
    try {
      const res = await api.exportQuestionMetadataCsv(metadataPath.trim());
      setStatus(res?.ok ? t('exports.metadataSuccess') : (res?.error || t('exports.exportFailed')));
    } catch (e) { setStatus(String(e)); }
    setLoading(false);
  };

  const handleExportJson = async () => {
    if (!jsonPath.trim()) { setStatus(t('exports.enterOutputPath')); return; }
    setLoading(true);
    try {
      const res = await api.exportQuestionsJson(jsonPath.trim());
      setStatus(res?.ok ? t('exports.jsonExportedCount', { count: res.count ?? 0 }) : (res?.error || t('exports.exportFailed')));
    } catch (e) { setStatus(String(e)); }
    setLoading(false);
  };

  const handleImportJson = async () => {
    if (!importPath.trim()) { setStatus(t('exports.enterImportPath')); return; }
    setLoading(true);
    try {
      const res = await api.importQuestionsJson(importPath.trim(), importMode);
      setStatus(res?.ok ? t('exports.importedCount', { count: res.count ?? 0, mode: importMode }) : (res?.error || t('exports.importFailed')));
    } catch (e) { setStatus(String(e)); }
    setLoading(false);
  };

  const handleExportYaml = async () => {
    if (!yamlPath.trim()) { setStatus(t('exports.enterOutputPath')); return; }
    setLoading(true);
    try {
      const res = await api.exportQuestionsYaml(yamlPath.trim());
      setStatus(res?.ok ? t('exports.yamlExportedCount', { count: res.count ?? 0 }) : (res?.error || t('exports.exportFailed')));
    } catch (e) { setStatus(String(e)); }
    setLoading(false);
  };

  const handleImportYaml = async () => {
    if (!importPath.trim()) { setStatus(t('exports.enterImportPath')); return; }
    setLoading(true);
    try {
      const res = await api.importQuestionsYaml(importPath.trim(), importMode);
      setStatus(res?.ok ? t('exports.importedCount', { count: res.count ?? 0, mode: importMode }) : (res?.error || t('exports.importFailed')));
    } catch (e) { setStatus(String(e)); }
    setLoading(false);
  };

  const toggleInstanceId = (id: string) => {
    setSelectedInstanceIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const createProfile = async () => {
    if (!newProfileName.trim()) return;
    const profile: ExportProfile = {
      id: `prof-${Date.now()}`,
      name: newProfileName.trim(),
      format: newProfileFormat,
      includes: [],
      options: {},
    };
    try {
      await api.upsertExportProfile(profile);
      setNewProfileName('');
      await loadData();
      setStatus(t('exports.profileCreated'));
    } catch (e) { setStatus(String(e)); }
  };

  const removeProfile = async (id: string) => {
    try {
      await api.removeExportProfile(id);
      await loadData();
      setStatus(t('exports.profileRemoved'));
    } catch (e) { setStatus(String(e)); }
  };

  const tabs: { id: ExportTab; label: string }[] = [
    { id: 'answerKey', label: t('exports.answerKeyCsv') },
    { id: 'gradingMatrix', label: t('exports.gradingMatrix') },
    { id: 'metadata', label: t('exports.metadataCsv') },
    { id: 'questionJson', label: t('exports.jsonExport') },
    { id: 'questionYaml', label: t('exports.yamlExport') },
    { id: 'profiles', label: t('exports.profiles') },
  ];

  const templateSelector = (
    <div className="flex-col gap-sm mb-md">
      <div>
        <label>{t('exports.testTemplate')}</label>
        <select value={selectedTemplateId} onChange={e => {
          setSelectedTemplateId(e.target.value);
          setSelectedInstanceIds([]);
        }}>
          <option value="">{t('exports.selectTemplate')}</option>
          {templates.map(t => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      </div>
      {instances.length > 0 && (
        <div>
          <label>{t('exports.versions')}</label>
          <div className="flex-col gap-xs" style={{ maxHeight: '200px', overflow: 'auto' }}>
            {instances.map(inst => (
              <label key={inst.id} className="flex items-center gap-sm text-sm" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedInstanceIds.includes(inst.id)}
                  onChange={() => toggleInstanceId(inst.id)}
                />
                {t('exports.version', { label: inst.version_label || inst.id })}
                {inst.generated_questions && (
                  <span className="text-tertiary">({inst.generated_questions.length} Q)</span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="fade-in flex-col gap-md" style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Tabs */}
      <div className="flex gap-sm flex-wrap" role="tablist" aria-label="Export types">
        {tabs.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`btn-sm ${tab === t.id ? 'btn-primary' : ''}`}
            onClick={() => { setTab(t.id); setStatus(null); }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {status && (
        <div className="text-sm" style={{
          color: status.includes('success') || status.includes('exported') || status.includes('Imported') || status.includes('created')
            ? 'var(--text-success)'
            : status.includes('fail') || status.includes('error')
              ? 'var(--text-danger)'
              : 'var(--text-accent)',
        }}>
          {status}
        </div>
      )}

      <div className="panel" style={{ flex: 1, overflow: 'auto', maxWidth: '700px' }}>
        {/* Answer Key CSV */}
        {tab === 'answerKey' && (
          <div className="flex-col gap-sm">
            <h4>{t('exports.exportAnswerKeyHeading')}</h4>
            <p className="text-sm text-secondary">
              {t('exports.answerKeyDesc')}
            </p>
            {templateSelector}
            <div>
              <label>{t('exports.outputPath')}</label>
              <div className="flex gap-sm">
                <input value={answerKeyPath} onChange={e => setAnswerKeyPath(e.target.value)}
                  placeholder="answer-key.csv" style={{ flex: 1 }} />
                <button className="btn-sm" onClick={async () => {
                  const p = await browseForSavePath(t('exports.saveAnswerKeyCsv'), [{ name: 'CSV', extensions: ['csv'] }]);
                  if (p) setAnswerKeyPath(p);
                }}>{t('common.browse')}</button>
              </div>
            </div>
            <button className="btn-primary" onClick={handleExportAnswerKey}
              disabled={loading || !selectedTemplateId || selectedInstanceIds.length === 0}>
              {loading ? t('exports.exporting') : t('exports.exportAnswerKey')}
            </button>
          </div>
        )}

        {/* Grading Matrix */}
        {tab === 'gradingMatrix' && (
          <div className="flex-col gap-sm">
            <h4>{t('exports.gradingMatrixHeading')}</h4>
            <p className="text-sm text-secondary">
              {t('exports.gradingMatrixDesc')}
            </p>
            {templateSelector}
            <div>
              <label>{t('exports.outputPath')}</label>
              <div className="flex gap-sm">
                <input value={gradingPath} onChange={e => setGradingPath(e.target.value)}
                  placeholder="grading-matrix.xlsx" style={{ flex: 1 }} />
                <button className="btn-sm" onClick={async () => {
                  const p = await browseForSavePath(t('exports.saveGradingMatrix'), [{ name: 'Excel', extensions: ['xlsx'] }]);
                  if (p) setGradingPath(p);
                }}>{t('common.browse')}</button>
              </div>
            </div>
            <button className="btn-primary" onClick={handleExportGradingMatrix}
              disabled={loading || !selectedTemplateId || selectedInstanceIds.length === 0}>
              {loading ? t('exports.exporting') : t('exports.exportGradingMatrix')}
            </button>
          </div>
        )}

        {/* Metadata CSV */}
        {tab === 'metadata' && (
          <div className="flex-col gap-sm">
            <h4>{t('exports.metadataHeading')}</h4>
            <p className="text-sm text-secondary">
              {t('exports.metadataDesc')}
            </p>
            <div>
              <label>{t('exports.outputPath')}</label>
              <div className="flex gap-sm">
                <input value={metadataPath} onChange={e => setMetadataPath(e.target.value)}
                  placeholder="metadata.csv" style={{ flex: 1 }} />
                <button className="btn-sm" onClick={async () => {
                  const p = await browseForSavePath(t('exports.saveMetadataCsv'), [{ name: 'CSV', extensions: ['csv'] }]);
                  if (p) setMetadataPath(p);
                }}>{t('common.browse')}</button>
              </div>
            </div>
            <button className="btn-primary" onClick={handleExportMetadata} disabled={loading}>
              {loading ? t('exports.exporting') : t('exports.exportMetadata')}
            </button>
          </div>
        )}

        {/* JSON Export/Import */}
        {tab === 'questionJson' && (
          <div className="flex-col gap-md">
            <div className="flex-col gap-sm">
              <h4>{t('exports.exportJsonHeading')}</h4>
              <div>
                <label>{t('exports.outputPath')}</label>
                <div className="flex gap-sm">
                  <input value={jsonPath} onChange={e => setJsonPath(e.target.value)}
                    placeholder="questions.json" style={{ flex: 1 }} />
                  <button className="btn-sm" onClick={async () => {
                    const p = await browseForSavePath(t('exports.exportJson'), [{ name: 'JSON', extensions: ['json'] }]);
                    if (p) setJsonPath(p);
                  }}>{t('common.browse')}</button>
                </div>
              </div>
              <button className="btn-primary" onClick={handleExportJson} disabled={loading}>
                {loading ? t('exports.exporting') : t('exports.exportJson')}
              </button>
            </div>
            <hr className="divider" />
            <div className="flex-col gap-sm">
              <h4>{t('exports.importJsonHeading')}</h4>
              <div>
                <label>{t('exports.importPath')}</label>
                <div className="flex gap-sm">
                  <input value={importPath} onChange={e => setImportPath(e.target.value)}
                    placeholder="questions.json" style={{ flex: 1 }} />
                  <button className="btn-sm" onClick={async () => {
                    const p = await browseForOpenPath(t('exports.importJson'), [{ name: 'JSON', extensions: ['json'] }]);
                    if (p) setImportPath(p);
                  }}>{t('common.browse')}</button>
                </div>
              </div>
              <div>
                <label>{t('exports.importMode')}</label>
                <select value={importMode} onChange={e => setImportMode(e.target.value as any)}>
                  <option value="append">{t('exports.appendMode')}</option>
                  <option value="replace">{t('exports.replaceMode')}</option>
                </select>
              </div>
              <button className="btn-primary" onClick={handleImportJson} disabled={loading}>
                {loading ? t('exports.importing') : t('exports.importJson')}
              </button>
            </div>
          </div>
        )}

        {/* YAML Export/Import */}
        {tab === 'questionYaml' && (
          <div className="flex-col gap-md">
            <div className="flex-col gap-sm">
              <h4>{t('exports.exportYamlHeading')}</h4>
              <div>
                <label>{t('exports.outputPath')}</label>
                <div className="flex gap-sm">
                  <input value={yamlPath} onChange={e => setYamlPath(e.target.value)}
                    placeholder="questions.yaml" style={{ flex: 1 }} />
                  <button className="btn-sm" onClick={async () => {
                    const p = await browseForSavePath(t('exports.exportYaml'), [{ name: 'YAML', extensions: ['yaml', 'yml'] }]);
                    if (p) setYamlPath(p);
                  }}>{t('common.browse')}</button>
                </div>
              </div>
              <button className="btn-primary" onClick={handleExportYaml} disabled={loading}>
                {loading ? t('exports.exporting') : t('exports.exportYaml')}
              </button>
            </div>
            <hr className="divider" />
            <div className="flex-col gap-sm">
              <h4>{t('exports.importYamlHeading')}</h4>
              <div>
                <label>{t('exports.importPath')}</label>
                <div className="flex gap-sm">
                  <input value={importPath} onChange={e => setImportPath(e.target.value)}
                    placeholder="questions.yaml" style={{ flex: 1 }} />
                  <button className="btn-sm" onClick={async () => {
                    const p = await browseForOpenPath(t('exports.importYaml'), [{ name: 'YAML', extensions: ['yaml', 'yml'] }]);
                    if (p) setImportPath(p);
                  }}>{t('common.browse')}</button>
                </div>
              </div>
              <div>
                <label>{t('exports.importMode')}</label>
                <select value={importMode} onChange={e => setImportMode(e.target.value as any)}>
                  <option value="append">{t('exports.appendMode')}</option>
                  <option value="replace">{t('exports.replaceMode')}</option>
                </select>
              </div>
              <button className="btn-primary" onClick={handleImportYaml} disabled={loading}>
                {loading ? t('exports.importing') : t('exports.importYaml')}
              </button>
            </div>
          </div>
        )}

        {/* Export Profiles */}
        {tab === 'profiles' && (
          <div className="flex-col gap-sm">
            <h4>{t('exports.profilesHeading')}</h4>
            <p className="text-sm text-secondary">
              {t('exports.profilesDesc')}
            </p>

            {/* Create profile */}
            <div className="flex gap-sm">
              <input value={newProfileName} onChange={e => setNewProfileName(e.target.value)}
                placeholder={t('exports.profileName')} style={{ flex: 1 }}
                onKeyDown={e => e.key === 'Enter' && createProfile()} />
              <select value={newProfileFormat} onChange={e => setNewProfileFormat(e.target.value as any)}
                style={{ width: 'auto' }}>
                <option value="csv">CSV</option>
                <option value="xlsx">XLSX</option>
              </select>
              <button className="btn-primary" onClick={createProfile} disabled={!newProfileName.trim()}>
                {t('exports.create')}
              </button>
            </div>

            {/* Profile list */}
            {profiles.length === 0 && (
              <p className="text-sm text-tertiary">{t('exports.noProfiles')}</p>
            )}
            {profiles.map(p => (
              <div key={p.id} className="glass-card flex items-center justify-between"
                style={{ padding: 'var(--space-sm) var(--space-md)' }}>
                <div>
                  <strong>{p.name}</strong>
                  <span className="badge ml-sm">{p.format || 'csv'}</span>
                </div>
                <div className="flex gap-xs">
                  <button className="btn-ghost btn-sm btn-danger" onClick={() => removeProfile(p.id)}>
                    {t('exports.remove')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
