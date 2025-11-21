import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { QuestionRepository } from './repository/questionRepository';

let mainWindow: BrowserWindow | null = null;
let repo = new QuestionRepository();


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

  // In dev, when Vite serves the renderer, load the dev server. Otherwise load built files.
  const devUrl = 'http://localhost:5173';
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
    // re-initialize the repo to point to project's questions file
    const projectQuestionsPath = require('path').join(layout.dataDir, 'questions.json');
    // create a new repo instance that uses that file path
    // Note: to keep things simple we create a new repo and replace the global
    // repo variable so existing IPC handlers operate on the active project
    // (This relies on module-scoped `repo` being mutable)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { QuestionRepository } = require('./repository/questionRepository');
    (global as any).repo = new QuestionRepository(projectQuestionsPath);
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

