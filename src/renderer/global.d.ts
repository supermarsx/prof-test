export {};

declare global {
  interface Window {
    profTestAPI: {
      listQuestions: () => Promise<any[]>;
      searchQuestions: (text: string) => Promise<any[]>;
      getQuestion: (id: string) => Promise<any>;
      addQuestion: (q: any) => Promise<any>;
      updateQuestion: (id: string, patch: any) => Promise<any>;
      removeQuestion: (id: string) => Promise<any>;
      exportQuestionsJson: (filePath: string) => Promise<any>;
      importQuestionsJson: (filePath: string, mode: 'append' | 'replace') => Promise<any>;
      exportQuestionsYaml: (filePath: string) => Promise<any>;
      importQuestionsYaml: (filePath: string, mode: 'append' | 'replace') => Promise<any>;
      exportQuestionMetadataCsv: (filePath: string) => Promise<any>;
      exportAnswerKeyCsv: (testId: string, versions: any[], filePath: string) => Promise<any>;
      exportGradingMatrixXlsx: (testId: string, versions: any[], filePath: string) => Promise<any>;
      listExportProfiles: () => Promise<any>;
      upsertExportProfile: (profile: any) => Promise<any>;
      removeExportProfile: (id: string) => Promise<any>;
      createProject: (name: string) => Promise<any>;
      listProjects: () => Promise<any>;
      saveMedia: (projectName: string, filename: string, base64: string) => Promise<any>;
      listMedia: (projectName: string) => Promise<any>;
      activateProject: (name: string) => Promise<any>;
      getActiveProject: () => Promise<any>;
      exportProject: (name: string, outPath: string) => Promise<any>;
      importProject: (archivePath: string, name: string) => Promise<any>;
    };
  }
}
