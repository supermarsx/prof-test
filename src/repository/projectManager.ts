import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

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

    // create placeholder database file if not present
    const questionsDb = path.join(dataDir, 'questions.db');
    if (!fs.existsSync(questionsDb)) fs.writeFileSync(questionsDb, '');

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

  exportProject(name: string, outPath: string): string {
    const layout = this.projectLayout(name);
    if (!layout) throw new Error('Project not found');
    const zip = new AdmZip();
    zip.addLocalFolder(layout.root);
    zip.writeZip(outPath);
    return outPath;
  }

  importProject(archivePath: string, name: string): ProjectLayout {
    if (!name || !name.trim()) throw new Error('Project name is required');
    const root = path.join(this.baseDir, name);
    if (fs.existsSync(root)) throw new Error('Project already exists');
    fs.mkdirSync(root, { recursive: true });
    const zip = new AdmZip(archivePath);
    zip.extractAllTo(root, true);
    return this.projectLayout(name) as ProjectLayout;
  }
}
