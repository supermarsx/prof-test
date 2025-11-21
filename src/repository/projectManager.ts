import fs from 'fs';
import path from 'path';

export interface ProjectLayout {
  root: string;
  dataDir: string;
  mediaDir: string;
  templatesDir: string;
}

export class ProjectManager {
  private baseDir: string;

  constructor(baseDir?: string) {
    // default projects folder in repository root
    this.baseDir = baseDir || path.join(__dirname, '..', '..', 'projects');
    if (!fs.existsSync(this.baseDir)) fs.mkdirSync(this.baseDir, { recursive: true });
  }

  createProject(name: string): ProjectLayout {
    const root = path.join(this.baseDir, name);
    const dataDir = path.join(root, 'data');
    const mediaDir = path.join(root, 'media');
    const templatesDir = path.join(root, 'templates');

    [root, dataDir, mediaDir, templatesDir].forEach((d) => {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });

    // create empty questions file if not present
    const questionsFile = path.join(dataDir, 'questions.json');
    if (!fs.existsSync(questionsFile)) fs.writeFileSync(questionsFile, '[]', 'utf8');

    return { root, dataDir, mediaDir, templatesDir };
  }

  listProjects(): string[] {
    return fs.readdirSync(this.baseDir).filter((f) => {
      try {
        return fs.statSync(path.join(this.baseDir, f)).isDirectory();
      } catch (e) {
        return false;
      }
    });
  }

  projectLayout(name: string): ProjectLayout | null {
    const root = path.join(this.baseDir, name);
    if (!fs.existsSync(root)) return null;
    const dataDir = path.join(root, 'data');
    const mediaDir = path.join(root, 'media');
    const templatesDir = path.join(root, 'templates');
    return { root, dataDir, mediaDir, templatesDir };
  }

  saveMedia(projectName: string, filename: string, buffer: Buffer): string {
    const layout = this.projectLayout(projectName);
    if (!layout) throw new Error('Project not found');
    // sanitize filename simple approach
    const safeName = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const outPath = path.join(layout.mediaDir, safeName);
    fs.writeFileSync(outPath, buffer);
    return outPath;
  }

  listMedia(projectName: string): string[] {
    const layout = this.projectLayout(projectName);
    if (!layout) return [];
    return fs.readdirSync(layout.mediaDir).filter((f) => {
      try {
        return fs.statSync(path.join(layout.mediaDir, f)).isFile();
      } catch (e) {
        return false;
      }
    });
  }
}
