'use client';

import { useState } from 'react';
import { t } from '../../i18n';
import { QuestionList } from '../QuestionList';
import { QuestionEditor } from '../QuestionEditor';

interface Props {
  refreshKey: number;
  onRefresh: () => void;
}

export function QuestionBankScreen({ refreshKey, onRefresh }: Props) {
  const [selected, setSelected] = useState<any | null>(null);

  return (
    <div className="fade-in" style={{ display: 'flex', gap: 'var(--space-md)', height: '100%', overflow: 'hidden' }}>
      {/* Question List Panel */}
      <div className="panel" style={{ flex: '0 0 420px', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <QuestionList onSelect={setSelected} key={refreshKey} />
      </div>

      {/* Question Editor Panel */}
      <div className="panel" style={{ flex: 1, overflow: 'auto' }}>
        {selected ? (
          <QuestionEditor
            question={selected}
            onSaved={() => {
              onRefresh();
              setSelected(null);
            }}
          />
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 'var(--space-md)',
          }}>
            <span style={{ fontSize: '48px', opacity: 0.3 }}>{'\u2630'}</span>
            <p className="text-secondary">{t('questions.selectOrCreate')}</p>
            <button
              className="btn-primary"
              onClick={() => setSelected({
                id: '',
                type: 'multiple_choice',
                stem: '',
                choices: [
                  { id: 'c1', text: '', is_correct: true },
                  { id: 'c2', text: '', is_correct: false },
                ],
              })}
            >
              {t('questions.newQuestion')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
