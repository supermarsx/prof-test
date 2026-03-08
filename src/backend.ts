/**
 * ProfTest Backend Server
 * 
 * Standalone HTTP server that exposes all business logic as REST endpoints.
 * Replaces the Electron main.ts IPC handlers.
 * 
 * Launched by Tauri as a sidecar process.
 * Uses Node's built-in http module (no external framework dependency).
 */

import http from 'http';
import path from 'path';
import fs from 'fs';
import { QuestionRepository } from './repository/questionRepository';
import { ExportProfileRepository } from './repository/exportProfileRepository';
import { PresetRepository } from './repository/presetRepository';
import { TestRepository } from './repository/testRepository';
import { SettingsRepository } from './repository/settingsRepository';
import { ProjectManager } from './repository/projectManager';
import { buildAnswerKeyCsv, buildQuestionMetadataCsv } from './utils/exports';
import { buildGradingMatrixWorkbook, buildResponseImportTemplate, buildMixedClassGradingWorkbook } from './utils/exportsExcel';
import { clearAiCache } from './utils/aiCache';
import { compileLatex, detectLatexInstallation } from './utils/latexCompiler';
import { renderTestLatex, renderAnswerKeyLatex } from './utils/latexRenderer';
import { AIProvider, setAIProvider, getAIProvider } from './utils/aiProvider';
import { encryptApiKey, decryptApiKey, isEncryptionAvailable } from './utils/keychain';
import { solveConstraints } from './utils/constraintSolver';
import { generateTestVersions } from './utils/testGenerator';
import {
  requireString,
  requireObject,
  requireArray,
  sanitizePath,
  validateQuestionInput,
  validateTemplateInput,
  validateSettingsInput,
  validateImportMode,
} from './utils/ipcValidation';

// ─── State ───────────────────────────────────────────────────

const dataRoot = process.env.PROFTEST_DATA_DIR || path.join(process.cwd(), 'data');
const defaultDbPath = path.join(dataRoot, 'questions.db');

// Ensure data directory exists
if (!fs.existsSync(dataRoot)) {
  fs.mkdirSync(dataRoot, { recursive: true });
}

let activeDbPath = defaultDbPath;
let repo = new QuestionRepository(activeDbPath);
let exportProfiles = new ExportProfileRepository(activeDbPath);
let presets = new PresetRepository(activeDbPath);
let testRepo = new TestRepository(activeDbPath);
let settingsRepo = new SettingsRepository(activeDbPath);
const projectManager = new ProjectManager();
let activeProject: string | null = null;

// ─── Helpers ─────────────────────────────────────────────────

