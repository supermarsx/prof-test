import React, { useState } from 'react';
import { QuestionList } from './components/QuestionList';
import { QuestionEditor } from './components/QuestionEditor';

export function App() {
  const [selected, setSelected] = useState<any | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div style={{ display: 'flex', padding: 20 }}>
      <QuestionList onSelect={(q) => setSelected(q)} key={refreshKey} />
      <QuestionEditor question={selected} onSaved={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}
