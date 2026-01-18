'use client';

import { useEffect, useState } from 'react';
import { QuestionList } from '../components/QuestionList';
import { QuestionEditor } from '../components/QuestionEditor';

export default function HomePage() {
  const [selected, setSelected] = useState<any | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [projects, setProjects] = useState<string[]>([]);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [newProject, setNewProject] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [metadataPath, setMetadataPath] = useState('');
  const [answerKeyPath, setAnswerKeyPath] = useState('');
  const [matrixPath, setMatrixPath] = useState('');
  const [exportTestId, setExportTestId] = useState('test-1');
  const [versionsJson, setVersionsJson] = useState('[]');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [profileName, setProfileName] = useState('');
  const [profileFormat, setProfileFormat] = useState<'csv' | 'xlsx'>('csv');
  const [profileIncludes, setProfileIncludes] = useState('answer_keys');
  const [projectExportPath, setProjectExportPath] = useState('');
  const [projectImportPath, setProjectImportPath] = useState('');
  const [projectImportName, setProjectImportName] = useState('');

  const refreshProjects = async () => {
    const listRes = await window.profTestAPI.listProjects();
    if (listRes && listRes.projects) {
      setProjects(listRes.projects);
    }
    const activeRes = await window.profTestAPI.getActiveProject();
    if (activeRes && activeRes.active) {
      setActiveProject(activeRes.active);
    } else {
      setActiveProject(null);
    }
  };

  const refreshProfiles = async () => {
    const res = await window.profTestAPI.listExportProfiles();
    if (res && res.profiles) setProfiles(res.profiles);
  };

  useEffect(() => {
    refreshProjects();
    refreshProfiles();
  }, []);

  const createProject = async () => {
    setStatus(null);
    if (!newProject.trim()) {
      setStatus('Project name is required');
      return;
    }
    const res = await window.profTestAPI.createProject(newProject.trim());
    if (!res.ok) {
      setStatus(res.error || 'Failed to create project');
      return;
    }
    setNewProject('');
    await refreshProjects();
  };

  const exportProject = async () => {
    setStatus(null);
    if (!activeProject) {
      setStatus('Select a project to export');
      return;
    }
    if (!projectExportPath.trim()) {
      setStatus('Export path is required');
      return;
    }
    const res = await window.profTestAPI.exportProject(activeProject, projectExportPath.trim());
    if (!res.ok) setStatus(res.error || 'Failed to export project');
  };

  const importProject = async () => {
    setStatus(null);
    if (!projectImportPath.trim() || !projectImportName.trim()) {
      setStatus('Import path and project name are required');
      return;
    }
    const res = await window.profTestAPI.importProject(projectImportPath.trim(), projectImportName.trim());
    if (!res.ok) {
      setStatus(res.error || 'Failed to import project');
      return;
    }
    setProjectImportPath('');
    setProjectImportName('');
    await refreshProjects();
  };

  const activateProject = async (name: string) => {
    setStatus(null);
    const res = await window.profTestAPI.activateProject(name);
    if (!res.ok) {
      setStatus(res.error || 'Failed to activate project');
      return;
    }
    setActiveProject(name);
    setRefreshKey((k) => k + 1);
  };

  const exportMetadata = async () => {
    setStatus(null);
    if (!metadataPath.trim()) {
      setStatus('Metadata export path is required');
      return;
    }
    const res = await window.profTestAPI.exportQuestionMetadataCsv(metadataPath.trim());
    if (!res.ok) setStatus(res.error || 'Failed to export metadata CSV');
  };

  const exportAnswerKey = async () => {
    setStatus(null);
    if (!answerKeyPath.trim()) {
      setStatus('Answer key export path is required');
      return;
    }
    let parsed: any[] = [];
    try {
      parsed = JSON.parse(versionsJson || '[]');
    } catch (e) {
      setStatus('Versions JSON is invalid');
      return;
    }
    const res = await window.profTestAPI.exportAnswerKeyCsv(exportTestId, parsed, answerKeyPath.trim());
    if (!res.ok) setStatus(res.error || 'Failed to export answer key CSV');
  };

  const exportMatrix = async () => {
    setStatus(null);
    if (!matrixPath.trim()) {
      setStatus('Grading matrix export path is required');
      return;
    }
    let parsed: any[] = [];
    try {
      parsed = JSON.parse(versionsJson || '[]');
    } catch (e) {
      setStatus('Versions JSON is invalid');
      return;
    }
    const res = await window.profTestAPI.exportGradingMatrixXlsx(exportTestId, parsed, matrixPath.trim());
    if (!res.ok) setStatus(res.error || 'Failed to export grading matrix');
  };

  const saveProfile = async () => {
    setStatus(null);
    if (!profileName.trim()) {
      setStatus('Profile name is required');
      return;
    }
    const profile = {
      id: `profile-${profileName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: profileName.trim(),
      format: profileFormat,
      includes: profileIncludes.split(',').map((v) => v.trim()).filter((v) => v.length > 0),
    };
    const res = await window.profTestAPI.upsertExportProfile(profile);
    if (!res.ok) {
      setStatus(res.error || 'Failed to save profile');
      return;
    }
    setProfileName('');
    await refreshProfiles();
  };

  const deleteProfile = async (id: string) => {
    const res = await window.profTestAPI.removeExportProfile(id);
    if (!res.ok) setStatus(res.error || 'Failed to delete profile');
    await refreshProfiles();
  };

  return (
    <main style={{ display: 'flex', flexDirection: 'column', padding: 20, gap: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <strong>Project</strong>
        <select
          value={activeProject || ''}
          onChange={(e) => activateProject(e.target.value)}
        >
          <option value="">Select project</option>
          {projects.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <input
          value={newProject}
          onChange={(e) => setNewProject(e.target.value)}
          placeholder="New project name"
        />
        <button onClick={createProject}>Create</button>
        <input
          value={projectExportPath}
          onChange={(e) => setProjectExportPath(e.target.value)}
          placeholder="Export .examproj path"
        />
        <button onClick={exportProject}>Export</button>
        <input
          value={projectImportPath}
          onChange={(e) => setProjectImportPath(e.target.value)}
          placeholder="Import .examproj path"
        />
        <input
          value={projectImportName}
          onChange={(e) => setProjectImportName(e.target.value)}
          placeholder="Imported project name"
        />
        <button onClick={importProject}>Import</button>
        <button onClick={refreshProjects}>Refresh</button>
        {status && <span style={{ color: 'red' }}>{status}</span>}
      </header>
      <div style={{ display: 'flex', gap: 16 }}>
        <QuestionList onSelect={(q) => setSelected(q)} key={refreshKey} />
        <QuestionEditor question={selected} onSaved={() => setRefreshKey((k) => k + 1)} />
      </div>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h3>Exports</h3>
        <div>
          <label>Question Metadata CSV Path</label>
          <input
            value={metadataPath}
            onChange={(e) => setMetadataPath(e.target.value)}
            placeholder="C:\\path\\question-metadata.csv"
          />
          <button onClick={exportMetadata}>Export Metadata CSV</button>
        </div>
        <div>
          <label>Test ID</label>
          <input value={exportTestId} onChange={(e) => setExportTestId(e.target.value)} />
        </div>
        <div>
          <label>Versions JSON</label>
          <textarea
            value={versionsJson}
            onChange={(e) => setVersionsJson(e.target.value)}
            placeholder="[]"
            rows={4}
          />
        </div>
        <div>
          <label>Answer Key CSV Path</label>
          <input
            value={answerKeyPath}
            onChange={(e) => setAnswerKeyPath(e.target.value)}
            placeholder="C:\\path\\answer-key.csv"
          />
          <button onClick={exportAnswerKey}>Export Answer Key CSV</button>
        </div>
        <div>
          <label>Grading Matrix XLSX Path</label>
          <input
            value={matrixPath}
            onChange={(e) => setMatrixPath(e.target.value)}
            placeholder="C:\\path\\grading-matrix.xlsx"
          />
          <button onClick={exportMatrix}>Export Grading Matrix</button>
        </div>
        <div>
          <h4>Export Profiles</h4>
          <input
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="Profile name"
          />
          <select value={profileFormat} onChange={(e) => setProfileFormat(e.target.value as any)}>
            <option value="csv">CSV</option>
            <option value="xlsx">XLSX</option>
          </select>
          <input
            value={profileIncludes}
            onChange={(e) => setProfileIncludes(e.target.value)}
            placeholder="includes (comma-separated)"
          />
          <button onClick={saveProfile}>Save Profile</button>
          <ul>
            {profiles.map((p) => (
              <li key={p.id}>
                {p.name} ({p.format})
                <button onClick={() => deleteProfile(p.id)}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
