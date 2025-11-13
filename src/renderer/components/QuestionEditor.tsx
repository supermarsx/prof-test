import React, { useEffect, useState } from 'react';
import MarkdownIt from 'markdown-it';
import { Question } from '../../models';

const md = new MarkdownIt();

export function QuestionEditor({ question, onSaved }: { question: Question | null; onSaved: () => void }) {
  const [draft, setDraft] = useState<Question>(question || { id: '', type: 'multiple_choice', stem: '' } as any);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(question || ({ id: '', type: 'multiple_choice', stem: '' } as any));
    setError(null);
  }, [question]);

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
          <label>Type</label>
          <select value={draft.type} onChange={(e) => updateField('type', e.target.value as any)}>
            <option value="multiple_choice">Multiple Choice</option>
            <option value="short_answer">Short Answer</option>
            <option value="true_false">True/False</option>
          </select>
        </div>

        {draft.type === 'multiple_choice' && (
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
                  <button onClick={() => removeChoice(idx)}>Remove</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
      <div style={{ width: 400, borderLeft: '1px solid #ddd', paddingLeft: 12 }}>
        <h3>Preview</h3>
        <div dangerouslySetInnerHTML={{ __html: md.render(draft.stem || '') }} />
      </div>
    </div>
  );
}
