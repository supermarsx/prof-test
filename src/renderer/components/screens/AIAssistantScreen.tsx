'use client';

import { useState, useCallback } from 'react';
import { t } from '../../i18n';
import { api } from '../../lib/api';

interface Props {
  refreshKey: number;
  onRefresh: () => void;
}

type AIMode = 'generate' | 'distractors' | 'rephrase' | 'solution' | 'autoBuilder';

interface GeneratedQuestion {
  stem: string;
  type: string;
  choices?: { text: string; is_correct?: boolean }[];
  solution?: string;
  difficulty?: number;
  topic?: string;
}

export function AIAssistantScreen({ refreshKey, onRefresh }: Props) {
  const [mode, setMode] = useState<AIMode>('generate');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Generate Questions state
  const [genTopic, setGenTopic] = useState('');
  const [genSubject, setGenSubject] = useState('');
  const [genType, setGenType] = useState('multiple_choice');
  const [genDifficulty, setGenDifficulty] = useState(3);
  const [genCount, setGenCount] = useState(5);
  const [genResults, setGenResults] = useState<GeneratedQuestion[]>([]);

  // Distractors state
  const [distStem, setDistStem] = useState('');
  const [distCorrect, setDistCorrect] = useState('');
  const [distCount, setDistCount] = useState(3);
  const [distResults, setDistResults] = useState<string[]>([]);

  // Rephrase state
  const [rephraseOriginal, setRephraseOriginal] = useState('');
  const [rephraseTone, setRephraseTone] = useState('formal');
  const [rephraseResult, setRephraseResult] = useState('');

  // Solution state
  const [solutionStem, setSolutionStem] = useState('');
  const [solutionChoices, setSolutionChoices] = useState('');
  const [solutionResult, setSolutionResult] = useState('');

  // Auto Builder state
  const [autoSubject, setAutoSubject] = useState('');
  const [autoTopics, setAutoTopics] = useState('');
  const [autoCount, setAutoCount] = useState(10);
  const [autoDiffMix, setAutoDiffMix] = useState('easy:0.3,medium:0.5,hard:0.2');
  const [autoResults, setAutoResults] = useState<GeneratedQuestion[]>([]);

  // Selected results for saving to bank
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  // Editing state: index of question being edited inline, null if none
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  // Save confirmation dialog
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  const clearResults = () => {
    setGenResults([]);
    setDistResults([]);
    setRephraseResult('');
    setSolutionResult('');
    setAutoResults([]);
    setSelectedIndices(new Set());
    setEditingIdx(null);
    setShowSaveConfirm(false);
    setStatus(null);
  };

  /** Update a generated question in-place */
  const updateQuestion = (idx: number, patch: Partial<GeneratedQuestion>) => {
    const setter = mode === 'generate' ? setGenResults : setAutoResults;
    setter(prev => prev.map((q, i) => i === idx ? { ...q, ...patch } : q));
  };

  /** Remove a question from results (reject) */
  const removeQuestion = (idx: number) => {
    const setter = mode === 'generate' ? setGenResults : setAutoResults;
    setter(prev => prev.filter((_, i) => i !== idx));
    // Adjust selectedIndices
    setSelectedIndices(prev => {
      const next = new Set<number>();
      for (const si of prev) {
        if (si < idx) next.add(si);
        else if (si > idx) next.add(si - 1);
        // si === idx is removed
      }
      return next;
    });
    if (editingIdx === idx) setEditingIdx(null);
    else if (editingIdx !== null && editingIdx > idx) setEditingIdx(editingIdx - 1);
  };

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await api.aiGenerateQuestions({
        topic: genTopic,
        subject: genSubject,
        questionType: genType,
        difficulty: genDifficulty,
        numberOfQuestions: genCount,
      });
      if (res?.ok && Array.isArray(res.data)) {
        setGenResults(res.data);
        setSelectedIndices(new Set());
        setStatus(t('ai.generatedCount', { count: res.data.length }));
      } else {
        setStatus(res?.error || t('ai.failedGenerate'));
      }
    } catch (e) {
      setStatus(String(e));
    }
    setLoading(false);
  }, [genTopic, genSubject, genType, genDifficulty, genCount]);

  const handleDistractors = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await api.aiGenerateDistractors({
        stem: distStem,
        correctAnswer: distCorrect,
        count: distCount,
      });
      if (res?.ok && Array.isArray(res.data)) {
        setDistResults(res.data);
        setStatus(t('ai.generatedDistractorsCount', { count: res.data.length }));
      } else {
        setStatus(res?.error || t('ai.failedDistractors'));
      }
    } catch (e) {
      setStatus(String(e));
    }
    setLoading(false);
  }, [distStem, distCorrect, distCount]);

  const handleRephrase = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await api.aiRephraseQuestion({
        stem: rephraseOriginal,
        tone: rephraseTone,
      });
      if (res?.ok && res.data) {
        setRephraseResult(typeof res.data === 'string' ? res.data : String(res.data));
        setStatus(t('ai.questionRephrased'));
      } else {
        setStatus(res?.error || t('ai.failedRephrase'));
      }
    } catch (e) {
      setStatus(String(e));
    }
    setLoading(false);
  }, [rephraseOriginal, rephraseTone]);

  const handleSolution = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const choices = solutionChoices
        .split('\n')
        .map(c => c.trim())
        .filter(Boolean)
        .map((text, i) => ({ id: `c${i}`, text }));
      const res = await api.aiGenerateSolution({
        stem: solutionStem,
        type: 'multiple_choice',
        choices,
      });
      if (res?.ok && res.data) {
        setSolutionResult(typeof res.data === 'string' ? res.data : String(res.data));
        setStatus(t('ai.solutionGenerated'));
      } else {
        setStatus(res?.error || t('ai.failedSolution'));
      }
    } catch (e) {
      setStatus(String(e));
    }
    setLoading(false);
  }, [solutionStem, solutionChoices]);

  const handleAutoBuilder = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const diffMix: Record<string, number> = {};
      autoDiffMix.split(',').forEach(pair => {
        const [k, v] = pair.split(':');
        if (k && v) diffMix[k.trim()] = parseFloat(v.trim());
      });

      const res = await api.aiBuildTestProposal({
        subject: autoSubject,
        topics: autoTopics.split(',').map(t => t.trim()).filter(Boolean),
        totalQuestions: autoCount,
        difficultyMix: Object.keys(diffMix).length ? diffMix : undefined,
      });
      if (res?.ok && Array.isArray(res.data)) {
        setAutoResults(res.data);
        setSelectedIndices(new Set());
        setStatus(t('ai.proposedQuestions', { count: res.data.length }));
      } else {
        setStatus(res?.error || t('ai.failedBuildProposal'));
      }
    } catch (e) {
      setStatus(String(e));
    }
    setLoading(false);
  }, [autoSubject, autoTopics, autoCount, autoDiffMix]);

  const toggleSelect = (idx: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAll = (questions: GeneratedQuestion[]) => {
    setSelectedIndices(new Set(questions.map((_, i) => i)));
  };

  const requestSave = (questions: GeneratedQuestion[]) => {
    if (selectedIndices.size === 0) {
      setStatus(t('ai.selectToSave'));
      return;
    }
    setShowSaveConfirm(true);
  };

  const confirmSave = async (questions: GeneratedQuestion[]) => {
    setShowSaveConfirm(false);
    setLoading(true);
    let saved = 0;
    for (const idx of selectedIndices) {
      const q = questions[idx];
      if (!q) continue;
      try {
        const res = await api.addQuestion({
          id: `q-ai-${Date.now()}-${idx}`,
           type: (q.type || 'multiple_choice') as import('../../../models').QuestionType,
          stem: q.stem,
          choices: q.choices?.map((c, ci) => ({
            id: `c-${Date.now()}-${ci}`,
            text: c.text,
            is_correct: c.is_correct,
          })),
          solution: q.solution,
          difficulty: q.difficulty,
          topic: q.topic,
          tags: ['ai-generated'],
          author: 'AI Assistant',
        });
        if (res?.ok) saved++;
      } catch {}
    }
    setStatus(t('ai.savedToBank', { count: saved }));
    setSelectedIndices(new Set());
    setEditingIdx(null);
    onRefresh();
    setLoading(false);
  };

  const modes: { id: AIMode; label: string; desc: string }[] = [
    { id: 'generate', label: t('ai.generateQuestions'), desc: t('ai.generateDesc') },
    { id: 'distractors', label: t('ai.distractors'), desc: t('ai.distractorsDesc') },
    { id: 'rephrase', label: t('ai.rephrase'), desc: t('ai.rephraseDesc') },
    { id: 'solution', label: t('ai.solution'), desc: t('ai.solutionDesc') },
    { id: 'autoBuilder', label: t('ai.autoBuilder'), desc: t('ai.autoBuilderDesc') },
  ];

  const renderQuestionCard = (q: GeneratedQuestion, idx: number, selected: boolean) => {
    const isEditing = editingIdx === idx;
    return (
      <div
        key={idx}
        className={`glass-card ${selected ? 'active' : ''}`}
        style={{
          padding: 'var(--space-md)',
          marginBottom: 'var(--space-sm)',
          borderColor: selected ? 'var(--accent)' : undefined,
        }}
      >
        {/* Header row: checkbox, badges, action buttons */}
        <div className="flex items-center gap-sm mb-sm">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => toggleSelect(idx)}
          />
          <span className="badge">{q.type?.replace('_', ' ') || 'MC'}</span>
          {q.difficulty && <span className={`badge difficulty-${q.difficulty}`}>D{q.difficulty}</span>}
          {q.topic && <span className="badge">{q.topic}</span>}
          <span style={{ flex: 1 }} />
          <button
            className="btn-ghost btn-sm"
            onClick={(e) => { e.stopPropagation(); setEditingIdx(isEditing ? null : idx); }}
            title={isEditing ? t('ai.doneEditing') : t('ai.editQuestion')}
            aria-label={isEditing ? t('ai.doneEditing') : t('ai.editQuestion')}
          >
            {isEditing ? '\u2713' : '\u270E'}
          </button>
          <button
            className="btn-ghost btn-sm btn-danger"
            onClick={(e) => { e.stopPropagation(); removeQuestion(idx); }}
            title={t('ai.rejectQuestion')}
            aria-label={t('ai.rejectQuestion')}
          >
            {'\u2715'}
          </button>
        </div>

        {/* Editable or display content */}
        {isEditing ? (
          <div className="flex-col gap-sm">
            <div>
              <label className="text-xs text-secondary">{t('editor.stem')}</label>
              <textarea
                rows={3}
                value={q.stem}
                onChange={e => updateQuestion(idx, { stem: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
            <div className="flex gap-sm">
              <div style={{ flex: 1 }}>
                <label className="text-xs text-secondary">{t('editor.topic')}</label>
                <input
                  value={q.topic || ''}
                  onChange={e => updateQuestion(idx, { topic: e.target.value })}
                />
              </div>
              <div style={{ width: '80px' }}>
                <label className="text-xs text-secondary">{t('editor.difficulty')}</label>
                <input
                  type="number" min={1} max={5}
                  value={q.difficulty || 3}
                  onChange={e => updateQuestion(idx, { difficulty: parseInt(e.target.value) || 3 })}
                />
              </div>
            </div>
            {q.choices && q.choices.length > 0 && (
              <div className="flex-col gap-xs">
                <label className="text-xs text-secondary">{t('editor.choices')}</label>
                {q.choices.map((c, ci) => (
                  <div key={ci} className="flex items-center gap-xs">
                    <input
                      type="checkbox"
                      checked={!!c.is_correct}
                      onChange={() => {
                        const newChoices = q.choices!.map((ch, chi) =>
                          chi === ci ? { ...ch, is_correct: !ch.is_correct } : ch
                        );
                        updateQuestion(idx, { choices: newChoices });
                      }}
                      title={t('editor.correct')}
                    />
                    <input
                      value={c.text}
                      onChange={e => {
                        const newChoices = q.choices!.map((ch, chi) =>
                          chi === ci ? { ...ch, text: e.target.value } : ch
                        );
                        updateQuestion(idx, { choices: newChoices });
                      }}
                      style={{ flex: 1 }}
                    />
                  </div>
                ))}
              </div>
            )}
            {q.solution !== undefined && (
              <div>
                <label className="text-xs text-secondary">{t('editor.solution')}</label>
                <textarea
                  rows={2}
                  value={q.solution || ''}
                  onChange={e => updateQuestion(idx, { solution: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>
        ) : (
          <>
            <p style={{ marginBottom: 'var(--space-sm)', whiteSpace: 'pre-wrap', cursor: 'pointer' }}
              onClick={() => toggleSelect(idx)}>
              {q.stem}
            </p>
            {q.choices && q.choices.length > 0 && (
              <div className="flex-col gap-xs" style={{ paddingLeft: 'var(--space-md)' }}>
                {q.choices.map((c, ci) => (
                  <div key={ci} className="flex items-center gap-xs text-sm">
                    <span style={{
                      color: c.is_correct ? 'var(--text-success)' : 'var(--text-secondary)',
                      fontWeight: c.is_correct ? 600 : 400,
                    }}>
                      {String.fromCharCode(65 + ci)}.
                    </span>
                    <span style={{
                      color: c.is_correct ? 'var(--text-success)' : 'var(--text-primary)',
                    }}>
                      {c.text}
                    </span>
                    {c.is_correct && <span className="badge badge-accent" style={{ fontSize: '10px' }}>{t('ai.correct')}</span>}
                  </div>
                ))}
              </div>
            )}
            {q.solution && (
              <div className="text-sm text-secondary" style={{ marginTop: 'var(--space-sm)', fontStyle: 'italic' }}>
                Solution: {q.solution}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const currentQuestions = mode === 'generate' ? genResults : mode === 'autoBuilder' ? autoResults : [];

  return (
    <div className="fade-in flex-col gap-md" style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Mode Tabs */}
      <div className="flex gap-sm flex-wrap" role="tablist" aria-label={t('ai.modesLabel')}>
        {modes.map(m => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            className={`glass-card ${mode === m.id ? 'active' : ''}`}
            style={{
              padding: 'var(--space-sm) var(--space-md)',
              cursor: 'pointer',
              textAlign: 'left',
              minWidth: '140px',
            }}
            onClick={() => { setMode(m.id); clearResults(); }}
          >
            <strong className="text-sm">{m.label}</strong>
            <div className="text-xs text-secondary">{m.desc}</div>
          </button>
        ))}
      </div>

      {status && (
        <div className="text-sm" style={{
          color: status.includes('Failed') || status.includes('error')
            ? 'var(--text-danger)'
            : 'var(--text-accent)',
        }}>
          {status}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-md)', flex: 1, overflow: 'hidden' }}>
        {/* Left panel: inputs */}
        <div className="panel" style={{ width: '340px', minWidth: '340px', overflow: 'auto' }}>
          {mode === 'generate' && (
            <div className="flex-col gap-sm">
              <h4>{t('ai.generateQuestions')}</h4>
              <div>
                <label>{t('ai.subject')}</label>
                <input value={genSubject} onChange={e => setGenSubject(e.target.value)} placeholder={t('ai.subjectPlaceholder')} />
              </div>
              <div>
                <label>{t('ai.topic')}</label>
                <input value={genTopic} onChange={e => setGenTopic(e.target.value)} placeholder={t('ai.topicPlaceholder')} />
              </div>
              <div>
                <label>{t('ai.questionType')}</label>
                <select value={genType} onChange={e => setGenType(e.target.value)}>
                  <option value="multiple_choice">{t('ai.multipleChoice')}</option>
                  <option value="multiple_select">{t('ai.multipleSelect')}</option>
                  <option value="short_answer">{t('ai.shortAnswer')}</option>
                  <option value="true_false">{t('ai.trueFalse')}</option>
                  <option value="matching">{t('ai.matching')}</option>
                </select>
              </div>
              <div>
                <label>{t('ai.difficulty')}</label>
                <input type="number" min={1} max={5} value={genDifficulty}
                  onChange={e => setGenDifficulty(parseInt(e.target.value) || 3)} />
              </div>
              <div>
                <label>{t('ai.count')}</label>
                <input type="number" min={1} max={50} value={genCount}
                  onChange={e => setGenCount(parseInt(e.target.value) || 5)} />
              </div>
              <button className="btn-primary" onClick={handleGenerate} disabled={loading || !genTopic.trim()}>
                {loading ? t('ai.generating') : t('ai.generateQuestions')}
              </button>
            </div>
          )}

          {mode === 'distractors' && (
            <div className="flex-col gap-sm">
              <h4>{t('ai.generateDistractors')}</h4>
              <div>
                <label>{t('ai.questionStem')}</label>
                <textarea rows={4} value={distStem} onChange={e => setDistStem(e.target.value)}
                  placeholder={t('ai.questionStemPlaceholder')} />
              </div>
              <div>
                <label>{t('ai.correctAnswer')}</label>
                <input value={distCorrect} onChange={e => setDistCorrect(e.target.value)} placeholder={t('ai.correctAnswerPlaceholder')} />
              </div>
              <div>
                <label>{t('ai.numberOfDistractors')}</label>
                <input type="number" min={1} max={10} value={distCount}
                  onChange={e => setDistCount(parseInt(e.target.value) || 3)} />
              </div>
              <button className="btn-primary" onClick={handleDistractors} disabled={loading || !distStem.trim()}>
                {loading ? t('ai.generating') : t('ai.generateDistractors')}
              </button>
            </div>
          )}

          {mode === 'rephrase' && (
            <div className="flex-col gap-sm">
              <h4>{t('ai.rephrase')}</h4>
              <div>
                <label>{t('ai.originalStem')}</label>
                <textarea rows={6} value={rephraseOriginal} onChange={e => setRephraseOriginal(e.target.value)}
                  placeholder={t('ai.originalStemPlaceholder')} />
              </div>
              <div>
                <label>{t('ai.tone')}</label>
                <select value={rephraseTone} onChange={e => setRephraseTone(e.target.value)}>
                  <option value="formal">{t('ai.formal')}</option>
                  <option value="simplified">{t('ai.simplified')}</option>
                  <option value="technical">{t('ai.technical')}</option>
                  <option value="conversational">{t('ai.conversational')}</option>
                </select>
              </div>
              <button className="btn-primary" onClick={handleRephrase} disabled={loading || !rephraseOriginal.trim()}>
                {loading ? t('ai.rephrasing') : t('ai.rephrase')}
              </button>
            </div>
          )}

          {mode === 'solution' && (
            <div className="flex-col gap-sm">
              <h4>{t('ai.generateSolution')}</h4>
              <div>
                <label>{t('ai.questionStem')}</label>
                <textarea rows={4} value={solutionStem} onChange={e => setSolutionStem(e.target.value)}
                  placeholder={t('ai.enterQuestion')} />
              </div>
              <div>
                <label>{t('ai.choicesPerLine')}</label>
                <textarea rows={6} value={solutionChoices} onChange={e => setSolutionChoices(e.target.value)}
                  placeholder={t('ai.choicesPlaceholder')} />
              </div>
              <button className="btn-primary" onClick={handleSolution} disabled={loading || !solutionStem.trim()}>
                {loading ? t('ai.generating') : t('ai.generateSolution')}
              </button>
            </div>
          )}

          {mode === 'autoBuilder' && (
            <div className="flex-col gap-sm">
              <h4>{t('ai.autoTestBuilder')}</h4>
              <p className="text-sm text-secondary">
                {t('ai.autoTestDesc')}
              </p>
              <div>
                <label>{t('ai.subject')}</label>
                <input value={autoSubject} onChange={e => setAutoSubject(e.target.value)} placeholder={t('ai.autoSubjectPlaceholder')} />
              </div>
              <div>
                <label>{t('ai.topics')}</label>
                <input value={autoTopics} onChange={e => setAutoTopics(e.target.value)}
                  placeholder={t('ai.topicsPlaceholder')} />
              </div>
              <div>
                <label>{t('ai.totalQuestions')}</label>
                <input type="number" min={1} max={100} value={autoCount}
                  onChange={e => setAutoCount(parseInt(e.target.value) || 10)} />
              </div>
              <div>
                <label>{t('ai.difficultyMix')}</label>
                <input value={autoDiffMix} onChange={e => setAutoDiffMix(e.target.value)}
                  placeholder={t('ai.difficultyMixPlaceholder')} />
              </div>
              <button className="btn-primary" onClick={handleAutoBuilder}
                disabled={loading || !autoSubject.trim()}>
                {loading ? t('ai.building') : t('ai.buildProposal')}
              </button>
            </div>
          )}
        </div>

        {/* Right panel: results */}
        <div className="panel" style={{ flex: 1, overflow: 'auto' }}>
          {/* Generate / Auto Builder results */}
          {(mode === 'generate' || mode === 'autoBuilder') && currentQuestions.length > 0 && (
            <div className="flex-col gap-sm">
              <div className="flex items-center justify-between">
                <h4>{t('ai.questionsGenerated', { count: currentQuestions.length })}</h4>
                <div className="flex gap-sm">
                  <button className="btn-sm" onClick={() => selectAll(currentQuestions)}>
                    {t('ai.selectAll')}
                  </button>
                  <button className="btn-sm" onClick={() => setSelectedIndices(new Set())}>
                    {t('ai.deselectAll')}
                  </button>
                  <button className="btn-primary btn-sm" onClick={() => requestSave(currentQuestions)}
                    disabled={loading || selectedIndices.size === 0}>
                    {t('ai.saveToBank', { count: selectedIndices.size })}
                  </button>
                </div>
              </div>
              <p className="text-sm text-secondary">
                {t('ai.reviewBeforeSave')}
              </p>
              {currentQuestions.map((q, idx) => renderQuestionCard(q, idx, selectedIndices.has(idx)))}

              {/* Save Confirmation Dialog */}
              {showSaveConfirm && (
                <div className="glass-card" style={{
                  padding: 'var(--space-lg)',
                  border: '2px solid var(--accent)',
                  marginTop: 'var(--space-md)',
                }}>
                  <h4 className="mb-sm">{t('ai.confirmSaveTitle')}</h4>
                  <p className="text-sm text-secondary mb-md">
                    {t('ai.confirmSaveDesc', { count: selectedIndices.size })}
                  </p>
                  <div className="flex gap-sm">
                    <button className="btn-primary" onClick={() => confirmSave(currentQuestions)} disabled={loading}>
                      {t('common.confirm')}
                    </button>
                    <button onClick={() => setShowSaveConfirm(false)}>
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Distractors results */}
          {mode === 'distractors' && distResults.length > 0 && (
            <div className="flex-col gap-sm">
              <h4>{t('ai.generatedDistractorsTitle')}</h4>
              <p className="text-sm text-secondary">
                {t('ai.copyDistractors')}
              </p>
              {distResults.map((d, i) => (
                <div key={i} className="glass-card" style={{ padding: 'var(--space-sm) var(--space-md)' }}>
                  <span className="text-secondary" style={{ marginRight: 'var(--space-sm)' }}>
                    {String.fromCharCode(65 + i)}.
                  </span>
                  {d}
                </div>
              ))}
            </div>
          )}

          {/* Rephrase result */}
          {mode === 'rephrase' && rephraseResult && (
            <div className="flex-col gap-sm">
              <h4>{t('ai.rephrasedQuestion')}</h4>
              <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
                <p style={{ whiteSpace: 'pre-wrap' }}>{rephraseResult}</p>
              </div>
              <p className="text-sm text-secondary">{t('ai.copyRephrase')}</p>
            </div>
          )}

          {/* Solution result */}
          {mode === 'solution' && solutionResult && (
            <div className="flex-col gap-sm">
              <h4>{t('ai.generatedSolution')}</h4>
              <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
                <pre style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--font-size-sm)',
                }}>
                  {solutionResult}
                </pre>
              </div>
              <p className="text-sm text-secondary">{t('ai.reviewSolution')}</p>
            </div>
          )}

          {/* Empty state */}
          {((mode === 'generate' && genResults.length === 0) ||
            (mode === 'autoBuilder' && autoResults.length === 0) ||
            (mode === 'distractors' && distResults.length === 0) ||
            (mode === 'rephrase' && !rephraseResult) ||
            (mode === 'solution' && !solutionResult)) && !loading && (
            <div className="flex-col items-center justify-center" style={{
              display: 'flex',
              flex: 1,
              gap: 'var(--space-md)',
              minHeight: '300px',
            }}>
              <span style={{ fontSize: '48px', opacity: 0.3 }}>{'\u2728'}</span>
              <p className="text-secondary">{t('ai.emptyStateTitle')}</p>
              <p className="text-sm text-tertiary">
                {t('ai.emptyStateDesc')}
              </p>
            </div>
          )}

          {loading && (
            <div className="flex-col items-center justify-center" style={{
              display: 'flex',
              flex: 1,
              gap: 'var(--space-md)',
              minHeight: '300px',
            }}>
              <div className="pulse" style={{ fontSize: '48px' }}>{'\u2728'}</div>
              <p className="text-secondary">{t('ai.thinking')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
