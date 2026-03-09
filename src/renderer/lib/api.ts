/**
 * ProfTest API Layer
 * 
 * Typed wrapper that replaces the Electron preload bridge (window.profTestAPI).
 * Uses Tauri's invoke() to call Rust commands, which proxy to the Node.js backend.
 * 
 * Falls back to direct HTTP calls in development / browser-only mode.
 */

import type {
  Question,
  TestTemplate,
  TestInstance,
  QuestionInstance,
  HeaderPreset,
  LayoutPreset,
  ExportProfile,
  Settings,
  SectionDefinition,
  VersionChangeLog,
  QuestionType,
} from '../../models';

// ─── Tauri invoke wrapper ────────────────────────────────────

let _invoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;
let _openDialog: ((options?: DialogOpenOptions) => Promise<DialogOpenResult>) | null = null;
let _saveDialog: ((options?: DialogSaveOptions) => Promise<DialogSaveResult>) | null = null;

interface DialogOpenOptions {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
  multiple?: boolean;
  directory?: boolean;
}

interface DialogOpenResult {
  canceled: boolean;
  filePaths: string[];
}

interface DialogSaveOptions {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

interface DialogSaveResult {
  canceled: boolean;
  filePath?: string;
}

/**
 * Initialize the Tauri API bindings.
 * Must be called once at app startup.
 * Falls back to HTTP mode if Tauri is not available.
 */
export async function initAPI(): Promise<void> {
  try {
    // Dynamic import to avoid bundler errors when Tauri is not available
    const tauriCore = await import('@tauri-apps/api/core');
    _invoke = tauriCore.invoke;

    try {
      const tauriDialog = await import('@tauri-apps/plugin-dialog');
      _openDialog = async (options) => {
        const result = await tauriDialog.open({
          title: options?.title,
          defaultPath: options?.defaultPath,
          filters: options?.filters,
          multiple: options?.multiple,
          directory: options?.directory,
        });
        if (result === null) return { canceled: true, filePaths: [] };
        if (typeof result === 'string') return { canceled: false, filePaths: [result] };
        return { canceled: false, filePaths: result as string[] };
      };
      _saveDialog = async (options) => {
        const result = await tauriDialog.save({
          title: options?.title,
          defaultPath: options?.defaultPath,
          filters: options?.filters,
        });
        if (result === null) return { canceled: true };
        return { canceled: false, filePath: result as string };
      };
    } catch {
      console.warn('Tauri dialog plugin not available, using fallback');
    }
  } catch {
    console.warn('Tauri API not available, using HTTP fallback');
  }
}

/**
 * Call a Tauri command. Falls back to direct HTTP if Tauri is not available.
 */
async function invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (_invoke) {
    return _invoke(cmd, args) as Promise<T>;
  }
  // HTTP fallback: map command names to REST endpoints
  return httpFallback<T>(cmd, args || {});
}

// ─── HTTP Fallback (for dev without Tauri) ───────────────────

let _backendPort = 0;

export function setBackendPort(port: number) {
  _backendPort = port;
}

function backendUrl(): string {
  return `http://127.0.0.1:${_backendPort || 3001}`;
}

