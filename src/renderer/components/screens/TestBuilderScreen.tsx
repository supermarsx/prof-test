'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { t } from '../../i18n';
import { api } from '../../lib/api';

interface Props {
  refreshKey: number;
  onRefresh: () => void;
}

interface Section {
  id: string;
  name: string;
  description: string;
  questions: QuestionRef[];
}

interface QuestionRef {
  question_id: string;
  stem: string;
  type: string;
  points: number;
  included: boolean;
  difficulty?: number;
  topic?: string;
}

export function TestBuilderScreen({ refreshKey, onRefresh }: Props) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<any | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [searchText, setSearchText] = useState('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [versions, setVersions] = useState<any[]>([]);
  const [versionCount, setVersionCount] = useState(4);
  const [latexPreview, setLatexPreview] = useState('');
  const [compileStatus, setCompileStatus] = useState('');
  const [showConstraints, setShowConstraints] = useState(false);
  const [constraints, setConstraints] = useState({
    totalQuestions: 10,
    topicDistribution: '',
    difficultyDistribution: 'easy:0.3,medium:0.5,hard:0.2',
    excludeTags: '',
  });
  const [solverResult, setSolverResult] = useState<any>(null);
  const [status, setStatus] = useState<string | null>(null);
  const dragItem = useRef<{ sectionIdx: number; questionIdx: number } | null>(null);
  const dragOverItem = useRef<{ sectionIdx: number; questionIdx: number } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [solving, setSolving] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  // Mark dirty when sections change
  const updateSections = useCallback((updater: (prev: Section[]) => Section[]) => {
    setSections(prev => {
      const next = updater(prev);
      setDirty(true);
      return next;
    });
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await api.listTestTemplates();
      if (res?.templates && Array.isArray(res.templates)) setTemplates(res.templates);
      else if (Array.isArray(res)) setTemplates(res);
    } catch {}
  }, []);

  const loadBank = useCallback(async () => {
    try {
      const qs = await api.listQuestions();
      setBankQuestions(qs || []);
    } catch {}
  }, []);

  useEffect(() => {
    loadTemplates();
    loadBank();
  }, [refreshKey, loadTemplates, loadBank]);

  // Autosave every 30 seconds when dirty
  useEffect(() => {
    if (!activeTemplate || !dirty) return;
    const timer = setInterval(async () => {
      try {
        const updated = {
          ...activeTemplate,
          sections: sections.map((s, i) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            order_index: i,
            question_references: s.questions.map(q => ({
              question_id: q.question_id,
              points: q.points,
              included: q.included,
            })),
          })),
        };
        await api.upsertTestTemplate(updated);
        setActiveTemplate(updated);
        setDirty(false);
        const now = new Date().toLocaleTimeString();
        setLastAutoSave(now);
      } catch {}
    }, 30_000);
    return () => clearInterval(timer);
  }, [activeTemplate, sections, dirty]);

  // Crash recovery: save to localStorage on change, restore on mount
  useEffect(() => {
    if (!activeTemplate || sections.length === 0) return;
    try {
      localStorage.setItem('proftest_autosave', JSON.stringify({
        templateId: activeTemplate.id,
        sections,
        timestamp: Date.now(),
      }));
    } catch {}
  }, [activeTemplate, sections]);

  useEffect(() => {
    // On mount, check for crash recovery data
    try {
      const saved = localStorage.getItem('proftest_autosave');
      if (saved) {
        const data = JSON.parse(saved);
        // Only recover if less than 1 hour old
        if (Date.now() - data.timestamp < 3600_000 && data.templateId && data.sections) {
          // We'll try to restore when a matching template is selected
          const matchingTemplate = templates.find(t => t.id === data.templateId);
          if (matchingTemplate && !activeTemplate) {
            setActiveTemplate(matchingTemplate);
            setSections(data.sections);
            setStatus(t('builder.recoveredWork'));
            localStorage.removeItem('proftest_autosave');
          }
        } else {
          localStorage.removeItem('proftest_autosave');
        }
      }
    } catch {}
  }, [templates]); // eslint-disable-line react-hooks/exhaustive-deps

  const createTemplate = async () => {
    if (!newTemplateName.trim()) return;
    setCreatingTemplate(true);
    try {
      const template = {
        id: `tmpl-${Date.now()}`,
        title: newTemplateName.trim(),
        sections: [],
        randomization_options: { shuffle_questions: true, shuffle_choices: true },
      };
      await api.upsertTestTemplate(template);
      setNewTemplateName('');
      await loadTemplates();
      setActiveTemplate(template);
      setSections([]);
    } finally {
      setCreatingTemplate(false);
    }
  };

  const selectTemplate = (tmpl: any) => {
    setActiveTemplate(tmpl);
    const secs = (tmpl.sections || []).map((s: any) => ({
      id: s.id,
      name: s.name || 'Section',
      description: s.description || '',
      questions: (s.question_references || []).map((ref: any) => {
        const q = bankQuestions.find(bq => bq.id === ref.question_id);
        return {
          question_id: ref.question_id,
          stem: q?.stem || '(unknown)',
          type: q?.type || '',
          points: ref.points || 1,
          included: ref.included !== false,
          difficulty: q?.difficulty,
          topic: q?.topic,
        };
      }),
    }));
    setSections(secs);
    setVersions([]);
    setLatexPreview('');
  };

  const addSection = () => {
    if (!newSectionName.trim()) return;
    updateSections(prev => [...prev, {
      id: `sec-${Date.now()}`,
      name: newSectionName.trim(),
      description: '',
      questions: [],
    }]);
    setNewSectionName('');
  };

  const removeSection = (idx: number) => {
    updateSections(prev => prev.filter((_, i) => i !== idx));
  };

  const moveSection = (from: number, dir: number) => {
    const to = from + dir;
    if (to < 0 || to >= sections.length) return;
    updateSections(prev => {
      const arr = [...prev];
      [arr[from], arr[to]] = [arr[to], arr[from]];
      return arr;
    });
  };

  // Drag from bank into a section
  const handleBankDragStart = (e: React.DragEvent, question: any) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      question_id: question.id,
      stem: question.stem,
      type: question.type,
      points: 1,
      included: true,
      difficulty: question.difficulty,
      topic: question.topic,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleSectionDrop = (e: React.DragEvent, sectionIdx: number) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (data) {
      try {
        const qRef = JSON.parse(data) as QuestionRef;
        updateSections(prev => {
          const updated = [...prev];
          // Don't add duplicates
          if (!updated[sectionIdx].questions.find(q => q.question_id === qRef.question_id)) {
            updated[sectionIdx] = {
              ...updated[sectionIdx],
              questions: [...updated[sectionIdx].questions, qRef],
            };
          }
          return updated;
        });
      } catch {}
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  // Internal DnD for reordering within/between sections
  const handleInternalDragStart = (sectionIdx: number, questionIdx: number) => {
    dragItem.current = { sectionIdx, questionIdx };
  };

  const handleInternalDragEnter = (sectionIdx: number, questionIdx: number) => {
    dragOverItem.current = { sectionIdx, questionIdx };
  };

  const handleInternalDragEnd = () => {
    if (!dragItem.current || !dragOverItem.current) return;
    const from = dragItem.current;
    const to = dragOverItem.current;
    
    updateSections(prev => {
      const updated = prev.map(s => ({ ...s, questions: [...s.questions] }));
      const [removed] = updated[from.sectionIdx].questions.splice(from.questionIdx, 1);
      updated[to.sectionIdx].questions.splice(to.questionIdx, 0, removed);
      return updated;
    });
    
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const removeQuestion = (sectionIdx: number, questionIdx: number) => {
    updateSections(prev => {
      const updated = [...prev];
      updated[sectionIdx] = {
        ...updated[sectionIdx],
        questions: updated[sectionIdx].questions.filter((_, i) => i !== questionIdx),
      };
      return updated;
    });
  };

  const moveQuestion = (sectionIdx: number, fromIdx: number, dir: number) => {
    const toIdx = fromIdx + dir;
    updateSections(prev => {
      const updated = prev.map(s => ({ ...s, questions: [...s.questions] }));
      const section = updated[sectionIdx];
      if (toIdx < 0 || toIdx >= section.questions.length) return prev;
      [section.questions[fromIdx], section.questions[toIdx]] = [section.questions[toIdx], section.questions[fromIdx]];
      return updated;
    });
  };

  const updateQuestionPoints = (sectionIdx: number, questionIdx: number, points: number) => {
    updateSections(prev => {
      const updated = [...prev];
      const qs = [...updated[sectionIdx].questions];
      qs[questionIdx] = { ...qs[questionIdx], points };
      updated[sectionIdx] = { ...updated[sectionIdx], questions: qs };
      return updated;
    });
  };

  const toggleQuestionIncluded = (sectionIdx: number, questionIdx: number) => {
    updateSections(prev => {
      const updated = [...prev];
      const qs = [...updated[sectionIdx].questions];
      qs[questionIdx] = { ...qs[questionIdx], included: !qs[questionIdx].included };
      updated[sectionIdx] = { ...updated[sectionIdx], questions: qs };
      return updated;
    });
  };

  const saveTemplate = async () => {
    if (!activeTemplate) return;
    setSaving(true);
    try {
      const updated = {
        ...activeTemplate,
        sections: sections.map((s, i) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          order_index: i,
          question_references: s.questions.map(q => ({
            question_id: q.question_id,
            points: q.points,
            included: q.included,
          })),
        })),
      };
      await api.upsertTestTemplate(updated);
      setActiveTemplate(updated);
      setDirty(false);
      localStorage.removeItem('proftest_autosave');
      setStatus(t('builder.templateSaved'));
      setTimeout(() => setStatus(null), 2000);
    } finally {
      setSaving(false);
    }
  };

  const generateVersions = async () => {
    const allQuestionIds = sections
      .flatMap(s => s.questions)
      .filter(q => q.included)
      .map(q => q.question_id);
    
    if (allQuestionIds.length === 0) {
      setStatus(t('builder.noQuestionsToGenerate'));
      return;
    }

    // Build section structure so shuffling happens within sections
    const sectionInputs = sections
      .filter(s => s.questions.some(q => q.included))
      .map(s => ({
        id: s.id,
        name: s.name,
        questionIds: s.questions.filter(q => q.included).map(q => q.question_id),
      }));

    setGenerating(true);
    try {
      const res = await api.generateTestVersions(allQuestionIds, {
        versions: versionCount,
        seed: Date.now(),
        sections: sectionInputs,
      });
       if (res?.ok && res.versions) {
        setVersions(res.versions);
        setStatus(t('builder.generatedVersions', { count: res.versions.length }));
      } else {
        setStatus(res?.error || t('builder.versionsFailed'));
      }
    } catch (e) {
      setStatus(String(e));
    } finally {
      setGenerating(false);
    }
  };

  const previewLatex = async () => {
    const allQuestions = sections
      .flatMap(s => s.questions)
      .filter(q => q.included)
      .map(q => bankQuestions.find(bq => bq.id === q.question_id))
      .filter(Boolean);
    
    const instances = sections
      .flatMap(s => s.questions)
      .filter(q => q.included)
      .map((q, i) => ({
        id: `inst-${i}`,
        base_question_id: q.question_id,
        points: q.points,
        order_index: i,
      }));

    setPreviewing(true);
    try {
      const res = await api.renderTestLatex(allQuestions, instances, {
        template: activeTemplate,
        versionLabel: 'A',
      });
      if (res?.ok) {
         setLatexPreview(res.latex ?? '');
      }
    } catch (e) {
      setStatus(String(e));
    } finally {
      setPreviewing(false);
    }
  };

  const compileLatex = async () => {
    if (!latexPreview) {
      await previewLatex();
    }
    setCompiling(true);
    setCompileStatus(t('builder.compiling'));
    try {
      const res = await api.compileLatex(
        latexPreview || '',
        `${activeTemplate?.title || 'test'}.tex`,
        {}
      );
      setCompileStatus(res?.ok ? `PDF created: ${res.pdfPath}` : `Error: ${res?.errors?.join(', ') || res?.error}`);
    } catch (e) {
      setCompileStatus(String(e));
    } finally {
      setCompiling(false);
    }
  };

  const runConstraintSolver = async () => {
    setSolving(true);
    try {
      const topicDist: Record<string, number> = {};
      if (constraints.topicDistribution.trim()) {
        constraints.topicDistribution.split(',').forEach(pair => {
          const [k, v] = pair.split(':');
          if (k && v) topicDist[k.trim()] = parseFloat(v.trim());
        });
      }

      const diffDist: Record<string, number> = {};
      if (constraints.difficultyDistribution.trim()) {
        constraints.difficultyDistribution.split(',').forEach(pair => {
          const [k, v] = pair.split(':');
          if (k && v) diffDist[k.trim()] = parseFloat(v.trim());
        });
      }

      const res = await api.solveConstraints({
        totalQuestions: constraints.totalQuestions,
        topicDistribution: Object.keys(topicDist).length ? topicDist : undefined,
        difficultyDistribution: Object.keys(diffDist).length ? diffDist : undefined,
        excludeTags: constraints.excludeTags ? constraints.excludeTags.split(',').map(t => t.trim()) : undefined,
      });

      setSolverResult(res);
      if (res?.ok && res.questions?.length) {
        // Auto-populate a section
        const autoSection: Section = {
          id: `sec-auto-${Date.now()}`,
          name: 'Auto-Generated Section',
          description: res.warnings?.length ? `Warnings: ${res.warnings.join('; ')}` : '',
          questions: res.questions.map((q: any) => ({
            question_id: q.id,
            stem: q.stem,
            type: q.type,
            points: 1,
            included: true,
            difficulty: q.difficulty,
            topic: q.topic,
          })),
        };
        updateSections(prev => [...prev, autoSection]);
        setStatus(t('builder.autoSelectedQuestions', { count: res.questions.length }));
      }
    } catch (e) {
      setStatus(String(e));
    } finally {
      setSolving(false);
    }
  };

  const filteredBank = bankQuestions.filter(q => {
    if (!searchText.trim()) return true;
    const needle = searchText.toLowerCase();
    return (q.stem || '').toLowerCase().includes(needle) ||
           (q.topic || '').toLowerCase().includes(needle) ||
           (q.subject || '').toLowerCase().includes(needle);
  });

  return (
    <div className="fade-in flex-col gap-md" style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Template Selection */}
      <div className="flex items-center gap-sm flex-wrap">
        <select
          value={activeTemplate?.id || ''}
          onChange={e => {
            const tmpl = templates.find(t => t.id === e.target.value);
            if (tmpl) selectTemplate(tmpl);
          }}
          style={{ width: 'auto', minWidth: '200px' }}
        >
          <option value="">{t('builder.selectTemplate')}</option>
          {templates.map(t => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        <input
          value={newTemplateName}
          onChange={e => setNewTemplateName(e.target.value)}
          placeholder={t('builder.newTemplate')}
          style={{ width: '200px' }}
          onKeyDown={e => e.key === 'Enter' && createTemplate()}
        />
        <button className="btn-primary" onClick={createTemplate} disabled={creatingTemplate}>{creatingTemplate ? t('builder.creating') : t('builder.createTemplate')}</button>
        {activeTemplate && (
          <>
            <button onClick={saveTemplate} disabled={saving}>{saving ? t('builder.saving') : t('builder.save')}</button>
            <button onClick={generateVersions} disabled={generating}>{generating ? t('builder.generating') : t('builder.generateVersions', { count: versionCount })}</button>
            <input
              type="number"
              min={1}
              max={20}
              value={versionCount}
              onChange={e => setVersionCount(parseInt(e.target.value) || 1)}
              style={{ width: '60px' }}
            />
            <button onClick={previewLatex} disabled={previewing}>{previewing ? t('builder.previewing') : t('builder.previewLatex')}</button>
            <button onClick={compileLatex} disabled={compiling}>{compiling ? t('builder.compiling') : t('builder.compilePdf')}</button>
            <button onClick={() => setShowConstraints(!showConstraints)}>
              {showConstraints ? t('builder.hideConstraints') : t('builder.autoAssembly')}
            </button>
          </>
        )}
        {status && <span className="text-sm" style={{ color: 'var(--text-accent)' }}>{status}</span>}
        {dirty && <span className="text-xs text-tertiary">{t('builder.unsaved')}</span>}
        {lastAutoSave && !dirty && <span className="text-xs text-tertiary">{t('builder.autoSaved', { time: lastAutoSave })}</span>}
      </div>

      {/* Constraint Solver Panel */}
      {showConstraints && (
        <div className="panel" style={{ maxWidth: '500px' }}>
          <h4 className="mb-sm">{t('builder.constraintsTitle')}</h4>
          <div className="flex-col gap-sm">
            <div>
              <label>{t('builder.totalQuestions')}</label>
              <input type="number" value={constraints.totalQuestions}
                onChange={e => setConstraints(c => ({ ...c, totalQuestions: parseInt(e.target.value) || 10 }))} />
            </div>
            <div>
              <label>{t('builder.topicDistribution')}</label>
              <input value={constraints.topicDistribution}
                onChange={e => setConstraints(c => ({ ...c, topicDistribution: e.target.value }))}
                placeholder={t('builder.topicDistributionPlaceholder')} />
            </div>
            <div>
              <label>{t('builder.difficultyDistribution')}</label>
              <input value={constraints.difficultyDistribution}
                onChange={e => setConstraints(c => ({ ...c, difficultyDistribution: e.target.value }))}
                placeholder={t('builder.difficultyDistributionPlaceholder')} />
            </div>
            <div>
              <label>{t('builder.excludeTags')}</label>
              <input value={constraints.excludeTags}
                onChange={e => setConstraints(c => ({ ...c, excludeTags: e.target.value }))} />
            </div>
            <button className="btn-primary" onClick={runConstraintSolver} disabled={solving}>{solving ? t('builder.solving') : t('builder.solveAndAdd')}</button>
            {solverResult?.warnings?.length > 0 && (
              <div className="text-sm text-warning">
                {solverResult.warnings.map((w: string, i: number) => <div key={i}>{w}</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-md)', flex: 1, overflow: 'hidden' }}>
        {/* Question Bank (left) */}
        <div className="panel" style={{ width: '280px', minWidth: '280px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <h4>{t('builder.questionBank')}</h4>
          <input
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder={t('builder.searchQuestions')}
          />
          <div style={{ flex: 1, overflow: 'auto' }}>
            {filteredBank.map(q => (
              <div
                key={q.id}
                className="glass-card"
                style={{
                  padding: 'var(--space-sm)',
                  marginBottom: 'var(--space-xs)',
                  cursor: 'grab',
                  fontSize: 'var(--font-size-sm)',
                }}
                draggable
                onDragStart={e => handleBankDragStart(e, q)}
              >
                <div className="truncate" style={{ fontWeight: 500 }}>
                  {q.stem?.substring(0, 60) || t('builder.noStem')}
                </div>
                <div className="flex gap-xs" style={{ marginTop: '2px' }}>
                  <span className="badge">{q.type?.replace('_', ' ')}</span>
                  {q.difficulty && <span className={`badge difficulty-${q.difficulty}`}>D{q.difficulty}</span>}
                  {q.topic && <span className="badge">{q.topic}</span>}
                </div>
              </div>
            ))}
            {filteredBank.length === 0 && (
              <p className="text-sm text-tertiary">{t('builder.noQuestions')}</p>
            )}
          </div>
        </div>

        {/* Test Structure (center) */}
        <div className="panel" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {activeTemplate ? (
            <>
              <div className="flex items-center gap-sm">
                <h4 style={{ flex: 1 }}>{activeTemplate.title}</h4>
                <input
                  value={newSectionName}
                  onChange={e => setNewSectionName(e.target.value)}
                  placeholder={t('builder.newSection')}
                  style={{ width: '160px' }}
                  onKeyDown={e => e.key === 'Enter' && addSection()}
                />
                <button className="btn-sm" onClick={addSection}>{t('builder.addSection')}</button>
              </div>

              {sections.map((section, sIdx) => (
                <div
                  key={section.id}
                  className="glass-card"
                  onDragOver={handleDragOver}
                  onDrop={e => handleSectionDrop(e, sIdx)}
                  style={{ minHeight: '60px' }}
                >
                  <div className="flex items-center justify-between mb-sm">
                    <div className="flex items-center gap-sm">
                      <strong>{section.name}</strong>
                      <span className="badge">{section.questions.filter(q => q.included).length} Q</span>
                    </div>
                    <div className="flex gap-xs">
                      <button className="btn-ghost btn-sm" onClick={() => moveSection(sIdx, -1)} disabled={sIdx === 0}>
                        {'\u2191'}
                      </button>
                      <button className="btn-ghost btn-sm" onClick={() => moveSection(sIdx, 1)} disabled={sIdx === sections.length - 1}>
                        {'\u2193'}
                      </button>
                      <button className="btn-danger btn-sm" onClick={() => removeSection(sIdx)}>
                        {'\u2715'}
                      </button>
                    </div>
                  </div>

                  {section.questions.length === 0 && (
                    <div className="drop-target" style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>
                      <span className="text-sm text-tertiary">{t('builder.dropHere')}</span>
                    </div>
                  )}

                  {section.questions.map((q, qIdx) => (
                    <div
                      key={`${q.question_id}-${qIdx}`}
                      className="flex items-center gap-sm"
                      style={{
                        padding: 'var(--space-xs) var(--space-sm)',
                        borderRadius: 'var(--radius-sm)',
                        background: q.included ? 'transparent' : 'var(--bg-danger)',
                        opacity: q.included ? 1 : 0.5,
                        cursor: 'grab',
                      }}
                      draggable
                      onDragStart={() => handleInternalDragStart(sIdx, qIdx)}
                      onDragEnter={() => handleInternalDragEnter(sIdx, qIdx)}
                      onDragEnd={handleInternalDragEnd}
                      onDragOver={e => e.preventDefault()}
                    >
                      <span className="drag-handle">{'\u2630'}</span>
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => moveQuestion(sIdx, qIdx, -1)}
                        disabled={qIdx === 0}
                        title={t('builder.moveUp')}
                        aria-label={t('builder.moveQuestionUp')}
                      >
                        {'\u2191'}
                      </button>
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => moveQuestion(sIdx, qIdx, 1)}
                        disabled={qIdx === section.questions.length - 1}
                        title={t('builder.moveDown')}
                        aria-label={t('builder.moveQuestionDown')}
                      >
                        {'\u2193'}
                      </button>
                      <span className="text-sm truncate" style={{ flex: 1 }}>
                        {qIdx + 1}. {q.stem?.substring(0, 50) || '(question)'}
                      </span>
                      <input
                        type="number"
                        value={q.points}
                        onChange={e => updateQuestionPoints(sIdx, qIdx, parseFloat(e.target.value) || 0)}
                        style={{ width: '50px' }}
                        title={t('builder.pointsTitle')}
                      />
                      <span className="text-xs text-tertiary">{t('common.points')}</span>
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => toggleQuestionIncluded(sIdx, qIdx)}
                        title={q.included ? t('builder.exclude') : t('builder.include')}
                      >
                        {q.included ? '\u2713' : '\u2717'}
                      </button>
                      <button
                        className="btn-ghost btn-sm btn-danger"
                        onClick={() => removeQuestion(sIdx, qIdx)}
                      >
                        {'\u2715'}
                      </button>
                    </div>
                  ))}
                </div>
              ))}

              {sections.length === 0 && (
                <div className="flex-col items-center justify-center" style={{
                  display: 'flex',
                  flex: 1,
                  gap: 'var(--space-md)',
                }}>
                  <span style={{ fontSize: '48px', opacity: 0.3 }}>{'\u2692'}</span>
                  <p className="text-secondary">{t('builder.emptySections')}</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex-col items-center justify-center" style={{
              display: 'flex',
              flex: 1,
              gap: 'var(--space-md)',
            }}>
              <span style={{ fontSize: '48px', opacity: 0.3 }}>{'\u2692'}</span>
              <p className="text-secondary">{t('builder.noTemplate')}</p>
            </div>
          )}
        </div>

        {/* Preview / Versions (right) */}
        {(latexPreview || versions.length > 0) && (
          <div className="panel" style={{ width: '300px', minWidth: '300px', overflow: 'auto' }}>
            {versions.length > 0 && (
              <div className="mb-md">
                <h4 className="mb-sm">{t('builder.versionsTitle', { count: versions.length })}</h4>
                {versions.map((v: any) => (
                  <div key={v.id} className="glass-card" style={{ padding: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                    <strong>{t('builder.versionLabel', { label: v.version_label })}</strong>
                    <span className="text-sm text-secondary"> - {t('builder.questionsCount', { count: v.generated_questions?.length || 0 })}</span>
                  </div>
                ))}
              </div>
            )}
            {latexPreview && (
              <div>
                <h4 className="mb-sm">{t('builder.latexPreview')}</h4>
                <pre style={{
                  fontSize: 'var(--font-size-xs)',
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--bg-input)',
                  padding: 'var(--space-sm)',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'auto',
                  maxHeight: '400px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {latexPreview}
                </pre>
              </div>
            )}
            {compileStatus && (
              <p className="text-sm mt-md" style={{ color: compileStatus.includes('Error') ? 'var(--text-danger)' : 'var(--text-success)' }}>
                {compileStatus}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
