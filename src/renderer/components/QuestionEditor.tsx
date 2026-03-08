'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MarkdownIt from 'markdown-it';
import markdownItKatex from 'markdown-it-katex';
import { Question } from '../../models';
import { lintLatex } from '../../utils/latexLint';
import { api } from '../lib/api';

const md = new MarkdownIt({ html: false }).use(markdownItKatex);

export function QuestionEditor({ question, onSaved }: { question: Question | null; onSaved: () => void }) {
  const [draft, setDraft] = useState<Question>(question || { id: '', type: 'multiple_choice', stem: '' } as any);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [mediaList, setMediaList] = useState<string[]>([]);
  const [mediaAlt, setMediaAlt] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');
  const [mediaPlacement, setMediaPlacement] = useState<'above' | 'below' | 'inline' | 'per_choice'>('below');
  const [selectedMedia, setSelectedMedia] = useState('');
  const [trueFalseValue, setTrueFalseValue] = useState<'true' | 'false'>('true');
  const [dirty, setDirty] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<string | null>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    setDraft(question || ({ id: '', type: 'multiple_choice', stem: '' } as any));
    setError(null);
    setDirty(false);
    setLastAutoSave(null);
  }, [question]);

  useEffect(() => {
    if (draft.type === 'true_false' && draft.choices && draft.choices.length === 2) {
      const correct = draft.choices.find((c) => c.is_correct);
      if (correct) {
        setTrueFalseValue(correct.text.toLowerCase() === 'false' ? 'false' : 'true');
      }
    }
  }, [draft.type, draft.choices]);

  useEffect(() => {
    api.getActiveProject().then((res: any) => {
      if (res && res.active) {
        setActiveProject(res.active);
        api.listMedia(res.active).then((list: any) => {
          setMediaList(list?.files || list || []);
        });
      } else {
        setActiveProject(null);
        setMediaList([]);
      }
    });
  }, []);

  const updateField = useCallback(<K extends keyof Question>(key: K, value: Question[K]) => {
    setDraft((d) => ({ ...d, [key]: value } as Question));
    setDirty(true);
  }, []);

  function ensureChoices() {
    if (!draft.choices) updateField('choices', [] as any);
  }

  function addChoice() {
    ensureChoices();
    const id = 'c-' + Math.random().toString(36).slice(2, 9);
    const next = [ ...(draft.choices || []), { id, text: '', is_correct: false } as any];
    updateField('choices', next as any);
  }

  function updateChoice(idx: number, patch: Partial<any>) {
    const next = (draft.choices || []).slice();
    next[idx] = { ...next[idx], ...patch };
    updateField('choices', next as any);
  }

  function removeChoice(idx: number) {
    const next = (draft.choices || []).slice();
    next.splice(idx, 1);
    updateField('choices', next as any);
  }

  function addMediaRef(filename: string) {
    const next = (draft.media_refs || []).slice();
    const id = 'm-' + Math.random().toString(36).slice(2, 9);
    next.push({
      id,
      path: filename,
      alt_text: mediaAlt || undefined,
      caption: mediaCaption || undefined,
      placement: mediaPlacement,
    });
    updateField('media_refs', next as any);
  }

  async function handleFileUpload(file: File | null) {
    if (!file) return;
    if (!activeProject) {
      setError('Select or create a project before uploading media');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const res = await api.saveMedia(activeProject, file.name, base64);
      if (!res.ok) {
        setError(res.error || 'Failed to save media');
        return;
      }
      const savedPath = res.path as string;
      const filename = savedPath.split(/[/\\\\]/).pop() || file.name;
      setMediaList((prev) => Array.from(new Set([...prev, filename])));
      addMediaRef(filename);
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    setError(null);
    if (!draft.stem || draft.stem.trim() === '') {
      setError('Stem is required');
      return;
    }
    if (draft.type === 'multiple_choice') {
      const choices = draft.choices || [];
      if (choices.length < 2) {
        setError('Multiple choice questions require at least 2 choices');
        return;
      }
      if (!choices.some((c: any) => c.is_correct)) {
        setError('At least one correct choice is required');
        return;
      }
    }
    if (draft.type === 'true_false') {
      const choices = [
        { id: 'true', text: 'True', is_correct: trueFalseValue === 'true' },
        { id: 'false', text: 'False', is_correct: trueFalseValue === 'false' },
      ];
      draft.choices = choices as any;
    }
    setSaving(true);
    try {
      if (!draft.id) {
        draft.id = 'q-' + Math.random().toString(36).slice(2, 9);
        await api.addQuestion(draft);
      } else {
        await api.updateQuestion(draft.id, draft);
      }
      setDirty(false);
      onSaved();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  // Autosave every 30 seconds when dirty and question has an id
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    if (!draft.id || !dirty) return;
    const timer = setInterval(async () => {
      if (!dirtyRef.current) return;
      const currentDraft = draftRef.current;
      try {
        await api.updateQuestion(currentDraft.id, currentDraft);
        setDirty(false);
        const now = new Date().toLocaleTimeString();
        setLastAutoSave(now);
      } catch {
        // autosave failed silently; user can still manually save
      }
    }, 30_000);
    return () => clearInterval(timer);
  }, [draft.id, dirty]);

  const previewSource = useMemo(() => {
    const parts = [draft.stem || ''];
    if (draft.solution) {
      parts.push('\n\n**Solution**\n\n' + draft.solution);
    }
    if (draft.explanation) {
      parts.push('\n\n**Explanation**\n\n' + draft.explanation);
    }
    return parts.join('\n');
  }, [draft.stem, draft.solution, draft.explanation]);

  const latexErrors = useMemo(() => lintLatex(previewSource), [previewSource]);
  const previewHtml = useMemo(() => md.render(previewSource), [previewSource]);

  return (
    <div className="flex gap-md fade-in" style={{ flex: 1 }}>
      {/* Left editor panel */}
      <div className="panel flex flex-col gap-md overflow-auto" style={{ flex: 1 }}>
        <div className="flex items-center justify-between">
          <h2>{draft.id ? 'Edit Question' : 'New Question'}</h2>
          <div className="flex items-center gap-sm">
            {dirty && <span className="text-xs text-tertiary">(unsaved changes)</span>}
            {lastAutoSave && !dirty && <span className="text-xs text-tertiary">Auto-saved {lastAutoSave}</span>}
          </div>
        </div>

        {error && <div className="text-danger text-sm mb-sm">{error}</div>}

        {/* Basic info section */}
        <div className="glass-card flex flex-col gap-sm">
          <h3>Basic Info</h3>
          <div>
            <label>Stem</label>
            <textarea value={draft.stem || ''} onChange={(e) => updateField('stem', e.target.value)} />
          </div>
          <div>
            <label>Subject</label>
            <input value={draft.subject || ''} onChange={(e) => updateField('subject', e.target.value)} />
          </div>
          <div>
            <label>Topic</label>
            <input value={draft.topic || ''} onChange={(e) => updateField('topic', e.target.value)} />
          </div>
          <div>
            <label>Subtopic</label>
            <input value={draft.subtopic || ''} onChange={(e) => updateField('subtopic', e.target.value)} />
          </div>
        </div>

        {/* Metadata section */}
        <div className="glass-card flex flex-col gap-sm">
          <h3>Metadata</h3>
          <div className="flex gap-md">
            <div className="flex-1">
              <label>Difficulty</label>
              <input
                type="number"
                min={1}
                max={5}
                value={draft.difficulty ?? ''}
                onChange={(e) => updateField('difficulty', e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
            <div className="flex-1">
              <label>Estimated Time (min)</label>
              <input
                type="number"
                min={0}
                value={draft.estimated_time_min ?? ''}
                onChange={(e) => updateField('estimated_time_min', e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
          </div>
          <div>
            <label>Author</label>
            <input value={draft.author || ''} onChange={(e) => updateField('author', e.target.value)} />
          </div>
          <div>
            <label>Tags (comma-separated)</label>
            <input
              value={(draft.tags || []).join(', ')}
              onChange={(e) =>
                updateField(
                  'tags',
                  e.target.value
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter((tag) => tag.length > 0)
                )
              }
            />
          </div>
        </div>

        {/* Type & Choices section */}
        <div className="glass-card flex flex-col gap-sm">
          <h3>Type &amp; Choices</h3>
          <div>
            <label>Type</label>
            <select value={draft.type} onChange={(e) => updateField('type', e.target.value as any)}>
              <option value="multiple_choice">Multiple Choice</option>
              <option value="multiple_select">Multiple Select</option>
              <option value="short_answer">Short Answer</option>
              <option value="true_false">True/False</option>
              <option value="matching">Matching</option>
            </select>
          </div>

          {(draft.type === 'multiple_choice' || draft.type === 'multiple_select') && (
            <div className="flex flex-col gap-sm">
              <div className="flex items-center justify-between">
                <label className="mb-sm">Choices</label>
                <button className="btn-sm" onClick={addChoice}>Add Choice</button>
              </div>
              {(draft.choices || []).map((c: any, idx: number) => (
                <div key={c.id} className="glass-card flex items-center gap-sm">
                  <input
                    className="flex-1"
                    value={c.text}
                    onChange={(e) => updateChoice(idx, { text: e.target.value })}
                  />
                  <label className="flex items-center gap-xs" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>
                    <input
                      type="checkbox"
                      checked={!!c.is_correct}
                      onChange={(e) => updateChoice(idx, { is_correct: e.target.checked })}
                      style={{ width: 'auto' }}
                    />
                    correct
                  </label>
                  <select
                    value={c.media_ref_id || ''}
                    onChange={(e) => updateChoice(idx, { media_ref_id: e.target.value || undefined })}
                    style={{ width: 'auto', minWidth: '120px' }}
                  >
                    <option value="">No media</option>
                    {(draft.media_refs || []).map((m) => (
                      <option key={m.id} value={m.id}>{m.path}</option>
                    ))}
                  </select>
                  <button className="btn-danger btn-sm" onClick={() => removeChoice(idx)}>Remove</button>
                </div>
              ))}
            </div>
          )}

          {draft.type === 'true_false' && (
            <div>
              <label>Correct Answer</label>
              <select value={trueFalseValue} onChange={(e) => setTrueFalseValue(e.target.value as any)}>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            </div>
          )}
        </div>

        {/* Media section */}
        <div className="glass-card flex flex-col gap-sm">
          <h3>Media</h3>
          {!activeProject && <div className="text-danger text-sm">No active project selected</div>}
          <div className="flex gap-md">
            <div className="flex-1">
              <label>Alt Text</label>
              <input value={mediaAlt} onChange={(e) => setMediaAlt(e.target.value)} />
            </div>
            <div className="flex-1">
              <label>Caption</label>
              <input value={mediaCaption} onChange={(e) => setMediaCaption(e.target.value)} />
            </div>
          </div>
          <div>
            <label>Placement</label>
            <select value={mediaPlacement} onChange={(e) => setMediaPlacement(e.target.value as any)}>
              <option value="above">Above</option>
              <option value="below">Below</option>
              <option value="inline">Inline</option>
              <option value="per_choice">Per Choice</option>
            </select>
          </div>
          <div>
            <label>Upload File</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e.target.files ? e.target.files[0] : null)}
            />
          </div>
          <div className="flex items-center gap-sm">
            <select className="flex-1" value={selectedMedia} onChange={(e) => setSelectedMedia(e.target.value)}>
              <option value="">Attach existing media</option>
              {mediaList.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <button
              className="btn-sm"
              onClick={() => {
                if (selectedMedia) addMediaRef(selectedMedia);
              }}
            >
              Attach
            </button>
          </div>
          {(draft.media_refs || []).length > 0 && (
            <div className="flex flex-col gap-xs">
              {(draft.media_refs || []).map((m) => (
                <div key={m.id} className="badge">
                  {m.path} ({m.placement})
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Solution & explanation section */}
        <div className="glass-card flex flex-col gap-sm">
          <h3>Solution &amp; Explanation</h3>
          {draft.type === 'short_answer' ? (
            <div>
              <label>Expected Answer</label>
              <textarea value={draft.solution || ''} onChange={(e) => updateField('solution', e.target.value)} />
            </div>
          ) : (
            <div>
              <label>Solution</label>
              <textarea value={draft.solution || ''} onChange={(e) => updateField('solution', e.target.value)} />
            </div>
          )}
          <div>
            <label>Explanation</label>
            <textarea value={draft.explanation || ''} onChange={(e) => updateField('explanation', e.target.value)} />
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-sm">
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          {dirty && <span className="text-xs text-warning">Unsaved changes</span>}
        </div>
      </div>

      {/* Right preview panel */}
      <div className="panel overflow-auto" style={{ width: '400px', minWidth: '400px' }}>
        <h3>Preview</h3>
        {latexErrors.length > 0 && (
          <div className="glass-card mb-md">
            <strong className="text-danger">LaTeX Issues</strong>
            <ul className="flex flex-col gap-xs mt-md">
              {latexErrors.map((err) => (
                <li key={err} className="text-danger text-sm">{err}</li>
              ))}
            </ul>
          </div>
        )}
        <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
      </div>
    </div>
  );
}