const CMD_MAP: Record<string, { method: string; path: string | ((args: Record<string, unknown>) => string) }> = {
  list_questions: { method: 'GET', path: '/api/questions' },
  search_questions: { method: 'POST', path: '/api/questions/search' },
  get_question: { method: 'GET', path: (a) => `/api/questions/${a.id}` },
  add_question: { method: 'POST', path: '/api/questions' },
  update_question: { method: 'POST', path: (a) => `/api/questions/${a.id}/update` },
  remove_question: { method: 'DELETE', path: (a) => `/api/questions/${a.id}` },
  increment_question_usage: { method: 'POST', path: (a) => `/api/questions/${a.id}/increment-usage` },
  export_questions_json: { method: 'POST', path: '/api/questions/export/json' },
  import_questions_json: { method: 'POST', path: '/api/questions/import/json' },
  export_questions_yaml: { method: 'POST', path: '/api/questions/export/yaml' },
  import_questions_yaml: { method: 'POST', path: '/api/questions/import/yaml' },
  export_question_metadata_csv: { method: 'POST', path: '/api/questions/export/metadata-csv' },
  export_answer_key_csv: { method: 'POST', path: '/api/exports/answer-key-csv' },
  export_grading_matrix_xlsx: { method: 'POST', path: '/api/exports/grading-matrix-xlsx' },
  export_response_template: { method: 'POST', path: '/api/exports/response-template' },
  export_mixed_grading_xlsx: { method: 'POST', path: '/api/exports/mixed-grading-xlsx' },
  list_export_profiles: { method: 'GET', path: '/api/export-profiles' },
  upsert_export_profile: { method: 'POST', path: '/api/export-profiles' },
  remove_export_profile: { method: 'DELETE', path: (a) => `/api/export-profiles/${a.id}` },
  list_header_presets: { method: 'GET', path: '/api/presets/header' },
  upsert_header_preset: { method: 'POST', path: '/api/presets/header' },
  remove_header_preset: { method: 'DELETE', path: (a) => `/api/presets/header/${a.id}` },
  list_layout_presets: { method: 'GET', path: '/api/presets/layout' },
  upsert_layout_preset: { method: 'POST', path: '/api/presets/layout' },
  remove_layout_preset: { method: 'DELETE', path: (a) => `/api/presets/layout/${a.id}` },
  create_project: { method: 'POST', path: '/api/projects' },
  list_projects: { method: 'GET', path: '/api/projects' },
  activate_project: { method: 'POST', path: '/api/projects/activate' },
  get_active_project: { method: 'GET', path: '/api/projects/active' },
  save_media: { method: 'POST', path: '/api/projects/media' },
  list_media: { method: 'GET', path: (a) => `/api/projects/${a.project_name}/media` },
  export_project: { method: 'POST', path: '/api/projects/export' },
  import_project: { method: 'POST', path: '/api/projects/import' },
  list_test_templates: { method: 'GET', path: '/api/test-templates' },
  get_test_template: { method: 'GET', path: (a) => `/api/test-templates/${a.id}` },
  upsert_test_template: { method: 'POST', path: '/api/test-templates' },
  remove_test_template: { method: 'DELETE', path: (a) => `/api/test-templates/${a.id}` },
  list_test_instances: { method: 'GET', path: (a) => a.template_id ? `/api/test-instances?templateId=${a.template_id}` : '/api/test-instances' },
  get_test_instance: { method: 'GET', path: (a) => `/api/test-instances/${a.id}` },
  upsert_test_instance: { method: 'POST', path: '/api/test-instances' },
  remove_test_instance: { method: 'DELETE', path: (a) => `/api/test-instances/${a.id}` },
  get_settings: { method: 'GET', path: '/api/settings' },
  save_settings: { method: 'POST', path: '/api/settings' },
  is_encryption_available: { method: 'GET', path: '/api/settings/encryption-available' },
  compile_latex: { method: 'POST', path: '/api/latex/compile' },
  compile_latex_batch: { method: 'POST', path: '/api/latex/compile-batch' },
  get_compile_batch_status: { method: 'GET', path: (args) => `/api/latex/compile-batch/${args.job_id}` },
  detect_latex: { method: 'GET', path: '/api/latex/detect' },
  render_test_latex: { method: 'POST', path: '/api/latex/render-test' },
  render_answer_key_latex: { method: 'POST', path: '/api/latex/render-answer-key' },
  configure_ai: { method: 'POST', path: '/api/ai/configure' },
  ai_generate_questions: { method: 'POST', path: '/api/ai/generate-questions' },
  ai_generate_distractors: { method: 'POST', path: '/api/ai/generate-distractors' },
  ai_rephrase_question: { method: 'POST', path: '/api/ai/rephrase-question' },
  ai_generate_solution: { method: 'POST', path: '/api/ai/generate-solution' },
  ai_build_test_proposal: { method: 'POST', path: '/api/ai/build-test-proposal' },
  ai_suggest_alternative: { method: 'POST', path: '/api/ai/suggest-alternative' },
  solve_constraints: { method: 'POST', path: '/api/solver/solve' },
  generate_test_versions: { method: 'POST', path: '/api/tests/generate-versions' },
  clear_ai_cache: { method: 'POST', path: '/api/cache/ai/clear' },
  get_backend_port: { method: 'GET', path: '/health' },
};

