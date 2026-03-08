import { Question, QuestionType } from '../models';
import { aiCache } from './aiCache';

// ---------- Types ----------

export interface AIProviderConfig {
  provider: 'openai' | 'local' | 'anthropic';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface QuestionGenerationRequest {
  subject: string;
  topic: string;
  questionType: QuestionType;
  difficulty?: number;
  count?: number;
  context?: string;
  includeImages?: boolean;
  figureDescription?: string;
}

export interface DistractorRequest {
  question: Question;
  count?: number;
}

export interface RephraseRequest {
  question: Question;
  targetDifficulty: number;
}

export interface AutoBuilderRequest {
  course: string;
  topics: string[];
  difficultyMix: Record<string, number>; // e.g. {"easy": 0.3, "medium": 0.5, "hard": 0.2}
  totalQuestions: number;
  questionTypePrefs?: Record<QuestionType, number>;
  existingQuestions?: Question[];
  estimatedTime?: number;
}

export interface AutoBuilderProposal {
  sections: Array<{
    name: string;
    description?: string;
    questions: Array<{
      question: Question;
      isNew: boolean; // true = AI-generated draft, false = from existing bank
      confidence: number;
    }>;
  }>;
  totalTime?: number;
}

export interface AIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
}

// ---------- Rate Limiter ----------

class RateLimiter {
  private timestamps: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests = 20, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
    
    if (this.timestamps.length >= this.maxRequests) {
      const waitTime = this.timestamps[0] + this.windowMs - now;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.timestamps.push(Date.now());
  }
}

// ---------- AI Provider ----------

export class AIProvider {
  private config: AIProviderConfig;
  private rateLimiter: RateLimiter;
  private retryCount = 3;
  private retryDelay = 1000;

  constructor(config: AIProviderConfig) {
    this.config = {
      maxTokens: 2000,
      temperature: 0.7,
      ...config,
    };
    this.rateLimiter = new RateLimiter();
  }

  updateConfig(config: Partial<AIProviderConfig>) {
    Object.assign(this.config, config);
  }

  private getBaseUrl(): string {
    if (this.config.baseUrl) return this.config.baseUrl;
    switch (this.config.provider) {
      case 'openai': return 'https://api.openai.com/v1';
      case 'anthropic': return 'https://api.anthropic.com/v1';
      case 'local': return 'http://localhost:11434/v1';
      default: return 'https://api.openai.com/v1';
    }
  }

  private getModel(): string {
    if (this.config.model) return this.config.model;
    switch (this.config.provider) {
      case 'openai': return 'gpt-4o-mini';
      case 'anthropic': return 'claude-3-5-sonnet-20241022';
      case 'local': return 'llama3';
      default: return 'gpt-4o-mini';
    }
  }

  private async callAPI(systemPrompt: string, userPrompt: string): Promise<string> {
    const cacheKey = `${this.config.provider}:${systemPrompt.slice(0, 50)}:${userPrompt.slice(0, 100)}`;
    const cached = aiCache.get(cacheKey);
    if (cached) return cached;

    await this.rateLimiter.waitForSlot();

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < this.retryCount; attempt++) {
      try {
        const baseUrl = this.getBaseUrl();
        const model = this.getModel();

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        let body: any;

        if (this.config.provider === 'anthropic') {
          headers['x-api-key'] = this.config.apiKey || '';
          headers['anthropic-version'] = '2023-06-01';
          body = {
            model,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          };
        } else {
          headers['Authorization'] = `Bearer ${this.config.apiKey || ''}`;
          body = {
            model,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          };
        }

        const endpoint = this.config.provider === 'anthropic' 
          ? `${baseUrl}/messages`
          : `${baseUrl}/chat/completions`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`API error ${response.status}: ${errText}`);
        }

        const json = await response.json();
        let content = '';

        if (this.config.provider === 'anthropic') {
          content = json.content?.[0]?.text || '';
        } else {
          content = json.choices?.[0]?.message?.content || '';
        }

