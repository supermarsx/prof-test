import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('profTestAPI', {
  listQuestions: () => ipcRenderer.invoke('questions:list'),
  getQuestion: (id: string) => ipcRenderer.invoke('questions:get', id),
  addQuestion: (q: any) => ipcRenderer.invoke('questions:add', q),
  updateQuestion: (id: string, patch: any) => ipcRenderer.invoke('questions:update', id, patch),
  removeQuestion: (id: string) => ipcRenderer.invoke('questions:remove', id),
});
