'use client';

import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Question } from '../../models';

const difficultyClass = (d: number | undefined) => {
  if (!d || d < 1 || d > 5) return '';
  return `difficulty-${d}` as const;
};

const QuestionRow = React.memo(function QuestionRow({
  question,
  onSelect,
  onClone,
  onDelete,
}: {
  question: Question;
  onSelect: (q: Question) => void;
  onClone: (q: Question) => void;
  onDelete: (q: Question) => void;
}) {
  return (
    <div className="glass-card flex items-center gap-sm">
      <button type="button" className="btn-ghost btn-sm flex-1 truncate" onClick={() => onSelect(question)}>
        {question.stem} {question.topic ? `(${question.topic})` : ''}
      </button>
      {question.status === 'draft' && (
        <span className="badge" style={{ background: 'var(--warning)', color: 'var(--bg-primary)' }}>draft</span>
      )}
      {question.origin === 'ai' && (
        <span className="badge" style={{ background: 'var(--accent)', color: 'var(--bg-primary)' }}>AI</span>
      )}
      {question.type && <span className="badge badge-accent">{question.type}</span>}
      {question.difficulty != null && (
        <span className={`badge ${difficultyClass(question.difficulty)}`}>D{question.difficulty}</span>
      )}
      {question.topic && <span className="badge">{question.topic}</span>}
      <button className="btn-ghost btn-sm" onClick={() => onClone(question)}>Clone</button>
      <button className="btn-danger btn-sm" onClick={() => onDelete(question)}>Delete</button>
    </div>
  );
});