async function httpFallback<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const mapping = CMD_MAP[cmd];
  if (!mapping) throw new Error(`Unknown command: ${cmd}`);

  const path = typeof mapping.path === 'function' ? mapping.path(args) : mapping.path;
  const url = `${backendUrl()}${path}`;

  const options: RequestInit = { method: mapping.method, headers: { 'Content-Type': 'application/json' } };
  if (mapping.method !== 'GET' && mapping.method !== 'DELETE') {
    options.body = JSON.stringify(args);
  }

  const resp = await fetch(url, options);
  return resp.json() as Promise<T>;
}

// ─── Typed API surface (drop-in replacement for window.profTestAPI) ───

export const api = {
  // Questions
  listQuestions: () => invoke<Question[]>('list_questions'),
  searchQuestions: (text: string) => invoke<Question[]>('search_questions', { text }),
  getQuestion: (id: string) => invoke<Question | null>('get_question', { id }),
  addQuestion: (q: Partial<Question>) => invoke<{ ok: boolean; question?: Question }>('add_question', { question: q }),
  updateQuestion: (id: string, patch: Partial<Question>) => invoke<{ ok: boolean }>('update_question', { id, patch }),
  removeQuestion: (id: string) => invoke<{ ok: boolean }>('remove_question', { id }),
  incrementQuestionUsage: (id: string) => invoke<{ ok: boolean }>('increment_question_usage', { id }),

  // Question import/export
  exportQuestionsJson: (filePath: string) => invoke<{ ok: boolean; count?: number; error?: string }>('export_questions_json', { file_path: filePath }),
  importQuestionsJson: (filePath: string, mode: 'append' | 'replace') => invoke<{ ok: boolean; count?: number; error?: string }>('import_questions_json', { file_path: filePath, mode }),
  exportQuestionsYaml: (filePath: string) => invoke<{ ok: boolean; count?: number; error?: string }>('export_questions_yaml', { file_path: filePath }),
  importQuestionsYaml: (filePath: string, mode: 'append' | 'replace') => invoke<{ ok: boolean; count?: number; error?: string }>('import_questions_yaml', { file_path: filePath, mode }),
  exportQuestionMetadataCsv: (filePath: string) => invoke<{ ok: boolean; error?: string }>('export_question_metadata_csv', { file_path: filePath }),

  // Exports
  exportAnswerKeyCsv: (testId: string, versions: TestInstance[], filePath: string) => invoke<{ ok: boolean; error?: string }>('export_answer_key_csv', { test_id: testId, versions, file_path: filePath }),
  exportGradingMatrixXlsx: (testId: string, versions: TestInstance[], filePath: string) => invoke<{ ok: boolean; error?: string }>('export_grading_matrix_xlsx', { test_id: testId, versions, file_path: filePath }),
  exportResponseTemplate: (testId: string, versions: TestInstance[], filePath: string) => invoke<{ ok: boolean; error?: string }>('export_response_template', { test_id: testId, versions, file_path: filePath }),
  exportMixedGradingXlsx: (testId: string, versions: TestInstance[], filePath: string) => invoke<{ ok: boolean; error?: string }>('export_mixed_grading_xlsx', { test_id: testId, versions, file_path: filePath }),

  // Export profiles
  listExportProfiles: () => invoke<{ ok: boolean; profiles: ExportProfile[]; error?: string }>('list_export_profiles'),
  upsertExportProfile: (profile: ExportProfile) => invoke<{ ok: boolean; error?: string }>('upsert_export_profile', { profile }),
  removeExportProfile: (id: string) => invoke<{ ok: boolean; error?: string }>('remove_export_profile', { id }),

  // Presets
  listHeaderPresets: () => invoke<{ ok: boolean; presets: HeaderPreset[]; error?: string }>('list_header_presets'),
  upsertHeaderPreset: (preset: HeaderPreset) => invoke<{ ok: boolean; error?: string }>('upsert_header_preset', { preset }),
  removeHeaderPreset: (id: string) => invoke<{ ok: boolean; error?: string }>('remove_header_preset', { id }),
  listLayoutPresets: () => invoke<{ ok: boolean; presets: LayoutPreset[]; error?: string }>('list_layout_presets'),
  upsertLayoutPreset: (preset: LayoutPreset) => invoke<{ ok: boolean; error?: string }>('upsert_layout_preset', { preset }),
  removeLayoutPreset: (id: string) => invoke<{ ok: boolean; error?: string }>('remove_layout_preset', { id }),

  // Cache
  clearAiCache: () => invoke<{ ok: boolean; error?: string }>('clear_ai_cache'),

  // File dialogs (use Tauri plugin or fallback)
  showOpenDialog: async (options?: DialogOpenOptions): Promise<DialogOpenResult> => {
    if (_openDialog) return _openDialog(options);
    // Browser fallback: use input[type=file]
    return { canceled: true, filePaths: [] };
  },
  showSaveDialog: async (options?: DialogSaveOptions): Promise<DialogSaveResult> => {
    if (_saveDialog) return _saveDialog(options);
    // Browser fallback: prompt for path
    const path = prompt('Enter file path to save:');
    if (!path) return { canceled: true };
    return { canceled: false, filePath: path };
  },

  // Projects
  createProject: (name: string) => invoke<{ ok: boolean; layout?: string; error?: string }>('create_project', { name }),
  listProjects: () => invoke<{ ok: boolean; projects: string[]; error?: string }>('list_projects'),
  activateProject: (name: string) => invoke<{ ok: boolean; error?: string }>('activate_project', { name }),
  getActiveProject: () => invoke<{ ok: boolean; project?: string | null; active?: string | null; error?: string }>('get_active_project'),
  saveMedia: (projectName: string, filename: string, base64: string) => invoke<{ ok: boolean; path?: string; error?: string }>('save_media', { project_name: projectName, filename, base64 }),
  listMedia: (projectName: string) => invoke<{ ok: boolean; files: string[]; error?: string }>('list_media', { project_name: projectName }),
  exportProject: (name: string, outPath: string) => invoke<{ ok: boolean; error?: string }>('export_project', { name, out_path: outPath }),
  importProject: (archivePath: string, name: string) => invoke<{ ok: boolean; error?: string }>('import_project', { archive_path: archivePath, name }),

  // Test templates
  listTestTemplates: () => invoke<{ ok: boolean; templates: TestTemplate[]; error?: string }>('list_test_templates'),
  getTestTemplate: (id: string) => invoke<{ ok: boolean; template?: TestTemplate; error?: string }>('get_test_template', { id }),
  upsertTestTemplate: (template: TestTemplate) => invoke<{ ok: boolean; error?: string }>('upsert_test_template', { template }),
  removeTestTemplate: (id: string) => invoke<{ ok: boolean; error?: string }>('remove_test_template', { id }),

  // Test instances
  listTestInstances: (templateId?: string) => invoke<{ ok: boolean; instances: TestInstance[]; error?: string }>('list_test_instances', { template_id: templateId }),
  getTestInstance: (id: string) => invoke<{ ok: boolean; instance?: TestInstance; error?: string }>('get_test_instance', { id }),
  upsertTestInstance: (instance: TestInstance) => invoke<{ ok: boolean; error?: string }>('upsert_test_instance', { instance }),
  removeTestInstance: (id: string) => invoke<{ ok: boolean; error?: string }>('remove_test_instance', { id }),

  // Settings
  getSettings: () => invoke<{ ok: boolean; settings: Settings; error?: string }>('get_settings'),
  saveSettings: (settings: Partial<Settings> & Record<string, unknown>) => invoke<{ ok: boolean; error?: string }>('save_settings', { settings }),
  isEncryptionAvailable: () => invoke<{ ok: boolean; available: boolean }>('is_encryption_available'),

  // LaTeX
  compileLatex: (source: string, filename: string, options?: { engine?: string; outputDir?: string }) => invoke<{ ok: boolean; pdfPath?: string; errors?: string[]; error?: string; log?: string }>('compile_latex', { source, filename, options }),
  compileLatexBatch: (items: Array<{ source: string; filename: string; options?: Record<string, unknown> }>) => invoke<{ ok: boolean; jobId?: string; error?: string }>('compile_latex_batch', { items }),
  getCompileBatchStatus: (jobId: string) => invoke<{ ok: boolean; job?: { id: string; status: string; total: number; completed: number; results: Array<{ filename: string; ok: boolean; pdfPath?: string; errors?: string[] }>; error?: string }; error?: string }>('get_compile_batch_status', { job_id: jobId }),
  detectLatex: () => invoke<{ ok: boolean; found: boolean; path?: string; engine?: string }>('detect_latex'),
  renderTestLatex: (questions: Array<Question | undefined>, instances: QuestionInstance[], context: { template?: TestTemplate; versionLabel?: string; headerPreset?: HeaderPreset; layoutPreset?: LayoutPreset; courseName?: string; instructorName?: string; date?: string; duration?: string }, sections?: SectionDefinition[]) => invoke<{ ok: boolean; latex?: string; error?: string }>('render_test_latex', { questions, instances, context, sections }),
  renderAnswerKeyLatex: (questions: Question[], instances: QuestionInstance[], answerKey: Record<string, string>, context: { template?: TestTemplate; versionLabel?: string; headerPreset?: HeaderPreset; layoutPreset?: LayoutPreset }) => invoke<{ ok: boolean; latex?: string; error?: string }>('render_answer_key_latex', { questions, instances, answer_key: answerKey, context }),

  // AI
  configureAI: (config: { provider: string; apiKey?: string; model?: string; baseUrl?: string } & Record<string, unknown>) => invoke<{ ok: boolean; error?: string }>('configure_ai', { config }),
  aiGenerateQuestions: (request: { topic?: string; type?: string; questionType?: string; count?: number; numberOfQuestions?: number; difficulty?: number; subject?: string; instructions?: string }) => invoke<{ ok: boolean; data?: Question[]; error?: string }>('ai_generate_questions', { request }),
  aiGenerateDistractors: (request: { stem: string; correctAnswer: string; count?: number }) => invoke<{ ok: boolean; data?: string[]; error?: string }>('ai_generate_distractors', { request }),
  aiRephraseQuestion: (request: { question?: Question; stem?: string; tone?: string; instructions?: string }) => invoke<{ ok: boolean; data?: Question | string; error?: string }>('ai_rephrase_question', { request }),
  aiGenerateSolution: (question: Partial<Question>) => invoke<{ ok: boolean; data?: string; error?: string }>('ai_generate_solution', { question }),
  aiBuildTestProposal: (request: { description?: string; subject?: string; topics?: string[]; totalQuestions?: number; difficultyMix?: Record<string, number>; constraints?: Record<string, unknown> }) => invoke<{ ok: boolean; data?: Question[] | TestTemplate; error?: string }>('ai_build_test_proposal', { request }),
  aiSuggestAlternative: (request: { originalStem: string; topic?: string; type?: string; difficulty?: number }) => invoke<{ ok: boolean; data?: Question; error?: string }>('ai_suggest_alternative', { request }),

  // Solver
  solveConstraints: (constraints: { templateId?: string; totalQuestions?: number; topicDistribution?: Record<string, number>; difficultyDistribution?: Record<string, number>; excludeTags?: string[]; rules?: Record<string, unknown>; questionPool?: string[] }) => invoke<{ ok: boolean; questions?: Question[]; warnings?: string[] }>('solve_constraints', { constraints }),

  // Test generation
  generateTestVersions: (questionIds: string[], options: { versions: number; seed?: number; swapEquivalentQuestions?: boolean; sections?: Array<{ id: string; name: string; questionIds: string[] }> }) => invoke<{ ok: boolean; versions?: TestInstance[]; changeLog?: VersionChangeLog; error?: string }>('generate_test_versions', { question_ids: questionIds, options }),
};

export type ProfTestAPI = typeof api;
