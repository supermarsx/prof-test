import React, { useEffect, useState } from 'react';
import { Question } from '../../models';

export function QuestionList({ onSelect }: { onSelect: (q: Question | null) => void }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    window.profTestAPI.listQuestions().then((q: Question[]) => setQuestions(q || []));
  }, []);

  const doSearch = async () => {
    const res = await window.profTestAPI.searchQuestions(query);
    setQuestions(res || []);
  };

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ width: 300 }}>
        <div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" />
          <button onClick={doSearch}>Search</button>
        </div>
        <button onClick={() => onSelect(null)}>New Question</button>
        <ul>
          {questions.map((q) => (
            <li key={q.id}>
              <a href="#" onClick={(e) => { e.preventDefault(); onSelect(q); }}>{q.stem}</a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
