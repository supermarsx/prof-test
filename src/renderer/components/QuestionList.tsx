'use client';

import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Question } from '../../models';

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
    <li>
      <a href="#" onClick={(e) => { e.preventDefault(); onSelect(question); }}>
        {question.stem} {question.topic ? `(${question.topic})` : ''}
      </a>
      <button onClick={() => onClone(question)}>Clone</button>
      <button onClick={() => onDelete(question)}>Delete</button>
    </li>
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

  useEffect(() => {
    window.profTestAPI.listQuestions().then((q: Question[]) => setAllQuestions(q || []));
  }, []);

  const refresh = useCallback(async () => {
    const res = await window.profTestAPI.listQuestions();
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
    setAllQuestions((prev) => [...prev, next as Question]);
  };

  const deleteQuestion = async (q: Question) => {
    if (!confirm(`Delete question ${q.id}?`)) return;
    await window.profTestAPI.removeQuestion(q.id);
    setAllQuestions((prev) => prev.filter((item) => item.id !== q.id));
  };

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ width: 300 }}>
        <div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" />
        </div>
        <div>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Filter subject" />
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Filter topic" />
          <input value={subtopic} onChange={(e) => setSubtopic(e.target.value)} placeholder="Filter subtopic" />
          <input value={difficulty} onChange={(e) => setDifficulty(e.target.value)} placeholder="Filter difficulty" />
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Filter tag" />
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Filter author" />
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
          {filteredQuestions.map((q) => (
            <QuestionRow
              key={q.id}
              question={q}
              onSelect={(item) => onSelect(item)}
              onClone={cloneQuestion}
              onDelete={deleteQuestion}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
