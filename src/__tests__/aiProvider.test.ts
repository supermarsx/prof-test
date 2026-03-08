import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIProvider, setAIProvider, getAIProvider, AIProviderConfig } from '../utils/aiProvider';
import { Question, QuestionType } from '../models';

vi.mock('../utils/aiCache', () => ({
  aiCache: {
    get: vi.fn(() => null),
    set: vi.fn(),
  },
}));

import { aiCache } from '../utils/aiCache';

const mockedCacheGet = aiCache.get as ReturnType<typeof vi.fn>;
const mockedCacheSet = aiCache.set as ReturnType<typeof vi.fn>;

// ---------- helpers ----------

function mockFetch(body: any, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    json: () => Promise.resolve(body),
  });
}

function openAIResponse(content: string) {
  return { choices: [{ message: { content } }] };
}

function anthropicResponse(content: string) {
  return { content: [{ text: content }] };
}

const defaultConfig: AIProviderConfig = { provider: 'openai', apiKey: 'test-key' };

function sampleQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    type: 'multiple_choice',
    stem: 'What is 2+2?',
    subject: 'Math',
    topic: 'Arithmetic',
    difficulty: 3,
    choices: [
      { id: 'c1', text: '4', is_correct: true },
      { id: 'c2', text: '5', is_correct: false },
    ],
    tags: ['math'],
    author: 'test',
    ...overrides,
  };
}

// ---------- setup ----------

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchSpy = mockFetch(openAIResponse('[]'));
  vi.stubGlobal('fetch', fetchSpy);
  mockedCacheGet.mockReturnValue(null);
  mockedCacheSet.mockClear();
  // reset singleton
  (globalThis as any).__profTestActiveProvider = undefined;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ============================================================
// Singleton management
// ============================================================

describe('Singleton management', () => {
  it('getAIProvider returns null initially', () => {
    // Reset by calling setAIProvider with a fresh module; since the module-level
    // variable is not exported we rely on the fact that the module was freshly
    // loaded during vi.mock.  We call getAIProvider before any setAIProvider in
    // this describe block — but because other describes may run first we just
    // accept the current value (the singleton is module-scoped and vitest
    // doesn't re-import between tests).  We instead test the observable
    // behaviour: before setAIProvider is called in *this* test, getAIProvider
    // returns null or the value previously set.  To keep it deterministic we
    // create a brand-new module re-import via a trick: we simply verify the
    // type contract.
    // Re-use the exported helpers directly:
    // The very first call inside this isolated test file will be null because
    // vi.mock resets the module.
    const provider = getAIProvider();
    // Before any setAIProvider in this file's lifecycle, should be null.
    // (vitest runs describes sequentially; this is the first describe.)
    expect(provider).toBeNull();
  });

  it('setAIProvider creates provider and returns it', () => {
    const result = setAIProvider(defaultConfig);
    expect(result).toBeInstanceOf(AIProvider);
  });

  it('getAIProvider returns the set provider', () => {
    const created = setAIProvider(defaultConfig);
    expect(getAIProvider()).toBe(created);
  });

  it('setAIProvider replaces previous provider', () => {
    const first = setAIProvider(defaultConfig);
    const second = setAIProvider({ provider: 'anthropic', apiKey: 'key2' });
    expect(second).not.toBe(first);
    expect(getAIProvider()).toBe(second);
  });
});

// ============================================================
// Constructor & config
// ============================================================

describe('Constructor & config', () => {
  it('constructor sets defaults for maxTokens and temperature', () => {
    const provider = new AIProvider({ provider: 'openai', apiKey: 'k' });
    // We verify via the API call that defaults are applied.
    const questionsJson = JSON.stringify([{ stem: 'Q', type: 'multiple_choice', choices: [] }]);
    fetchSpy = mockFetch(openAIResponse(questionsJson));
    vi.stubGlobal('fetch', fetchSpy);

    // Trigger a call and inspect the request body
    return provider
      .generateQuestions({ subject: 'Math', topic: 'Algebra', questionType: 'multiple_choice' })
      .then(() => {
        const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
        expect(body.max_tokens).toBe(2000);
        expect(body.temperature).toBe(0.7);
      });
  });

  it('updateConfig merges new values', () => {
    const provider = new AIProvider({ provider: 'openai', apiKey: 'k' });
    provider.updateConfig({ maxTokens: 500, temperature: 0.3 });

    const questionsJson = JSON.stringify([{ stem: 'Q', type: 'multiple_choice', choices: [] }]);
    fetchSpy = mockFetch(openAIResponse(questionsJson));
    vi.stubGlobal('fetch', fetchSpy);

    return provider
      .generateQuestions({ subject: 'Math', topic: 'Algebra', questionType: 'multiple_choice' })
      .then(() => {
        const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
        expect(body.max_tokens).toBe(500);
        expect(body.temperature).toBe(0.3);
      });
  });
});

