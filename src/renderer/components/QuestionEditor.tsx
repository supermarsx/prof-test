import React, { useEffect, useState } from 'react';
import { Question } from '../../models';

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

  async function save() {
    setError(null);
    if (!draft.stem || draft.stem.trim() === '') {
      setError('Stem is required');
      return;
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
      <div>
        <button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </div>
  );
}
