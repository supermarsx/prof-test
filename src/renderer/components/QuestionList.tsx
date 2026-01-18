'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Question } from '../../models';

export function QuestionList({ onSelect }: { onSelect: (q: Question | null) => void }) {
  const [questions, setQuestions] = useState<Question[]>([]);
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

  useEffect(() => {
    window.profTestAPI.listQuestions().then((q: Question[]) => setQuestions(q || []));
  }, []);

  const refresh = async () => {
    const res = await window.profTestAPI.listQuestions();
    setQuestions(res || []);
  };

  const doSearch = async () => {
    const res = await window.profTestAPI.searchQuestions(query);
    setQuestions(res || []);
  };

  const applyFilters = async () => {
    const all = await window.profTestAPI.listQuestions();
    const filtered = (all || []).filter((q: Question) => {
      if (subject && (!q.subject || !q.subject.toLowerCase().includes(subject.toLowerCase()))) return false;
      if (topic && (!q.topic || !q.topic.toLowerCase().includes(topic.toLowerCase()))) return false;
      if (subtopic && (!q.subtopic || !q.subtopic.toLowerCase().includes(subtopic.toLowerCase()))) return false;
      if (author && (!q.author || !q.author.toLowerCase().includes(author.toLowerCase()))) return false;
      if (difficulty) {
        const diff = Number(difficulty);
        if (Number.isFinite(diff) && q.difficulty !== diff) return false;
      }
      if (tag) {
        const tags = (q.tags || []).map((t) => t.toLowerCase());
        if (!tags.some((t) => t.includes(tag.toLowerCase()))) return false;
      }
      return true;
    });
    setQuestions(filtered);
  };

  const clearFilters = async () => {
    setSubject('');
    setTopic('');
    setSubtopic('');
    setDifficulty('');
    setTag('');
    setAuthor('');
    await refresh();
  };

  const sortedQuestions = useMemo(() => {
    const list = questions.slice();
    if (sortKey === 'topic') {
      list.sort((a, b) => (a.topic || '').localeCompare(b.topic || ''));
    } else if (sortKey === 'difficulty') {
      list.sort((a, b) => (a.difficulty || 0) - (b.difficulty || 0));
    } else if (sortKey === 'updated_at') {
      list.sort((a, b) => (a.updated_at || '').localeCompare(b.updated_at || ''));
    }
    return list;
  }, [questions, sortKey]);

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of questions) {
      for (const t of q.tags || []) {
        const key = t.trim();
        if (!key) continue;
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    return counts;
  }, [questions]);

  const renameTag = async () => {
    if (!tagFrom.trim() || !tagTo.trim()) return;
    const all = await window.profTestAPI.listQuestions();
    for (const q of all || []) {
      if (!q.tags) continue;
      const nextTags = q.tags.map((t: string) => (t === tagFrom ? tagTo : t));
      if (nextTags.join('|') !== q.tags.join('|')) {
        await window.profTestAPI.updateQuestion(q.id, { tags: nextTags });
      }
    }
    setTagFrom('');
    setTagTo('');
    await refresh();
  };

  const exportQuestions = async () => {
    if (!exportPath.trim()) return;
    if (ioFormat === 'json') {
      await window.profTestAPI.exportQuestionsJson(exportPath.trim());
    } else {
      await window.profTestAPI.exportQuestionsYaml(exportPath.trim());
    }
  };

  const importQuestions = async () => {
    if (!importPath.trim()) return;
    if (ioFormat === 'json') {
      await window.profTestAPI.importQuestionsJson(importPath.trim(), importMode);
    } else {
      await window.profTestAPI.importQuestionsYaml(importPath.trim(), importMode);
    }
    await refresh();
  };

  const cloneQuestion = async (q: Question) => {
    const next = { ...q, id: `q-${Math.random().toString(36).slice(2, 9)}` };
    await window.profTestAPI.addQuestion(next);
    await refresh();
  };

  const deleteQuestion = async (q: Question) => {
    if (!confirm(`Delete question ${q.id}?`)) return;
    await window.profTestAPI.removeQuestion(q.id);
    await refresh();
  };

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ width: 300 }}>
        <div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" />
          <button onClick={doSearch}>Search</button>
        </div>
        <div>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Filter subject" />
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Filter topic" />
          <input value={subtopic} onChange={(e) => setSubtopic(e.target.value)} placeholder="Filter subtopic" />
          <input value={difficulty} onChange={(e) => setDifficulty(e.target.value)} placeholder="Filter difficulty" />
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Filter tag" />
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Filter author" />
          <button onClick={applyFilters}>Apply Filters</button>
          <button onClick={clearFilters}>Clear Filters</button>
        </div>
        <div>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
            <option value="">No Sort</option>
            <option value="topic">Sort by Topic</option>
            <option value="difficulty">Sort by Difficulty</option>
            <option value="updated_at">Sort by Updated</option>
          </select>
        </div>
        <div>
          <strong>Tags</strong>
          <div>
            <input value={tagFrom} onChange={(e) => setTagFrom(e.target.value)} placeholder="Tag to rename" />
            <input value={tagTo} onChange={(e) => setTagTo(e.target.value)} placeholder="New tag" />
            <button onClick={renameTag}>Rename/Merge</button>
          </div>
          <ul>
            {Object.entries(tagCounts).map(([t, count]) => (
              <li key={t}>{t} ({count})</li>
            ))}
          </ul>
        </div>
        <div>
          <strong>Import/Export</strong>
          <div>
            <select value={ioFormat} onChange={(e) => setIoFormat(e.target.value as any)}>
              <option value="json">JSON</option>
              <option value="yaml">YAML</option>
            </select>
            <select value={importMode} onChange={(e) => setImportMode(e.target.value as any)}>
              <option value="append">Append</option>
              <option value="replace">Replace</option>
            </select>
          </div>
          <div>
            <input value={importPath} onChange={(e) => setImportPath(e.target.value)} placeholder="Import path" />
            <button onClick={importQuestions}>Import</button>
          </div>
          <div>
            <input value={exportPath} onChange={(e) => setExportPath(e.target.value)} placeholder="Export path" />
            <button onClick={exportQuestions}>Export</button>
          </div>
        </div>
        <button onClick={() => onSelect(null)}>New Question</button>
        <ul>
          {sortedQuestions.map((q) => (
            <li key={q.id}>
              <a href="#" onClick={(e) => { e.preventDefault(); onSelect(q); }}>
                {q.stem} {q.topic ? `(${q.topic})` : ''}
              </a>
              <button onClick={() => cloneQuestion(q)}>Clone</button>
              <button onClick={() => deleteQuestion(q)}>Delete</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
