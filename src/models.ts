export type UUID = string;

export type QuestionType =
  | 'multiple_choice'
  | 'multiple_select'
  | 'short_answer'
  | 'true_false'
  | 'matching';

export interface MediaRef {
  id: UUID;
  path: string; // relative to project media/
  alt_text?: string;
  placement?: 'above' | 'below' | 'inline' | 'per_choice';
  caption?: string;
}

export interface Choice {
  id: UUID;
  text: string;
  is_correct?: boolean;
}

export interface Question {
  id: UUID;
  type: QuestionType;
  subject?: string;
  topic?: string;
  subtopic?: string;
  difficulty?: number; // 1-5
  tags?: string[];
  estimated_time_min?: number;
  stem: string; // LaTeX/markdown
  choices?: Choice[];
  solution?: string;
  explanation?: string;
  media_refs?: MediaRef[];
  author?: string;
  created_at?: string; // ISO datetime
  updated_at?: string; // ISO datetime
}

export interface HeaderPreset {
  id: UUID;
  name: string;
  scope: 'global' | 'project';
  latex_snippet?: string;
  fields_config?: {
    show_logo?: boolean;
    logo_path?: string;
    show_course?: boolean;
    show_instructor?: boolean;
    show_date?: boolean;
    show_duration?: boolean;
    student_name_line?: boolean;
    student_id_line?: boolean;
  };
}

export interface TestTemplate {
  id: UUID;
  title: string;
  course?: string;
  description?: string;
  metadata?: Record<string, any>;
  header_preset_id?: UUID;
  layout_preset_id?: UUID;
}
