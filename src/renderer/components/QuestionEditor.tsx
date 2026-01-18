'use client';

import React, { useEffect, useState } from 'react';
import MarkdownIt from 'markdown-it';
import { Question } from '../../models';
import { lintLatex } from '../../utils/latexLint';

const md = new MarkdownIt();

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

  useEffect(() => {
    setDraft(question || ({ id: '', type: 'multiple_choice', stem: '' } as any));
    setError(null);
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
    window.profTestAPI.getActiveProject().then((res: any) => {
      if (res && res.active) {
        setActiveProject(res.active);
        window.profTestAPI.listMedia(res.active).then((list: any) => {
          setMediaList(list?.files || list || []);
        });
      } else {
        setActiveProject(null);
        setMediaList([]);
      }
    });
  }, []);

  function updateField<K extends keyof Question>(key: K, value: Question[K]) {
    setDraft((d) => ({ ...d, [key]: value } as Question));
  }

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
      const res = await window.profTestAPI.saveMedia(activeProject, file.name, base64);
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
        await window.profTestAPI.addQuestion(draft);
      } else {
        await window.profTestAPI.updateQuestion(draft.id, draft);
      }
      onSaved();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }


  const latexErrors = lintLatex(draft.stem || '');

  return (
    <div style={{ flex: 1, display: 'flex', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <h2>{draft.id ? 'Edit Question' : 'New Question'}</h2>
        {error && <div style={{ color: 'red' }}>{error}</div>}
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
        <div>
          <label>Difficulty</label>
          <input
            type="number"
            min={1}
            max={5}
            value={draft.difficulty ?? ''}
            onChange={(e) => updateField('difficulty', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <div>
          <label>Estimated Time (min)</label>
          <input
            type="number"
            min={0}
            value={draft.estimated_time_min ?? ''}
            onChange={(e) => updateField('estimated_time_min', e.target.value ? Number(e.target.value) : undefined)}
          />
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
          <div>
            <h3>Choices</h3>
            <button onClick={addChoice}>Add Choice</button>
            <ul>
              {(draft.choices || []).map((c: any, idx: number) => (
                <li key={c.id}>
                  <input value={c.text} onChange={(e) => updateChoice(idx, { text: e.target.value })} />
                  <label>
                    <input type="checkbox" checked={!!c.is_correct} onChange={(e) => updateChoice(idx, { is_correct: e.target.checked })} />
                    correct
                  </label>
                  <select
                    value={c.media_ref_id || ''}
                    onChange={(e) => updateChoice(idx, { media_ref_id: e.target.value || undefined })}
                  >
                    <option value="">No media</option>
                    {(draft.media_refs || []).map((m) => (
                      <option key={m.id} value={m.id}>{m.path}</option>
                    ))}
                  </select>
                  <button onClick={() => removeChoice(idx)}>Remove</button>
                </li>
              ))}
            </ul>
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

        <div>
          <h3>Media</h3>
          {!activeProject && <div style={{ color: 'red' }}>No active project selected</div>}
          <div>
            <label>Alt Text</label>
            <input value={mediaAlt} onChange={(e) => setMediaAlt(e.target.value)} />
          </div>
          <div>
            <label>Caption</label>
            <input value={mediaCaption} onChange={(e) => setMediaCaption(e.target.value)} />
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
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e.target.files ? e.target.files[0] : null)}
            />
          </div>
          <div>
            <select value={selectedMedia} onChange={(e) => setSelectedMedia(e.target.value)}>
              <option value="">Attach existing media</option>
              {mediaList.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <button
              onClick={() => {
                if (selectedMedia) addMediaRef(selectedMedia);
              }}
            >
              Attach
            </button>
          </div>
          <ul>
            {(draft.media_refs || []).map((m) => (
              <li key={m.id}>
                {m.path} ({m.placement})
              </li>
            ))}
          </ul>
        </div>

        {draft.type === 'short_answer' && (
          <div>
            <label>Expected Answer</label>
            <textarea value={draft.solution || ''} onChange={(e) => updateField('solution', e.target.value)} />
          </div>
        )}
        {draft.type !== 'short_answer' && (
          <div>
            <label>Solution</label>
            <textarea value={draft.solution || ''} onChange={(e) => updateField('solution', e.target.value)} />
          </div>
        )}
        <div>
          <label>Explanation</label>
          <textarea value={draft.explanation || ''} onChange={(e) => updateField('explanation', e.target.value)} />
        </div>

        <div>
          <button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
      <div style={{ width: 400, borderLeft: '1px solid #ddd', paddingLeft: 12 }}>
        <h3>Preview</h3>
        {latexErrors.length > 0 && (
          <div style={{ color: 'red' }}>
            <strong>LaTeX Issues</strong>
            <ul>
              {latexErrors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}
        <div dangerouslySetInnerHTML={{ __html: md.render(draft.stem || '') }} />
      </div>
    </div>
  );
}
