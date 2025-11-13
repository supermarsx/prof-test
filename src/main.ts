import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { QuestionRepository } from './repository/questionRepository';

let mainWindow: BrowserWindow | null = null;
const repo = new QuestionRepository();

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