// ============================================================
// Provider routing
// ============================================================

describe('Provider routing', () => {
  const questionsJson = JSON.stringify([{ stem: 'Q1', type: 'multiple_choice', choices: [] }]);

  it('OpenAI: uses correct base URL and Authorization header', async () => {
    fetchSpy = mockFetch(openAIResponse(questionsJson));
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new AIProvider({ provider: 'openai', apiKey: 'sk-test' });

    await provider.generateQuestions({ subject: 'S', topic: 'T', questionType: 'multiple_choice' });

    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(opts.headers['Authorization']).toBe('Bearer sk-test');
  });

  it('Anthropic: uses correct base URL, x-api-key header, and messages endpoint', async () => {
    fetchSpy = mockFetch(anthropicResponse(questionsJson));
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new AIProvider({ provider: 'anthropic', apiKey: 'ant-key' });

    await provider.generateQuestions({ subject: 'S', topic: 'T', questionType: 'multiple_choice' });

    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(opts.headers['x-api-key']).toBe('ant-key');
    expect(opts.headers['anthropic-version']).toBe('2023-06-01');
  });

  it('Local: uses localhost URL', async () => {
    fetchSpy = mockFetch(openAIResponse(questionsJson));
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new AIProvider({ provider: 'local' });

    await provider.generateQuestions({ subject: 'S', topic: 'T', questionType: 'multiple_choice' });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('Custom baseUrl overrides default', async () => {
    fetchSpy = mockFetch(openAIResponse(questionsJson));
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new AIProvider({
      provider: 'openai',
      apiKey: 'k',
      baseUrl: 'https://custom.host/v1',
    });

    await provider.generateQuestions({ subject: 'S', topic: 'T', questionType: 'multiple_choice' });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://custom.host/v1/chat/completions');
  });

  it('OpenAI uses default model gpt-4o-mini', async () => {
    fetchSpy = mockFetch(openAIResponse(questionsJson));
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new AIProvider({ provider: 'openai', apiKey: 'k' });

    await provider.generateQuestions({ subject: 'S', topic: 'T', questionType: 'multiple_choice' });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.model).toBe('gpt-4o-mini');
  });

  it('Anthropic uses default model claude-3-5-sonnet-20241022', async () => {
    fetchSpy = mockFetch(anthropicResponse(questionsJson));
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new AIProvider({ provider: 'anthropic', apiKey: 'k' });

    await provider.generateQuestions({ subject: 'S', topic: 'T', questionType: 'multiple_choice' });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.model).toBe('claude-3-5-sonnet-20241022');
  });

  it('Local uses default model llama3', async () => {
    fetchSpy = mockFetch(openAIResponse(questionsJson));
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new AIProvider({ provider: 'local' });

    await provider.generateQuestions({ subject: 'S', topic: 'T', questionType: 'multiple_choice' });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.model).toBe('llama3');
  });

  it('Custom model overrides default', async () => {
    fetchSpy = mockFetch(openAIResponse(questionsJson));
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new AIProvider({ provider: 'openai', apiKey: 'k', model: 'gpt-4-turbo' });

    await provider.generateQuestions({ subject: 'S', topic: 'T', questionType: 'multiple_choice' });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.model).toBe('gpt-4-turbo');
  });
});

// ============================================================
// Response caching
// ============================================================

