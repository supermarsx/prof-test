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
      createProject: (name: string) => Promise<any>;
      listProjects: () => Promise<any>;
      saveMedia: (projectName: string, filename: string, base64: string) => Promise<any>;
      listMedia: (projectName: string) => Promise<any>;
      activateProject: (name: string) => Promise<any>;
      getActiveProject: () => Promise<any>;
    };
  }
}
