'use client';

import { useState, useEffect, useCallback } from 'react';
import { t } from '../i18n';
import { api } from '../lib/api';
import type { HeaderPreset, LayoutPreset, QuestionType } from '../../models';

interface WizardProps {
  open: boolean;
  onClose: () => void;
  onCreated: (templateId: string) => void;
}

interface WizardSection {
  id: string;
  name: string;
  description: string;
  targetCount: number;
  allowedTypes: QuestionType[];
}

const QUESTION_TYPES: QuestionType[] = [
  'multiple_choice',
  'multiple_select',
  'true_false',
  'short_answer',
  'matching',
];

const STEPS = [
  'Course / Subject',
  'Metadata',
  'Presets',
  'Sections',
  'Review & Create',
] as const;

export function NewTestWizard({ open, onClose, onCreated }: WizardProps) {
  const [step, setStep] = useState(0);

  // Step 1: Course / Subject
  const [course, setCourse] = useState('');
  const [subject, setSubject] = useState('');

  // Step 2: Metadata
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [date, setDate] = useState('');
  const [duration, setDuration] = useState<number | ''>('');
  const [instructions, setInstructions] = useState('');

  // Step 3: Presets
  const [headerPresets, setHeaderPresets] = useState<HeaderPreset[]>([]);
  const [layoutPresets, setLayoutPresets] = useState<LayoutPreset[]>([]);
  const [selectedHeaderPresetId, setSelectedHeaderPresetId] = useState('');
  const [selectedLayoutPresetId, setSelectedLayoutPresetId] = useState('');

  // Step 4: Sections
  const [sections, setSections] = useState<WizardSection[]>([
    { id: `sec-${Date.now()}`, name: 'Section A', description: '', targetCount: 10, allowedTypes: [] },
  ]);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const loadPresets = useCallback(async () => {
    try {
      const [hRes, lRes] = await Promise.all([
        api.listHeaderPresets(),
        api.listLayoutPresets(),
      ]);
      if (hRes?.presets) setHeaderPresets(hRes.presets);
      else if (Array.isArray(hRes)) setHeaderPresets(hRes as HeaderPreset[]);
      if (lRes?.presets) setLayoutPresets(lRes.presets);
      else if (Array.isArray(lRes)) setLayoutPresets(lRes as LayoutPreset[]);
    } catch {}
  }, []);

  useEffect(() => {
    if (open) {
      loadPresets();
      // Set default date to today
      if (!date) setDate(new Date().toISOString().slice(0, 10));
    }
  }, [open, loadPresets]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    setStep(0);
    setCourse('');
    setSubject('');
    setTitle('');
    setSubtitle('');
    setDate('');
    setDuration('');
    setInstructions('');
    setSelectedHeaderPresetId('');
    setSelectedLayoutPresetId('');
    setSections([{ id: `sec-${Date.now()}`, name: 'Section A', description: '', targetCount: 10, allowedTypes: [] }]);
    setError('');
    setCreating(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const canAdvance = (): boolean => {
    switch (step) {
      case 0: return true; // course/subject optional
      case 1: return !!title.trim();
      case 2: return true; // presets optional
      case 3: return sections.length > 0 && sections.every(s => s.name.trim());
      case 4: return true;
      default: return false;
    }
  };

  const addSection = () => {
    const idx = sections.length;
    const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    setSections(prev => [...prev, {
      id: `sec-${Date.now()}-${idx}`,
      name: `Section ${labels[idx] || idx + 1}`,
      description: '',
      targetCount: 10,
      allowedTypes: [],
    }]);
  };

  const removeSection = (idx: number) => {
    setSections(prev => prev.filter((_, i) => i !== idx));
  };

  const updateSection = (idx: number, updates: Partial<WizardSection>) => {
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));
  };

  const toggleType = (sectionIdx: number, qt: QuestionType) => {
    setSections(prev => prev.map((s, i) => {
      if (i !== sectionIdx) return s;
      const current = s.allowedTypes;
      let next: QuestionType[];
      if (current.length === 0) {
        // First toggle: allow all except this one
        next = QUESTION_TYPES.filter(x => x !== qt);
      } else if (current.includes(qt)) {
        next = current.filter(x => x !== qt);
      } else {
        next = [...current, qt];
      }
      if (next.length === QUESTION_TYPES.length) next = [];
      return { ...s, allowedTypes: next };
    }));
  };

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const templateId = `tmpl-${Date.now()}`;
      const template = {
        id: templateId,
        title: title.trim(),
        course: course.trim() || undefined,
        description: subtitle.trim() || undefined,
        metadata: {
          date: date || undefined,
          duration: duration ? Number(duration) : undefined,
          instructions: instructions.trim() || undefined,
        },
        header_preset_id: selectedHeaderPresetId || undefined,
        layout_preset_id: selectedLayoutPresetId || undefined,
        sections: sections.map((s, i) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          order_index: i,
          allowed_types: s.allowedTypes.length > 0 ? s.allowedTypes : undefined,
          question_references: [],
        })),
        constraints: {
          per_section_questions: Object.fromEntries(
            sections.map(s => [s.id, s.targetCount])
          ),
        },
        randomization_options: { shuffle_questions: true, shuffle_choices: true },
      };
      await api.upsertTestTemplate(template);
      onCreated(templateId);
      handleClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="panel"
        style={{
          width: '560px',
          maxHeight: '80vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3>{t('wizard.title')}</h3>
          <button className="btn-ghost btn-sm" onClick={handleClose}>{'\u2715'}</button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-xs" style={{ fontSize: 'var(--font-size-xs)' }}>
          {STEPS.map((label, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                textAlign: 'center',
                background: i === step ? 'var(--bg-accent)' : i < step ? 'var(--bg-success)' : 'var(--bg-input)',
                color: i === step ? 'var(--text-accent)' : i < step ? 'var(--text-success)' : 'var(--text-tertiary)',
                fontWeight: i === step ? 600 : 400,
                cursor: i < step ? 'pointer' : 'default',
              }}
              onClick={() => { if (i < step) setStep(i); }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div style={{ flex: 1, minHeight: '200px' }}>
          {step === 0 && (
            <div className="flex-col gap-md" style={{ display: 'flex' }}>
              <p className="text-secondary">{t('wizard.courseSubjectDesc')}</p>
              <div>
                <label>{t('wizard.course')}</label>
                <input value={course} onChange={e => setCourse(e.target.value)} placeholder="e.g. CS101 - Intro to Computer Science" />
              </div>
              <div>
                <label>{t('wizard.subject')}</label>
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Computer Science" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="flex-col gap-md" style={{ display: 'flex' }}>
              <div>
                <label>{t('wizard.testTitle')} *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Midterm Exam 1" />
              </div>
              <div>
                <label>{t('wizard.subtitle')}</label>
                <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="e.g. Chapters 1-5" />
              </div>
              <div className="flex gap-sm">
                <div style={{ flex: 1 }}>
                  <label>{t('wizard.date')}</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>{t('wizard.duration')} (min)</label>
                  <input type="number" min={0} value={duration} onChange={e => setDuration(e.target.value ? parseInt(e.target.value) : '')} placeholder="60" />
                </div>
              </div>
              <div>
                <label>{t('wizard.instructions')}</label>
                <textarea
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  rows={3}
                  placeholder="e.g. No calculators allowed. Show all work."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex-col gap-md" style={{ display: 'flex' }}>
              <p className="text-secondary">{t('wizard.presetsDesc')}</p>
              <div>
                <label>{t('wizard.headerPreset')}</label>
                <select value={selectedHeaderPresetId} onChange={e => setSelectedHeaderPresetId(e.target.value)}>
                  <option value="">{t('wizard.defaultHeader')}</option>
                  {headerPresets.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>{t('wizard.layoutPreset')}</label>
                <select value={selectedLayoutPresetId} onChange={e => setSelectedLayoutPresetId(e.target.value)}>
                  <option value="">{t('wizard.defaultLayout')}</option>
                  {layoutPresets.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.scope === 'global' ? ' (Global)' : ''}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-tertiary">{t('wizard.presetsNote')}</p>
            </div>
          )}

          {step === 3 && (
            <div className="flex-col gap-md" style={{ display: 'flex' }}>
              <p className="text-secondary">{t('wizard.sectionsDesc')}</p>
              {sections.map((sec, idx) => (
                <div key={sec.id} className="glass-card" style={{ padding: 'var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  <div className="flex items-center gap-sm">
                    <input
                      value={sec.name}
                      onChange={e => updateSection(idx, { name: e.target.value })}
                      placeholder="Section name"
                      style={{ flex: 1 }}
                    />
                    <input
                      type="number"
                      min={1}
                      value={sec.targetCount}
                      onChange={e => updateSection(idx, { targetCount: parseInt(e.target.value) || 1 })}
                      style={{ width: '60px' }}
                      title={t('wizard.targetQuestions')}
                    />
                    <span className="text-xs text-tertiary">Q</span>
                    {sections.length > 1 && (
                      <button className="btn-ghost btn-sm btn-danger" onClick={() => removeSection(idx)}>{'\u2715'}</button>
                    )}
                  </div>
                  <input
                    value={sec.description}
                    onChange={e => updateSection(idx, { description: e.target.value })}
                    placeholder={t('wizard.sectionDescription')}
                    style={{ fontSize: 'var(--font-size-sm)' }}
                  />
                  <div className="flex items-center gap-xs flex-wrap" style={{ fontSize: 'var(--font-size-xs)' }}>
                    <span className="text-tertiary">{t('wizard.allowedTypes')}:</span>
                    {QUESTION_TYPES.map(qt => {
                      const isChecked = sec.allowedTypes.length === 0 || sec.allowedTypes.includes(qt);
                      return (
                        <label key={qt} className="flex items-center gap-xs" style={{ cursor: 'pointer' }}>
                          <input type="checkbox" checked={isChecked} onChange={() => toggleType(idx, qt)} />
                          <span>{qt.replace('_', ' ')}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button className="btn-sm" onClick={addSection} style={{ alignSelf: 'flex-start' }}>+ {t('wizard.addSection')}</button>
            </div>
          )}

          {step === 4 && (
            <div className="flex-col gap-md" style={{ display: 'flex' }}>
              <h4>{t('wizard.review')}</h4>
              <div className="glass-card" style={{ padding: 'var(--space-sm)', fontSize: 'var(--font-size-sm)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr><td style={{ padding: '4px 8px', fontWeight: 600 }}>{t('wizard.testTitle')}</td><td>{title}</td></tr>
                    {course && <tr><td style={{ padding: '4px 8px', fontWeight: 600 }}>{t('wizard.course')}</td><td>{course}</td></tr>}
                    {subtitle && <tr><td style={{ padding: '4px 8px', fontWeight: 600 }}>{t('wizard.subtitle')}</td><td>{subtitle}</td></tr>}
                    {date && <tr><td style={{ padding: '4px 8px', fontWeight: 600 }}>{t('wizard.date')}</td><td>{date}</td></tr>}
                    {duration && <tr><td style={{ padding: '4px 8px', fontWeight: 600 }}>{t('wizard.duration')}</td><td>{duration} min</td></tr>}
                    {instructions && <tr><td style={{ padding: '4px 8px', fontWeight: 600 }}>{t('wizard.instructions')}</td><td style={{ whiteSpace: 'pre-wrap' }}>{instructions}</td></tr>}
                    <tr><td style={{ padding: '4px 8px', fontWeight: 600 }}>{t('wizard.headerPreset')}</td><td>{headerPresets.find(p => p.id === selectedHeaderPresetId)?.name || t('wizard.defaultHeader')}</td></tr>
                    <tr><td style={{ padding: '4px 8px', fontWeight: 600 }}>{t('wizard.layoutPreset')}</td><td>{layoutPresets.find(p => p.id === selectedLayoutPresetId)?.name || t('wizard.defaultLayout')}</td></tr>
                  </tbody>
                </table>
              </div>

              <h4>{t('wizard.sections')} ({sections.length})</h4>
              {sections.map((sec, idx) => (
                <div key={sec.id} className="glass-card" style={{ padding: 'var(--space-sm)', fontSize: 'var(--font-size-sm)' }}>
                  <strong>{sec.name}</strong> - {sec.targetCount} questions
                  {sec.description && <div className="text-tertiary">{sec.description}</div>}
                  {sec.allowedTypes.length > 0 && (
                    <div className="text-xs text-tertiary">
                      Types: {sec.allowedTypes.map(t => t.replace('_', ' ')).join(', ')}
                    </div>
                  )}
                </div>
              ))}

              {error && <p className="text-sm" style={{ color: 'var(--text-danger)' }}>{error}</p>}
            </div>
          )}
        </div>

        {/* Footer / Navigation */}
        <div className="flex items-center justify-between" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-md)' }}>
          <button className="btn-ghost" onClick={step === 0 ? handleClose : () => setStep(s => s - 1)}>
            {step === 0 ? t('common.cancel') : t('wizard.back')}
          </button>
          <div className="flex gap-sm">
            {step < STEPS.length - 1 ? (
              <button className="btn-primary" onClick={() => setStep(s => s + 1)} disabled={!canAdvance()}>
                {t('wizard.next')}
              </button>
            ) : (
              <button className="btn-primary" onClick={handleCreate} disabled={creating || !canAdvance()}>
                {creating ? t('wizard.creating') : t('wizard.createTest')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
