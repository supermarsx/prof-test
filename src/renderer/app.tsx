import React, { useState } from 'react';

export function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);

  const onSearch = async () => {
    const res = await (window as any).profTestAPI.searchQuestions(query);
    setResults(res || []);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>prof-test</h1>
      <div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions..." />
        <button onClick={onSearch}>Search</button>
      </div>
      <pre>{JSON.stringify(results, null, 2)}</pre>
    </div>
  );
}