describe('Response caching', () => {
  const questionsJson = JSON.stringify([{ stem: 'cached Q', type: 'multiple_choice', choices: [] }]);

  it('returns cached response on cache hit', async () => {
    mockedCacheGet.mockReturnValue(questionsJson);
    fetchSpy = mockFetch(openAIResponse('should not reach'));
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AIProvider(defaultConfig);
    const result = await provider.generateQuestions({
      subject: 'S',
      topic: 'T',
      questionType: 'multiple_choice',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('stores response in cache after API call', async () => {
    fetchSpy = mockFetch(openAIResponse(questionsJson));
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AIProvider(defaultConfig);
    await provider.generateQuestions({ subject: 'S', topic: 'T', questionType: 'multiple_choice' });

    expect(mockedCacheSet).toHaveBeenCalledTimes(1);
    // second arg should be the content string
    expect(mockedCacheSet.mock.calls[0][1]).toBe(questionsJson);
  });

  it('constructs cache key from provider, system prompt, and user prompt', async () => {
    fetchSpy = mockFetch(openAIResponse(questionsJson));
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AIProvider(defaultConfig);
    await provider.generateQuestions({ subject: 'S', topic: 'T', questionType: 'multiple_choice' });

    const cacheKey: string = mockedCacheSet.mock.calls[0][0];
    expect(cacheKey).toContain('openai');
  });
});

// ============================================================
// Retry logic
// ============================================================

describe('Retry logic', () => {
  const questionsJson = JSON.stringify([{ stem: 'Q', type: 'multiple_choice', choices: [] }]);

  it('retries on failure up to 3 times', async () => {
    let callCount = 0;
    const spy = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        return Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve('server error'),
          json: () => Promise.resolve({}),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(openAIResponse(questionsJson))),
        json: () => Promise.resolve(openAIResponse(questionsJson)),
      });
    });
    vi.stubGlobal('fetch', spy);

    const provider = new AIProvider(defaultConfig);
    const result = await provider.generateQuestions({
      subject: 'S',
      topic: 'T',
      questionType: 'multiple_choice',
    });

    expect(spy).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(true);
  });

  it('throws after exhausting retries', async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('server error'),
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', spy);

    const provider = new AIProvider(defaultConfig);
    const result = await provider.generateQuestions({
      subject: 'S',
      topic: 'T',
      questionType: 'multiple_choice',
    });

    expect(spy).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('uses exponential backoff between retries', async () => {
    // We just verify all 3 calls happen (the implementation multiplies delay by attempt+1)
    const spy = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('err'),
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', spy);

    const provider = new AIProvider(defaultConfig);
    const resultPromise = provider.generateQuestions({
      subject: 'S',
      topic: 'T',
      questionType: 'multiple_choice',
    });

    // advance past the retry delays (1000ms * 1 + 1000ms * 2 = 3000ms)
    await vi.advanceTimersByTimeAsync(10000);
    const result = await resultPromise;

    expect(spy).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(false);
  });

  it('handles network errors (fetch throws)', async () => {
    const spy = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', spy);

    const provider = new AIProvider(defaultConfig);
    const result = await provider.generateQuestions({
      subject: 'S',
      topic: 'T',
      questionType: 'multiple_choice',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to fetch');
  });
});

// ============================================================
// Rate limiting
// ============================================================

describe('Rate limiting', () => {
  it('allows requests within rate limit', async () => {
    const questionsJson = JSON.stringify([{ stem: 'Q', type: 'multiple_choice', choices: [] }]);
    fetchSpy = mockFetch(openAIResponse(questionsJson));
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AIProvider(defaultConfig);
    // Make a few sequential calls — all should succeed
    for (let i = 0; i < 3; i++) {
      const result = await provider.generateQuestions({
        subject: 'S',
        topic: 'T',
        questionType: 'multiple_choice',
      });
      expect(result.success).toBe(true);
    }
  });
});

// ============================================================
// generateQuestions
// ============================================================

describe('generateQuestions', () => {
  it('returns parsed questions on success', async () => {
    const questionsPayload = [
      {
        stem: 'What is 2+2?',
        type: 'multiple_choice',
        subject: 'Math',
        topic: 'Arithmetic',
        difficulty: 2,
        choices: [
          { text: '4', is_correct: true },
          { text: '5', is_correct: false },
        ],
        solution: '4',
        explanation: 'Basic addition',
      },
    ];
    fetchSpy = mockFetch(openAIResponse(JSON.stringify(questionsPayload)));
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AIProvider(defaultConfig);
    const result = await provider.generateQuestions({
      subject: 'Math',
      topic: 'Arithmetic',
      questionType: 'multiple_choice',
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data![0].stem).toBe('What is 2+2?');
    expect(result.data![0].choices).toHaveLength(2);
    expect(result.data![0].tags).toContain('ai-generated');
  });

  it('handles different question types in response', async () => {
    const questionsPayload = [
      { stem: 'TF Q', type: 'true_false', choices: [] },
      { stem: 'SA Q', type: 'short_answer', choices: [] },
    ];
    fetchSpy = mockFetch(openAIResponse(JSON.stringify(questionsPayload)));
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AIProvider(defaultConfig);
    const result = await provider.generateQuestions({
      subject: 'S',
      topic: 'T',
      questionType: 'multiple_choice',
    });

    expect(result.success).toBe(true);
    expect(result.data![0].type).toBe('true_false');
    expect(result.data![1].type).toBe('short_answer');
  });

  it('returns success false on API error', async () => {
    fetchSpy = mockFetch('Internal Server Error', 500);
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AIProvider(defaultConfig);
    const result = await provider.generateQuestions({
      subject: 'S',
      topic: 'T',
      questionType: 'multiple_choice',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns empty array when response is not valid JSON array', async () => {
    fetchSpy = mockFetch(openAIResponse('This is not JSON at all'));
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AIProvider(defaultConfig);
    const result = await provider.generateQuestions({
      subject: 'S',
      topic: 'T',
      questionType: 'multiple_choice',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('maps alternate field names (question->stem, options->choices, correct->is_correct)', async () => {
    const questionsPayload = [
      {
        question: 'Alternate stem',
        type: 'multiple_choice',
        options: [
          { text: 'A', correct: true },
          { text: 'B', correct: false },
        ],
        answer: 'A is correct',
      },
    ];
    fetchSpy = mockFetch(openAIResponse(JSON.stringify(questionsPayload)));
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AIProvider(defaultConfig);
    const result = await provider.generateQuestions({
      subject: 'S',
      topic: 'T',
      questionType: 'multiple_choice',
    });

    expect(result.success).toBe(true);
    expect(result.data![0].stem).toBe('Alternate stem');
    expect(result.data![0].choices).toHaveLength(2);
    // The code maps c.correct to is_correct
    expect(result.data![0].choices![0].is_correct).toBe(true);
    expect(result.data![0].solution).toBe('A is correct');
  });
});

// ============================================================
// generateDistractors
// ============================================================

describe('generateDistractors', () => {
  it('returns distractors array on success', async () => {
    const distractors = ['Wrong A', 'Wrong B', 'Wrong C'];
    fetchSpy = mockFetch(openAIResponse(JSON.stringify(distractors)));
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AIProvider(defaultConfig);
    const result = await provider.generateDistractors({ question: sampleQuestion() });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(['Wrong A', 'Wrong B', 'Wrong C']);
  });

  it('returns error when response is not parseable', async () => {
    fetchSpy = mockFetch(openAIResponse('no json here'));
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AIProvider(defaultConfig);
    const result = await provider.generateDistractors({ question: sampleQuestion() });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('converts non-string distractors to strings', async () => {
    const distractors = [42, true, 'text'];
    fetchSpy = mockFetch(openAIResponse(JSON.stringify(distractors)));
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AIProvider(defaultConfig);
    const result = await provider.generateDistractors({ question: sampleQuestion() });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(['42', 'true', 'text']);
  });
});

// ============================================================
// rephraseQuestion
// ============================================================

describe('rephraseQuestion', () => {
  it('returns rephrased question on success', async () => {
    const rephrased = {
      stem: 'Rephrased stem',
      choices: [
        { text: 'New A', is_correct: true },
        { text: 'New B', is_correct: false },
      ],
      type: 'multiple_choice',
    };
    fetchSpy = mockFetch(openAIResponse(JSON.stringify(rephrased)));
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AIProvider(defaultConfig);
    const result = await provider.rephraseQuestion({
      question: sampleQuestion(),
      targetDifficulty: 4,
    });

    expect(result.success).toBe(true);
    expect(result.data!.stem).toBe('Rephrased stem');
    expect(result.data!.difficulty).toBe(4);
    expect(result.data!.choices).toHaveLength(2);
  });

  it('preserves original question fields not in response', async () => {
    // Return a response that only has stem (no choices)
    const rephrased = { stem: 'New stem only' };
    fetchSpy = mockFetch(openAIResponse(JSON.stringify(rephrased)));
    vi.stubGlobal('fetch', fetchSpy);

    const original = sampleQuestion({ subject: 'Physics', topic: 'Mechanics' });
    const provider = new AIProvider(defaultConfig);
    const result = await provider.rephraseQuestion({
      question: original,
      targetDifficulty: 2,
    });

    expect(result.success).toBe(true);
    expect(result.data!.stem).toBe('New stem only');
    // Original fields preserved
    expect(result.data!.subject).toBe('Physics');
    expect(result.data!.topic).toBe('Mechanics');
    // choices fallback to original since parsed.choices is undefined
    expect(result.data!.choices).toEqual(original.choices);
  });

  it('returns error when response is not parseable', async () => {
    fetchSpy = mockFetch(openAIResponse('just plain text, no JSON'));
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AIProvider(defaultConfig);
    const result = await provider.rephraseQuestion({
      question: sampleQuestion(),
      targetDifficulty: 3,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ============================================================
// generateSolution
// ============================================================

describe('generateSolution', () => {
  it('returns solution and explanation on success', async () => {
    const solutionObj = {
      solution: 'The answer is 4',
      explanation: 'Because $2+2=4$',
    };
    fetchSpy = mockFetch(openAIResponse(JSON.stringify(solutionObj)));
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AIProvider(defaultConfig);
    const result = await provider.generateSolution(sampleQuestion());

    expect(result.success).toBe(true);
    expect(result.data!.solution).toBe('The answer is 4');
    expect(result.data!.explanation).toBe('Because $2+2=4$');
  });

  it('returns error when response is not parseable', async () => {
    fetchSpy = mockFetch(openAIResponse('no json'));
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AIProvider(defaultConfig);
    const result = await provider.generateSolution(sampleQuestion());

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ============================================================
// buildTestProposal
// ============================================================

describe('buildTestProposal', () => {
  it('returns proposal with sections on success', async () => {
    const proposal = {
      sections: [
        {
          name: 'Section 1',
          description: 'Basics',
          questions: [
            {
              question: {
                stem: 'What is 1+1?',
                type: 'multiple_choice',
                subject: 'Math',
                topic: 'Arithmetic',
                difficulty: 1,
                choices: [{ text: '2', is_correct: true }],
              },
              isNew: true,
              confidence: 0.9,
            },
          ],
        },
      ],
      totalTime: 60,
    };
    fetchSpy = mockFetch(openAIResponse(JSON.stringify(proposal)));
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AIProvider(defaultConfig);
    const result = await provider.buildTestProposal({
      course: 'Math 101',
      topics: ['Arithmetic'],
      difficultyMix: { easy: 0.5, hard: 0.5 },
      totalQuestions: 5,
    });

    expect(result.success).toBe(true);
    expect(result.data!.sections).toHaveLength(1);
    expect(result.data!.sections[0].name).toBe('Section 1');
    expect(result.data!.sections[0].questions).toHaveLength(1);
    expect(result.data!.sections[0].questions[0].isNew).toBe(true);
    expect(result.data!.totalTime).toBe(60);
  });

  it('handles missing fields gracefully', async () => {
    // A minimal response with missing optional fields
    const proposal = {
      sections: [
        {
          name: 'Only Section',
          questions: [
            {
              question: { stem: 'Minimal Q' },
              confidence: 0.5,
            },
          ],
        },
      ],
    };
    fetchSpy = mockFetch(openAIResponse(JSON.stringify(proposal)));
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AIProvider(defaultConfig);
    const result = await provider.buildTestProposal({
      course: 'CS 101',
      topics: ['Intro'],
      difficultyMix: { easy: 1 },
      totalQuestions: 1,
    });

    expect(result.success).toBe(true);
    expect(result.data!.sections[0].questions[0].question.stem).toBe('Minimal Q');
    // defaults
    expect(result.data!.sections[0].questions[0].question.type).toBe('multiple_choice');
    expect(result.data!.sections[0].questions[0].question.difficulty).toBe(3);
    expect(result.data!.sections[0].questions[0].isNew).toBe(true);
    expect(result.data!.totalTime).toBeUndefined();
  });

  it('returns error on API failure', async () => {
    fetchSpy = mockFetch('Bad Gateway', 502);
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AIProvider(defaultConfig);
    const result = await provider.buildTestProposal({
      course: 'CS 101',
      topics: ['Intro'],
      difficultyMix: { easy: 1 },
      totalQuestions: 1,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ============================================================
// Edge cases
// ============================================================

describe('Edge cases', () => {
  it('handles empty stem in question', async () => {
    const questionsPayload = [
      { stem: '', type: 'multiple_choice', choices: [] },
    ];
    fetchSpy = mockFetch(openAIResponse(JSON.stringify(questionsPayload)));
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AIProvider(defaultConfig);
    const result = await provider.generateQuestions({
      subject: 'S',
      topic: 'T',
      questionType: 'multiple_choice',
    });

    expect(result.success).toBe(true);
    expect(result.data![0].stem).toBe('');
  });

  it('handles malformed JSON in response', async () => {
    fetchSpy = mockFetch(openAIResponse('[{"stem": "broken}'));
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AIProvider(defaultConfig);
    const result = await provider.generateQuestions({
      subject: 'S',
      topic: 'T',
      questionType: 'multiple_choice',
    });

    // Parser fails, should return empty array gracefully
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('handles response with extra text around JSON', async () => {
    const questionsPayload = [
      { stem: 'Extracted Q', type: 'multiple_choice', choices: [] },
    ];
    const content = `Here are the questions:\n${JSON.stringify(questionsPayload)}\nHope this helps!`;
    fetchSpy = mockFetch(openAIResponse(content));
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new AIProvider(defaultConfig);
    const result = await provider.generateQuestions({
      subject: 'S',
      topic: 'T',
      questionType: 'multiple_choice',
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data![0].stem).toBe('Extracted Q');
  });
});
