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
  sections?: SectionDefinition[];
  constraints?: {
    difficulty_distribution?: Record<string, number>;
    topic_distribution?: Record<string, number>;
    total_questions?: number;
    per_section_questions?: Record<string, number>;
    type_distribution?: Record<string, number>;
  };
  randomization_options?: {
    shuffle_questions?: boolean;
    shuffle_choices?: boolean;
    swap_equivalent_questions?: boolean;
  };
}

export interface SectionDefinition {
  id: UUID;
  name: string;
  description?: string;
  order_index?: number;
  question_references?: Array<{ question_id?: UUID; constraintRef?: any }>;
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

export interface LayoutPreset {
  id: UUID;
  name: string;
  page_margins?: { top?: number; bottom?: number; left?: number; right?: number };
  font_family?: string;
  base_font_size?: number;
  line_spacing?: number;
  numbering_style?: string;
  show_points_inline?: boolean;
}

export interface QuestionInstance {
  id: UUID;
  base_question_id?: UUID;
  points?: number;
  local_overrides?: Partial<Question>;
  order_index?: number;
}

export interface TestInstance {
  id: UUID;
  test_template_id?: UUID;
  version_label?: string;
  random_seed?: number;
  generated_questions?: QuestionInstance[];
  latex_source_path?: string;
  pdf_path?: string;
  answer_key?: Record<string, any>;
}

export interface ExportProfile {
  id: UUID;
  name: string;
  format?: 'csv' | 'xlsx';
  includes?: string[];
  options?: Record<string, any>;
}

export interface Settings {
  latex_path?: string;
  use_embedded_latex?: boolean;
  ai_provider?: string;
  ai_api_key_encrypted?: string;
  language?: string;
}