export function QuestionList({ onSelect }: { onSelect: (q: Question | null) => void }) {
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [subtopic, setSubtopic] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [tag, setTag] = useState('');
  const [author, setAuthor] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [tagFrom, setTagFrom] = useState('');
  const [tagTo, setTagTo] = useState('');
  const [importPath, setImportPath] = useState('');
  const [exportPath, setExportPath] = useState('');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [ioFormat, setIoFormat] = useState<'json' | 'yaml'>('json');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    api.listQuestions().then((q: Question[]) => setAllQuestions(q || []));
  }, []);

  const refresh = useCallback(async () => {
    const res = await api.listQuestions();
    setAllQuestions(res || []);
  }, []);

  const clearFilters = useCallback(async () => {
    setSubject('');
    setTopic('');
    setSubtopic('');
    setDifficulty('');
    setTag('');
    setAuthor('');
    setQuery('');
    await refresh();
  }, [refresh]);

  const deferredQuery = useDeferredValue(query);
  const deferredSubject = useDeferredValue(subject);
  const deferredTopic = useDeferredValue(topic);
  const deferredSubtopic = useDeferredValue(subtopic);
  const deferredDifficulty = useDeferredValue(difficulty);
  const deferredTag = useDeferredValue(tag);
  const deferredAuthor = useDeferredValue(author);

  const filteredQuestions = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    let list = allQuestions;
    if (needle) {
      list = list.filter((q) =>
        (q.stem && q.stem.toLowerCase().includes(needle)) ||
        (q.subject && q.subject.toLowerCase().includes(needle)) ||
        (q.topic && q.topic.toLowerCase().includes(needle)) ||
        (q.subtopic && q.subtopic.toLowerCase().includes(needle)) ||
        (q.author && q.author.toLowerCase().includes(needle)) ||
        (q.tags && q.tags.join(' ').toLowerCase().includes(needle))
      );
    }
    if (deferredSubject) {
      list = list.filter((q) => q.subject && q.subject.toLowerCase().includes(deferredSubject.toLowerCase()));
    }
    if (deferredTopic) {
      list = list.filter((q) => q.topic && q.topic.toLowerCase().includes(deferredTopic.toLowerCase()));
    }
    if (deferredSubtopic) {
      list = list.filter((q) => q.subtopic && q.subtopic.toLowerCase().includes(deferredSubtopic.toLowerCase()));
    }
    if (deferredAuthor) {
      list = list.filter((q) => q.author && q.author.toLowerCase().includes(deferredAuthor.toLowerCase()));
    }
    if (deferredDifficulty) {
      const diff = Number(deferredDifficulty);
      if (Number.isFinite(diff)) {
        list = list.filter((q) => q.difficulty === diff);
      }
    }
    if (deferredTag) {
      list = list.filter((q) => (q.tags || []).some((t) => t.toLowerCase().includes(deferredTag.toLowerCase())));
    }
    const sorted = list.slice();
    if (sortKey === 'topic') {
      sorted.sort((a, b) => (a.topic || '').localeCompare(b.topic || ''));
    } else if (sortKey === 'difficulty') {
      sorted.sort((a, b) => (a.difficulty || 0) - (b.difficulty || 0));
    } else if (sortKey === 'updated_at') {
      sorted.sort((a, b) => (a.updated_at || '').localeCompare(b.updated_at || ''));
    }
    return sorted;
  }, [
    allQuestions,
    deferredQuery,
    deferredSubject,
    deferredTopic,
    deferredSubtopic,
    deferredAuthor,
    deferredDifficulty,
    deferredTag,
    sortKey,
  ]);

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of allQuestions) {
      for (const t of q.tags || []) {
        const key = t.trim();
        if (!key) continue;
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    return counts;
  }, [allQuestions]);

  const renameTag = async () => {
    if (!tagFrom.trim() || !tagTo.trim()) return;
    setRenaming(true);
    try {
      const all = await api.listQuestions();
      for (const q of all || []) {
        if (!q.tags) continue;
        const nextTags = q.tags.map((t: string) => (t === tagFrom ? tagTo : t));
        if (nextTags.join('|') !== q.tags.join('|')) {
          await api.updateQuestion(q.id, { tags: nextTags });
        }
      }
      setTagFrom('');
      setTagTo('');
      await refresh();
    } finally {
      setRenaming(false);
    }
  };

  const exportQuestions = async () => {
    if (!exportPath.trim()) return;
    setExporting(true);
    try {
      if (ioFormat === 'json') {
        await api.exportQuestionsJson(exportPath.trim());
      } else {
        await api.exportQuestionsYaml(exportPath.trim());
      }
    } finally {
      setExporting(false);
    }
  };

  const importQuestions = async () => {
    if (!importPath.trim()) return;
    setImporting(true);
    try {
      if (ioFormat === 'json') {
        await api.importQuestionsJson(importPath.trim(), importMode);
      } else {
        await api.importQuestionsYaml(importPath.trim(), importMode);
      }
      await refresh();
    } finally {
      setImporting(false);
    }
  };

  const cloneQuestion = async (q: Question) => {
    const next = { ...q, id: `q-${Math.random().toString(36).slice(2, 9)}` };
    await api.addQuestion(next);
    setAllQuestions((prev) => [...prev, next as Question]);
  };

  const deleteQuestion = async (q: Question) => {
    if (!confirm(`Delete question ${q.id}?`)) return;
    await api.removeQuestion(q.id);
    setAllQuestions((prev) => prev.filter((item) => item.id !== q.id));
  };

  return (
    <div className="flex gap-md fade-in">
      {/* Left sidebar */}
      <div className="panel flex flex-col gap-sm overflow-auto" style={{ width: 300, minWidth: 300 }}>
        {/* Search */}
        <div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search questions" />
        </div>

        {/* Filters */}
        <div className="glass-card flex flex-col gap-xs">
          <label className="text-sm text-secondary">Filters</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Filter subject" aria-label="Filter subject" />
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Filter topic" aria-label="Filter topic" />
          <input value={subtopic} onChange={(e) => setSubtopic(e.target.value)} placeholder="Filter subtopic" aria-label="Filter subtopic" />
          <input value={difficulty} onChange={(e) => setDifficulty(e.target.value)} placeholder="Filter difficulty" aria-label="Filter difficulty" />
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Filter tag" aria-label="Filter tag" />
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Filter author" aria-label="Filter author" />
          <button className="btn-ghost btn-sm" onClick={clearFilters}>Clear Filters</button>
        </div>

        {/* Sort */}
        <div>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
            <option value="">No Sort</option>
            <option value="topic">Sort by Topic</option>
            <option value="difficulty">Sort by Difficulty</option>
            <option value="updated_at">Sort by Updated</option>
          </select>
        </div>

        {/* Tags */}
        <div className="glass-card flex flex-col gap-xs">
          <label className="text-sm text-secondary">Tags</label>
          <div className="flex flex-col gap-xs">
            <input value={tagFrom} onChange={(e) => setTagFrom(e.target.value)} placeholder="Tag to rename" />
            <input value={tagTo} onChange={(e) => setTagTo(e.target.value)} placeholder="New tag" />
            <button className="btn-ghost btn-sm" onClick={renameTag} disabled={renaming}>{renaming ? 'Renaming...' : 'Rename/Merge'}</button>
          </div>
          <div className="flex flex-wrap gap-xs">
            {Object.entries(tagCounts).map(([t, count]) => (
              <span key={t} className="badge">{t} ({count})</span>
            ))}
          </div>
        </div>

        {/* Import/Export */}
        <div className="glass-card flex flex-col gap-sm">
          <label className="text-sm text-secondary">Import / Export</label>
          <div className="flex gap-xs">
            <select value={ioFormat} onChange={(e) => setIoFormat(e.target.value as 'json' | 'yaml')}>
              <option value="json">JSON</option>
              <option value="yaml">YAML</option>
            </select>
            <select value={importMode} onChange={(e) => setImportMode(e.target.value as 'append' | 'replace')}>
              <option value="append">Append</option>
              <option value="replace">Replace</option>
            </select>
          </div>
          <div className="flex gap-xs items-center">
            <input value={importPath} onChange={(e) => setImportPath(e.target.value)} placeholder="Import path" />
            <button className="btn-ghost btn-sm" onClick={async () => {
              try {
                const result = await api.showOpenDialog({
                  title: 'Import Questions',
                  filters: [{ name: 'Questions', extensions: ['json', 'yaml', 'yml'] }],
                });
                if (!result.canceled && result.filePaths?.length) setImportPath(result.filePaths[0]);
              } catch { /* ignored */ }
            }}>Browse</button>
            <button className="btn-sm" onClick={importQuestions} disabled={importing}>{importing ? 'Importing...' : 'Import'}</button>
          </div>
          <div className="flex gap-xs items-center">
            <input value={exportPath} onChange={(e) => setExportPath(e.target.value)} placeholder="Export path" />
            <button className="btn-ghost btn-sm" onClick={async () => {
              try {
                const ext = ioFormat === 'json' ? 'json' : 'yaml';
                const result = await api.showSaveDialog({
                  title: 'Export Questions',
                  filters: [{ name: ioFormat.toUpperCase(), extensions: [ext] }],
                });
                if (!result.canceled && result.filePath) setExportPath(result.filePath);
              } catch { /* ignored */ }
            }}>Browse</button>
            <button className="btn-sm" onClick={exportQuestions} disabled={exporting}>{exporting ? 'Exporting...' : 'Export'}</button>
          </div>
        </div>

        {/* New Question */}
        <button className="btn-primary" onClick={() => onSelect(null)}>New Question</button>
      </div>

      {/* Question list */}
      <div className="flex-1 flex flex-col gap-sm overflow-auto">
        {filteredQuestions.map((q) => (
          <QuestionRow
            key={q.id}
            question={q}
            onSelect={(item) => onSelect(item)}
            onClone={cloneQuestion}
            onDelete={deleteQuestion}
          />
        ))}
      </div>
    </div>
  );
}
