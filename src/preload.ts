import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('profTestAPI', {
  listQuestions: () => ipcRenderer.invoke('questions:list'),
  searchQuestions: (text: string) => ipcRenderer.invoke('questions:search', text),
  getQuestion: (id: string) => ipcRenderer.invoke('questions:get', id),
  addQuestion: (q: any) => ipcRenderer.invoke('questions:add', q),
  updateQuestion: (id: string, patch: any) => ipcRenderer.invoke('questions:update', id, patch),
  removeQuestion: (id: string) => ipcRenderer.invoke('questions:remove', id),

  // project & media management
  createProject: (name: string) => ipcRenderer.invoke('project:create', name),
  listProjects: () => ipcRenderer.invoke('project:list'),
  saveMedia: (projectName: string, filename: string, base64: string) => ipcRenderer.invoke('project:saveMedia', projectName, filename, base64),
  listMedia: (projectName: string) => ipcRenderer.invoke('project:listMedia', projectName),
  activateProject: (name: string) => ipcRenderer.invoke('project:activate', name),
  getActiveProject: () => ipcRenderer.invoke('project:getActive'),
});