function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function json(res: http.ServerResponse, data: any, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function error(res: http.ServerResponse, msg: string, status = 400) {
  json(res, { ok: false, error: msg }, status);
}

// Wrap handler with error catching (replaces safeHandler)
function safe(fn: (body: any, params: Record<string, string>) => Promise<any> | any) {
  return async (req: http.IncomingMessage, res: http.ServerResponse, params: Record<string, string>) => {
    try {
      const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await parseBody(req);
      const result = await fn(body, params);
      json(res, result);
    } catch (e: any) {
      error(res, e.message || String(e));
    }
  };
}

// Simple URL pattern matcher
type RouteHandler = (req: http.IncomingMessage, res: http.ServerResponse, params: Record<string, string>) => Promise<void> | void;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

const routes: Route[] = [];

function addRoute(method: string, pathPattern: string, handler: RouteHandler) {
  const paramNames: string[] = [];
  const regexStr = pathPattern.replace(/:([a-zA-Z_]+)/g, (_m, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  routes.push({ method, pattern: new RegExp(`^${regexStr}$`), paramNames, handler });
}

function matchRoute(method: string, pathname: string): { handler: RouteHandler; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method) continue;
    const m = pathname.match(route.pattern);
    if (m) {
      const params: Record<string, string> = {};
      route.paramNames.forEach((name, i) => { params[name] = decodeURIComponent(m[i + 1]); });
      return { handler: route.handler, params };
    }
  }
  return null;
}

// ─── Routes ──────────────────────────────────────────────────

// Health check
addRoute('GET', '/health', (_req, res) => {
  json(res, { ok: true, status: 'running' });
});

// ── Questions ────────────────────────────────────────────────

addRoute('GET', '/api/questions', safe(async () => {
  return repo.list();
}));

addRoute('POST', '/api/questions/search', safe(async (body) => {
  const searchText = typeof body.text === 'string' ? body.text : '';
  return repo.search(searchText);
}));

addRoute('GET', '/api/questions/:id', safe(async (_body, params) => {
  return repo.get(requireString(params.id, 'id'));
}));

addRoute('POST', '/api/questions', safe(async (body) => {
  validateQuestionInput(body);
  repo.add(body);
  return { ok: true };
}));

addRoute('POST', '/api/questions/:id/update', safe(async (body, params) => {
  const validId = requireString(params.id, 'id');
  requireObject(body, 'patch');
  repo.update(validId, body);
  return { ok: true };
}));

addRoute('DELETE', '/api/questions/:id', safe(async (_body, params) => {
  repo.remove(requireString(params.id, 'id'));
  return { ok: true };
}));

addRoute('POST', '/api/questions/:id/increment-usage', safe(async (_body, params) => {
  repo.incrementUsage(requireString(params.id, 'id'));
  return { ok: true };
}));

addRoute('POST', '/api/questions/export/json', safe(async (body) => {
  const safePath = sanitizePath(body.filePath, 'filePath');
  const saved = repo.exportToJson(safePath);
  return { ok: true, path: saved };
}));

addRoute('POST', '/api/questions/import/json', safe(async (body) => {
  const safePath = sanitizePath(body.filePath, 'filePath');
  const validMode = validateImportMode(body.mode);
  repo.importFromJson(safePath, validMode);
  return { ok: true };
}));

addRoute('POST', '/api/questions/export/yaml', safe(async (body) => {
  const safePath = sanitizePath(body.filePath, 'filePath');
  const saved = repo.exportToYaml(safePath);
  return { ok: true, path: saved };
}));

addRoute('POST', '/api/questions/import/yaml', safe(async (body) => {
  const safePath = sanitizePath(body.filePath, 'filePath');
  const validMode = validateImportMode(body.mode);
  repo.importFromYaml(safePath, validMode);
  return { ok: true };
}));

addRoute('POST', '/api/questions/export/metadata-csv', safe(async (body) => {
  const safePath = sanitizePath(body.filePath, 'filePath');
  const csv = buildQuestionMetadataCsv(repo.list());
  fs.writeFileSync(safePath, csv, 'utf8');
  return { ok: true, path: safePath };
}));

// ── Exports ──────────────────────────────────────────────────

addRoute('POST', '/api/exports/answer-key-csv', safe(async (body) => {
  const safePath = sanitizePath(body.filePath, 'filePath');
  const validTestId = requireString(body.testId, 'testId');
  const validVersions = requireArray(body.versions, 'versions');
  const csv = buildAnswerKeyCsv(validTestId, validVersions as any);
  fs.writeFileSync(safePath, csv, 'utf8');
  return { ok: true, path: safePath };
}));

addRoute('POST', '/api/exports/grading-matrix-xlsx', safe(async (body) => {
  const safePath = sanitizePath(body.filePath, 'filePath');
  const validTestId = requireString(body.testId, 'testId');
  const validVersions = requireArray(body.versions, 'versions');
  const buf = buildGradingMatrixWorkbook(validTestId, validVersions as any);
  fs.writeFileSync(safePath, buf);
  return { ok: true, path: safePath };
}));

addRoute('POST', '/api/exports/response-template', safe(async (body) => {
  const safePath = sanitizePath(body.filePath, 'filePath');
  const validTestId = requireString(body.testId, 'testId');
  const validVersions = requireArray(body.versions, 'versions');
  const buf = buildResponseImportTemplate(validTestId, validVersions as any);
  fs.writeFileSync(safePath, buf);
  return { ok: true, path: safePath };
}));

addRoute('POST', '/api/exports/mixed-grading-xlsx', safe(async (body) => {
  const safePath = sanitizePath(body.filePath, 'filePath');
  const validTestId = requireString(body.testId, 'testId');
  const validVersions = requireArray(body.versions, 'versions');
  const buf = buildMixedClassGradingWorkbook(validTestId, validVersions as any);
  fs.writeFileSync(safePath, buf);
  return { ok: true, path: safePath };
}));

// ── Export Profiles ──────────────────────────────────────────

addRoute('GET', '/api/export-profiles', safe(async () => {
  return { ok: true, profiles: exportProfiles.list() };
}));

addRoute('POST', '/api/export-profiles', safe(async (body) => {
  const obj = requireObject(body, 'profile');
  requireString(obj.id, 'profile.id');
  exportProfiles.upsert(obj as any);
  return { ok: true };
}));

addRoute('DELETE', '/api/export-profiles/:id', safe(async (_body, params) => {
  exportProfiles.remove(requireString(params.id, 'id'));
  return { ok: true };
}));

// ── Presets ──────────────────────────────────────────────────

addRoute('GET', '/api/presets/header', safe(async () => {
  return { ok: true, presets: presets.listHeaderPresets() };
}));

addRoute('POST', '/api/presets/header', safe(async (body) => {
  const obj = requireObject(body, 'preset');
  requireString(obj.id, 'preset.id');
  presets.upsertHeaderPreset(obj as any);
  return { ok: true };
}));

addRoute('DELETE', '/api/presets/header/:id', safe(async (_body, params) => {
  presets.removeHeaderPreset(requireString(params.id, 'id'));
  return { ok: true };
}));

addRoute('GET', '/api/presets/layout', safe(async () => {
  return { ok: true, presets: presets.listLayoutPresets() };
}));

addRoute('POST', '/api/presets/layout', safe(async (body) => {
  const obj = requireObject(body, 'preset');
  requireString(obj.id, 'preset.id');
  presets.upsertLayoutPreset(obj as any);
  return { ok: true };
}));

addRoute('DELETE', '/api/presets/layout/:id', safe(async (_body, params) => {
  presets.removeLayoutPreset(requireString(params.id, 'id'));
  return { ok: true };
}));

// ── Projects ─────────────────────────────────────────────────

addRoute('POST', '/api/projects', safe(async (body) => {
  const validName = requireString(body.name, 'name');
  const layout = projectManager.createProject(validName);
  return { ok: true, layout };
}));

addRoute('GET', '/api/projects', safe(async () => {
  return { ok: true, projects: projectManager.listProjects() };
}));

addRoute('POST', '/api/projects/activate', safe(async (body) => {
  const validName = requireString(body.name, 'name');
  const layout = projectManager.projectLayout(validName);
  if (!layout) return { ok: false, error: 'Project not found' };
  activeProject = validName;
  const projectQuestionsPath = path.join(layout.dataDir, 'questions.db');
  activeDbPath = projectQuestionsPath;
  repo = new QuestionRepository(activeDbPath);
  exportProfiles = new ExportProfileRepository(activeDbPath);
  presets = new PresetRepository(activeDbPath);
  testRepo = new TestRepository(activeDbPath);
  settingsRepo = new SettingsRepository(activeDbPath);
  return { ok: true, active: validName };
}));

addRoute('GET', '/api/projects/active', safe(async () => {
  return { ok: true, active: activeProject };
}));

addRoute('POST', '/api/projects/media', safe(async (body) => {
  const validProject = requireString(body.projectName, 'projectName');
  const validFilename = sanitizePath(body.filename, 'filename');
  const validBase64 = typeof body.base64 === 'string' ? body.base64 : '';
  const buf = Buffer.from(validBase64, 'base64');
  const saved = projectManager.saveMedia(validProject, validFilename, buf);
  return { ok: true, path: saved };
}));

addRoute('GET', '/api/projects/:projectName/media', safe(async (_body, params) => {
  const validProject = requireString(params.projectName, 'projectName');
  const files = projectManager.listMedia(validProject);
  return { ok: true, files };
}));

addRoute('POST', '/api/projects/export', safe(async (body) => {
  const validName = requireString(body.name, 'name');
  const safePath = sanitizePath(body.outPath, 'outPath');
  const saved = projectManager.exportProject(validName, safePath);
  return { ok: true, path: saved };
}));

addRoute('POST', '/api/projects/import', safe(async (body) => {
  const safePath = sanitizePath(body.archivePath, 'archivePath');
  const validName = requireString(body.name, 'name');
  const layout = projectManager.importProject(safePath, validName);
  return { ok: true, layout };
}));

// ── Test Templates ───────────────────────────────────────────

addRoute('GET', '/api/test-templates', safe(async () => {
  return { ok: true, templates: testRepo.listTemplates() };
}));

addRoute('GET', '/api/test-templates/:id', safe(async (_body, params) => {
  return { ok: true, template: testRepo.getTemplate(requireString(params.id, 'id')) };
}));

addRoute('POST', '/api/test-templates', safe(async (body) => {
  validateTemplateInput(body);
  testRepo.upsertTemplate(body as any);
  return { ok: true };
}));

addRoute('DELETE', '/api/test-templates/:id', safe(async (_body, params) => {
  testRepo.removeTemplate(requireString(params.id, 'id'));
  return { ok: true };
}));

// ── Test Instances ───────────────────────────────────────────

addRoute('GET', '/api/test-instances', safe(async () => {
  // NOTE: query params are handled in the request handler
  return { ok: true, instances: testRepo.listInstances() };
}));

addRoute('GET', '/api/test-instances/:id', safe(async (_body, params) => {
  return { ok: true, instance: testRepo.getInstance(requireString(params.id, 'id')) };
}));

addRoute('POST', '/api/test-instances', safe(async (body) => {
  const obj = requireObject(body, 'instance');
  requireString(obj.id, 'instance.id');
  testRepo.upsertInstance(obj as any);
  return { ok: true };
}));

addRoute('DELETE', '/api/test-instances/:id', safe(async (_body, params) => {
  testRepo.removeInstance(requireString(params.id, 'id'));
  return { ok: true };
}));

// ── Settings ─────────────────────────────────────────────────

addRoute('GET', '/api/settings', safe(async () => {
  const s = settingsRepo.getSettings();
  return {
    ok: true,
    settings: {
      ...s,
      ai_api_key_encrypted: decryptApiKey(s.ai_api_key_encrypted || ''),
    },
  };
}));

addRoute('POST', '/api/settings', safe(async (body) => {
  validateSettingsInput(body);
  const toSave = { ...body };
  if (toSave.ai_api_key_encrypted) {
    toSave.ai_api_key_encrypted = encryptApiKey(toSave.ai_api_key_encrypted);
  }
  settingsRepo.saveSettings(toSave);
  return { ok: true };
}));

addRoute('GET', '/api/settings/encryption-available', safe(async () => {
  return { ok: true, available: isEncryptionAvailable() };
}));

// ── LaTeX ────────────────────────────────────────────────────

addRoute('POST', '/api/latex/compile', safe(async (body) => {
  const validSource = requireString(body.source, 'source');
  const validFilename = requireString(body.filename, 'filename');
  const opts = body.options || {};
  const settings = settingsRepo.getSettings();
  const result = await compileLatex(validSource, validFilename, {
    ...opts,
    latexPath: opts?.latexPath || settings.latex_path,
  });
  return { ok: result.success, ...result };
}));

addRoute('GET', '/api/latex/detect', safe(async () => {
  return { ok: true, ...detectLatexInstallation() };
}));

addRoute('POST', '/api/latex/render-test', safe(async (body) => {
  const validQuestions = requireArray(body.questions, 'questions');
  const validInstances = requireArray(body.instances, 'instances');
  const validContext = requireObject(body.context, 'context');
  const validSections = body.sections ? requireArray(body.sections, 'sections') : undefined;
  const latex = renderTestLatex(validQuestions as any, validInstances as any, validContext as any, validSections as any);
  return { ok: true, latex };
}));

addRoute('POST', '/api/latex/render-answer-key', safe(async (body) => {
  const validQuestions = requireArray(body.questions, 'questions');
  const validInstances = requireArray(body.instances, 'instances');
  const validAnswerKey = requireObject(body.answerKey, 'answerKey');
  const validContext = requireObject(body.context, 'context');
  const latex = renderAnswerKeyLatex(validQuestions as any, validInstances as any, validAnswerKey as any, validContext as any);
  return { ok: true, latex };
}));

// ── AI ───────────────────────────────────────────────────────

addRoute('POST', '/api/ai/configure', safe(async (body) => {
  requireObject(body, 'config');
  setAIProvider(body as any);
  return { ok: true };
}));

addRoute('POST', '/api/ai/generate-questions', safe(async (body) => {
  requireObject(body, 'request');
  const provider = getAIProvider();
  if (!provider) return { ok: false, error: 'AI provider not configured' };
  const result = await provider.generateQuestions(body as any);
  return { ok: result.success, data: result.data, error: result.error };
}));

addRoute('POST', '/api/ai/generate-distractors', safe(async (body) => {
  requireObject(body, 'request');
  const provider = getAIProvider();
  if (!provider) return { ok: false, error: 'AI provider not configured' };
  const result = await provider.generateDistractors(body as any);
  return { ok: result.success, data: result.data, error: result.error };
}));

addRoute('POST', '/api/ai/rephrase-question', safe(async (body) => {
  requireObject(body, 'request');
  const provider = getAIProvider();
  if (!provider) return { ok: false, error: 'AI provider not configured' };
  const result = await provider.rephraseQuestion(body as any);
  return { ok: result.success, data: result.data, error: result.error };
}));

addRoute('POST', '/api/ai/generate-solution', safe(async (body) => {
  requireObject(body, 'question');
  const provider = getAIProvider();
  if (!provider) return { ok: false, error: 'AI provider not configured' };
  const result = await provider.generateSolution(body as any);
  return { ok: result.success, data: result.data, error: result.error };
}));

addRoute('POST', '/api/ai/build-test-proposal', safe(async (body) => {
  requireObject(body, 'request');
  const provider = getAIProvider();
  if (!provider) return { ok: false, error: 'AI provider not configured' };
  const result = await provider.buildTestProposal(body as any);
  return { ok: result.success, data: result.data, error: result.error };
}));

// ── Solver ───────────────────────────────────────────────────

addRoute('POST', '/api/solver/solve', safe(async (body) => {
  requireObject(body, 'constraints');
  const bank = repo.list();
  const result = solveConstraints(bank, body as any);
  return { ok: true, ...result };
}));

// ── Test Generation ──────────────────────────────────────────

addRoute('POST', '/api/tests/generate-versions', safe(async (body) => {
  const ids = requireArray(body.questionIds, 'questionIds');
  const opts = requireObject(body.options, 'options');
  const questions = (ids as string[]).map(id => repo.get(requireString(id, 'questionId'))).filter(Boolean);
  const result = generateTestVersions(questions as any[], opts as any);
  // After generating versions, increment usage counts
  for (const id of ids as string[]) {
    repo.incrementUsage(requireString(id, 'questionId'));
  }
  return { ok: true, versions: result.versions, changeLog: result.changeLog };
}));

// ── Cache ────────────────────────────────────────────────────

addRoute('POST', '/api/cache/ai/clear', safe(async () => {
  clearAiCache();
  return { ok: true };
}));

// ─── Server ──────────────────────────────────────────────────

const PORT = parseInt(process.env.BACKEND_PORT || '0', 10) || 0;

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost`);
  const pathname = url.pathname;
  const method = req.method || 'GET';

  // Handle query params for test-instances list
  if (method === 'GET' && pathname === '/api/test-instances' && url.searchParams.has('templateId')) {
    const tid = url.searchParams.get('templateId')!;
    try {
      const instances = testRepo.listInstances(tid);
      json(res, { ok: true, instances });
    } catch (e: any) {
      error(res, e.message);
    }
    return;
  }

  const match = matchRoute(method, pathname);
  if (match) {
    try {
      await match.handler(req, res, match.params);
    } catch (e: any) {
      error(res, e.message || 'Internal server error', 500);
    }
  } else {
    json(res, { ok: false, error: 'Not found' }, 404);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const addr = server.address();
  const actualPort = typeof addr === 'object' && addr ? addr.port : PORT;
  console.log(`ProfTest backend listening on http://127.0.0.1:${actualPort}`);
  // Write port to stdout so Tauri sidecar can read it
  process.stdout.write(`PORT:${actualPort}\n`);
});