        aiCache.set(cacheKey, content);
        return content;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.retryCount - 1) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error('AI API call failed');
  }

  private parseQuestionsFromResponse(text: string, type: QuestionType): Question[] {
    // Try to extract JSON array from the response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed.map((q: any, i: number) => ({
            id: `ai-draft-${Date.now()}-${i}`,
            type: q.type || type,
            subject: q.subject || '',
            topic: q.topic || '',
            subtopic: q.subtopic || '',
            difficulty: q.difficulty || 3,
            tags: [...(q.tags || []), 'ai-generated'],
            estimated_time_min: q.estimated_time_min || 2,
            stem: q.stem || q.question || '',
            choices: (q.choices || q.options || []).map((c: any, j: number) => ({
              id: `choice-${Date.now()}-${i}-${j}`,
              text: typeof c === 'string' ? c : (c.text || c.label || ''),
              is_correct: typeof c === 'object' ? (c.is_correct || c.correct || false) : false,
            })),
            solution: q.solution || q.answer || '',
            explanation: q.explanation || '',
            author: 'AI',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));
        }
      } catch {}
    }

    // Fallback: return empty if parsing fails
    return [];
  }

  async generateQuestions(request: QuestionGenerationRequest): Promise<AIResponse<Question[]>> {
    try {
      const systemPrompt = `You are an expert educator creating exam questions. Return a JSON array of question objects. Each question must have: stem (the question text, may include LaTeX math with $...$), type ("${request.questionType}"), subject, topic, difficulty (1-5), choices (array of {text, is_correct} for MC/MS/TF), solution, explanation. Return ONLY the JSON array, no other text.`;

      const count = request.count || 3;
      let userPrompt = `Generate ${count} ${request.questionType.replace('_', ' ')} questions about "${request.topic}" in ${request.subject}.`;
      if (request.difficulty) userPrompt += ` Target difficulty: ${request.difficulty}/5.`;
      if (request.context) userPrompt += ` Additional context: ${request.context}`;
      if (request.figureDescription) userPrompt += ` Consider including a question referencing this figure: ${request.figureDescription}`;

      const response = await this.callAPI(systemPrompt, userPrompt);
      const questions = this.parseQuestionsFromResponse(response, request.questionType);

      return { success: true, data: questions };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async generateDistractors(request: DistractorRequest): Promise<AIResponse<string[]>> {
    try {
      const systemPrompt = `You are an expert educator. Generate plausible but incorrect answer choices (distractors) for an exam question. Return a JSON array of strings, each being a distractor. Return ONLY the JSON array.`;

      const userPrompt = `Question: "${request.question.stem}"\nCorrect answer(s): ${(request.question.choices || []).filter(c => c.is_correct).map(c => c.text).join(', ')}\nGenerate ${request.count || 3} distractors.`;

      const response = await this.callAPI(systemPrompt, userPrompt);
      const match = response.match(/\[[\s\S]*\]/);
      if (match) {
        const distractors = JSON.parse(match[0]);
        if (Array.isArray(distractors)) {
          return { success: true, data: distractors.map(d => typeof d === 'string' ? d : String(d)) };
        }
      }
      return { success: false, error: 'Failed to parse distractors' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async rephraseQuestion(request: RephraseRequest): Promise<AIResponse<Question>> {
    try {
      const systemPrompt = `You are an expert educator. Rephrase the given question at a different difficulty level. Return a single JSON object with the same structure. Return ONLY the JSON object.`;

      const userPrompt = `Rephrase this question at difficulty level ${request.targetDifficulty}/5:\n${JSON.stringify({
        stem: request.question.stem,
        choices: request.question.choices,
        type: request.question.type,
      })}`;

      const response = await this.callAPI(systemPrompt, userPrompt);
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const rephrased: Question = {
          ...request.question,
          id: `ai-rephrase-${Date.now()}`,
          stem: parsed.stem || request.question.stem,
          difficulty: request.targetDifficulty,
          choices: parsed.choices?.map((c: any, j: number) => ({
            id: `choice-rephrase-${Date.now()}-${j}`,
            text: c.text || '',
            is_correct: c.is_correct || false,
          })) || request.question.choices,
          tags: [...(request.question.tags || []), 'ai-generated', 'rephrased'],
          author: 'AI',
          updated_at: new Date().toISOString(),
        };
        return { success: true, data: rephrased };
      }
      return { success: false, error: 'Failed to parse rephrased question' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async generateSolution(question: Question): Promise<AIResponse<{ solution: string; explanation: string }>> {
    try {
      const systemPrompt = `You are an expert educator. Generate a solution and explanation for the given exam question. Return a JSON object with "solution" and "explanation" fields. The solution is the direct answer, the explanation provides reasoning. Use LaTeX math notation where appropriate ($...$). Return ONLY the JSON object.`;

      const userPrompt = `Question: "${question.stem}"\nType: ${question.type}\n${question.choices ? `Choices: ${question.choices.map(c => c.text).join(', ')}` : ''}`;

      const response = await this.callAPI(systemPrompt, userPrompt);
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return { success: true, data: { solution: parsed.solution || '', explanation: parsed.explanation || '' } };
      }
      return { success: false, error: 'Failed to parse solution' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async buildTestProposal(request: AutoBuilderRequest): Promise<AIResponse<AutoBuilderProposal>> {
    try {
      const systemPrompt = `You are an expert exam builder. Given constraints and optionally existing questions, propose a test structure with sections and questions. For each proposed question, indicate whether it's from the existing bank (isNew: false) or newly generated (isNew: true). Return a JSON object with structure: { sections: [{ name, description, questions: [{ question: {stem, type, choices, difficulty, topic, subject}, isNew, confidence }] }], totalTime }. Return ONLY the JSON object.`;

      const existingSummary = request.existingQuestions?.length
        ? `\nExisting questions in bank (use their IDs when possible):\n${request.existingQuestions.slice(0, 50).map(q => `- [${q.id}] ${q.topic} (${q.type}, diff=${q.difficulty}): ${q.stem.substring(0, 80)}`).join('\n')}`
        : '';

      const userPrompt = `Build a ${request.course} exam with:
- Topics: ${request.topics.join(', ')}
- Difficulty mix: ${JSON.stringify(request.difficultyMix)}
- Total questions: ${request.totalQuestions}
${request.questionTypePrefs ? `- Question type preferences: ${JSON.stringify(request.questionTypePrefs)}` : ''}
${request.estimatedTime ? `- Target total time: ${request.estimatedTime} minutes` : ''}
${existingSummary}`;

      const response = await this.callAPI(systemPrompt, userPrompt);
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const proposal: AutoBuilderProposal = {
          sections: (parsed.sections || []).map((s: any) => ({
            name: s.name || 'Section',
            description: s.description || '',
            questions: (s.questions || []).map((qItem: any, i: number) => {
              const q = qItem.question || qItem;
              return {
                question: {
                  id: q.id || `ai-auto-${Date.now()}-${i}`,
                  type: q.type || 'multiple_choice',
                  subject: q.subject || request.course,
                  topic: q.topic || '',
                  difficulty: q.difficulty || 3,
                  stem: q.stem || '',
                  choices: (q.choices || []).map((c: any, j: number) => ({
                    id: `choice-auto-${Date.now()}-${i}-${j}`,
                    text: typeof c === 'string' ? c : (c.text || ''),
                    is_correct: typeof c === 'object' ? (c.is_correct || false) : false,
                  })),
                  tags: ['ai-generated'],
                  author: 'AI',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                } as Question,
                isNew: qItem.isNew !== false,
                confidence: qItem.confidence || 0.8,
              };
            }),
          })),
          totalTime: parsed.totalTime,
        };
        return { success: true, data: proposal };
      }
      return { success: false, error: 'Failed to parse auto-builder proposal' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// Singleton instance management
let activeProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider | null {
  return activeProvider;
}

export function setAIProvider(config: AIProviderConfig): AIProvider {
  activeProvider = new AIProvider(config);
  return activeProvider;
}
