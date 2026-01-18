import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { QuestionRepository } from './repository/questionRepository';
import { ExportProfileRepository } from './repository/exportProfileRepository';
import { PresetRepository } from './repository/presetRepository';
import { buildAnswerKeyCsv, buildQuestionMetadataCsv } from './utils/exports';
import { buildGradingMatrixWorkbook } from './utils/exportsExcel';
import { clearAiCache } from './utils/aiCache';

let mainWindow: BrowserWindow | null = null;
const defaultDbPath = path.join(app.getAppPath(), 'data', 'questions.db');
let activeDbPath = defaultDbPath;
let repo = new QuestionRepository(activeDbPath);
let exportProfiles = new ExportProfileRepository(activeDbPath);
let presets = new PresetRepository(activeDbPath);


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In dev, when Next.js serves the renderer, load the dev server. Otherwise load built files.
  const devUrl = 'http://localhost:3000';
  if (process.env.ELECTRON_DEV) {
    mainWindow.loadURL(devUrl).catch((err) => console.error('Failed to load dev server', err));
  } else {
    const indexHtml = path.join(__dirname, 'renderer', 'index.html');
    mainWindow.loadFile(indexHtml).catch((err) => console.error('Failed to load index.html', err));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers for question repository
ipcMain.handle('questions:list', async () => {
  return repo.list();
});

ipcMain.handle('questions:search', async (_evt, text: string) => {
  return repo.search(String(text || ''));
});

ipcMain.handle('questions:get', async (_evt, id: string) => {
  return repo.get(id);
});

ipcMain.handle('questions:add', async (_evt, question) => {
  repo.add(question);
  return { ok: true };
});

ipcMain.handle('questions:update', async (_evt, id: string, patch) => {
  try {
    repo.update(id, patch);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('questions:remove', async (_evt, id: string) => {
  repo.remove(id);
  return { ok: true };
});

ipcMain.handle('questions:exportJson', async (_evt, filePath: string) => {
  try {
    const saved = repo.exportToJson(String(filePath));
    return { ok: true, path: saved };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('questions:importJson', async (_evt, filePath: string, mode: 'append' | 'replace') => {
  try {
    repo.importFromJson(String(filePath), mode);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('questions:exportYaml', async (_evt, filePath: string) => {
  try {
    const saved = repo.exportToYaml(String(filePath));
    return { ok: true, path: saved };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('questions:importYaml', async (_evt, filePath: string, mode: 'append' | 'replace') => {
  try {
    repo.importFromYaml(String(filePath), mode);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('questions:exportMetadataCsv', async (_evt, filePath: string) => {
  try {
    const csv = buildQuestionMetadataCsv(repo.list());
    fs.writeFileSync(String(filePath), csv, 'utf8');
    return { ok: true, path: String(filePath) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('exports:answerKeyCsv', async (_evt, testId: string, versions: any[], filePath: string) => {
  try {
    const csv = buildAnswerKeyCsv(String(testId), versions as any);
    fs.writeFileSync(String(filePath), csv, 'utf8');
    return { ok: true, path: String(filePath) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('exports:gradingMatrixXlsx', async (_evt, testId: string, versions: any[], filePath: string) => {
  try {
    const buf = buildGradingMatrixWorkbook(String(testId), versions as any);
    fs.writeFileSync(String(filePath), buf);
    return { ok: true, path: String(filePath) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('exportProfiles:list', async () => {
  try {
    return { ok: true, profiles: exportProfiles.list() };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('exportProfiles:upsert', async (_evt, profile: any) => {
  try {
    exportProfiles.upsert(profile);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('exportProfiles:remove', async (_evt, id: string) => {
  try {
    exportProfiles.remove(String(id));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('presets:header:list', async () => {
  try {
    return { ok: true, presets: presets.listHeaderPresets() };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('presets:header:upsert', async (_evt, preset: any) => {
  try {
    presets.upsertHeaderPreset(preset);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('presets:header:remove', async (_evt, id: string) => {
  try {
    presets.removeHeaderPreset(String(id));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('presets:layout:list', async () => {
  try {
    return { ok: true, presets: presets.listLayoutPresets() };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('presets:layout:upsert', async (_evt, preset: any) => {
  try {
    presets.upsertLayoutPreset(preset);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('presets:layout:remove', async (_evt, id: string) => {
  try {
    presets.removeLayoutPreset(String(id));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('cache:ai:clear', async () => {
  try {
    clearAiCache();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// Project & media IPC
import { ProjectManager } from './repository/projectManager';
const projectManager = new ProjectManager();
let activeProject: string | null = null;

ipcMain.handle('project:create', async (_evt, name: string) => {
  try {
    const layout = projectManager.createProject(String(name));
    return { ok: true, layout };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('project:list', async () => {
  try {
    return { ok: true, projects: projectManager.listProjects() };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('project:activate', async (_evt, name: string) => {
  try {
    const layout = projectManager.projectLayout(String(name));
    if (!layout) return { ok: false, error: 'Project not found' };
    activeProject = String(name);
    // re-initialize the repo to point to project's questions database
    const projectQuestionsPath = path.join(layout.dataDir, 'questions.db');
    activeDbPath = projectQuestionsPath;
    repo = new QuestionRepository(activeDbPath);
    exportProfiles = new ExportProfileRepository(activeDbPath);
    presets = new PresetRepository(activeDbPath);
    return { ok: true, active: name };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('project:getActive', async () => {
  return { ok: true, active: activeProject };
});

ipcMain.handle('project:saveMedia', async (_evt, projectName: string, filename: string, base64: string) => {
  try {
    const buf = Buffer.from(String(base64 || ''), 'base64');
    const saved = projectManager.saveMedia(projectName, filename, buf);
    return { ok: true, path: saved };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('project:listMedia', async (_evt, projectName: string) => {
  try {
    const files = projectManager.listMedia(projectName);
    return { ok: true, files };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('project:export', async (_evt, name: string, outPath: string) => {
  try {
    const saved = projectManager.exportProject(String(name), String(outPath));
    return { ok: true, path: saved };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('project:import', async (_evt, archivePath: string, name: string) => {
  try {
    const layout = projectManager.importProject(String(archivePath), String(name));
    return { ok: true, layout };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});
