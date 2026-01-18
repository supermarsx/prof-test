import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('profTestAPI', {
  listQuestions: () => ipcRenderer.invoke('questions:list'),
  searchQuestions: (text: string) => ipcRenderer.invoke('questions:search', text),
  getQuestion: (id: string) => ipcRenderer.invoke('questions:get', id),
  addQuestion: (q: any) => ipcRenderer.invoke('questions:add', q),
  updateQuestion: (id: string, patch: any) => ipcRenderer.invoke('questions:update', id, patch),
  removeQuestion: (id: string) => ipcRenderer.invoke('questions:remove', id),
  exportQuestionsJson: (filePath: string) => ipcRenderer.invoke('questions:exportJson', filePath),
  importQuestionsJson: (filePath: string, mode: 'append' | 'replace') =>
    ipcRenderer.invoke('questions:importJson', filePath, mode),
  exportQuestionsYaml: (filePath: string) => ipcRenderer.invoke('questions:exportYaml', filePath),
  importQuestionsYaml: (filePath: string, mode: 'append' | 'replace') =>
    ipcRenderer.invoke('questions:importYaml', filePath, mode),
  exportQuestionMetadataCsv: (filePath: string) => ipcRenderer.invoke('questions:exportMetadataCsv', filePath),
  exportAnswerKeyCsv: (testId: string, versions: any[], filePath: string) =>
    ipcRenderer.invoke('exports:answerKeyCsv', testId, versions, filePath),
  exportGradingMatrixXlsx: (testId: string, versions: any[], filePath: string) =>
    ipcRenderer.invoke('exports:gradingMatrixXlsx', testId, versions, filePath),
  listExportProfiles: () => ipcRenderer.invoke('exportProfiles:list'),
  upsertExportProfile: (profile: any) => ipcRenderer.invoke('exportProfiles:upsert', profile),
  removeExportProfile: (id: string) => ipcRenderer.invoke('exportProfiles:remove', id),

  // project & media management
  createProject: (name: string) => ipcRenderer.invoke('project:create', name),
  listProjects: () => ipcRenderer.invoke('project:list'),
  saveMedia: (projectName: string, filename: string, base64: string) => ipcRenderer.invoke('project:saveMedia', projectName, filename, base64),
  listMedia: (projectName: string) => ipcRenderer.invoke('project:listMedia', projectName),
  activateProject: (name: string) => ipcRenderer.invoke('project:activate', name),
  getActiveProject: () => ipcRenderer.invoke('project:getActive'),
  exportProject: (name: string, outPath: string) => ipcRenderer.invoke('project:export', name, outPath),
  importProject: (archivePath: string, name: string) => ipcRenderer.invoke('project:import', archivePath, name),
});
