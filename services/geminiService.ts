import { GoogleGenAI, Type } from "@google/genai";
import {
  WordDefinition,
  QuizQuestion,
  GrammarDefinition,
  ReadingMaterial,
  DiaryAnalysisResult,
  SentenceWord,
} from "../types";

const PRIMARY_MODEL = "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_TIMEOUT_MS = 20000;
const QUIZ_TIMEOUT_MS = 35000;

const getGeminiApiKey = (): string => {
  const viteKey =
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GEMINI_API_KEY) || "";
  if (viteKey && viteKey !== "undefined") return viteKey;
  try {
    const procKey =
      typeof process !== "undefined" ? process.env?.GEMINI_API_KEY || process.env?.API_KEY || "" : "";
    if (procKey && procKey !== "undefined") return procKey;
  } catch {
    // Ignore when process is unavailable in browser
  }
  return "";
};

let globalAiInstance: GoogleGenAI | null = null;
let cachedApiKey = "";

const getAiClient = (): GoogleGenAI => {
  const key = getGeminiApiKey();
  if (!key) {
    throw new Error("尚未設定 Gemini API 金鑰（請確認環境變數 VITE_GEMINI_API_KEY）。");
  }
  if (!globalAiInstance || cachedApiKey !== key) {
    globalAiInstance = new GoogleGenAI({ apiKey: key });
    cachedApiKey = key;
  }
  return globalAiInstance;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("GEMINI_TIMEOUT"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const isAuthError = (err: any): boolean => {
  const status = err?.status || err?.code;
  const rawMsg = String(err?.message || err || "");
  return (
    status === 400 ||
    status === 403 ||
    rawMsg.includes("API_KEY_INVALID") ||
    rawMsg.includes("PERMISSION_DENIED") ||
    rawMsg.includes("金鑰")
  );
};

const mapGeminiError = (err: any, actionLabel: string): Error => {
  if (err?.message === "GEMINI_TIMEOUT") {
    return new Error(`${actionLabel}連線逾時，請稍後再試或檢查網路連線。`);
  }

  const rawMsg = String(err?.message || err || "");
  const status = err?.status || err?.code;

  if (status === 429 || rawMsg.includes("RESOURCE_EXHAUSTED") || rawMsg.includes("quota") || rawMsg.includes("429")) {
    return new Error("目前請求太頻繁，請等 1 分鐘後再試。");
  }
  if (isAuthError(err)) {
    return new Error("Gemini API 金鑰無效或未設定，請確認 VITE_GEMINI_API_KEY。");
  }
  if (status === 404 || rawMsg.includes("NOT_FOUND")) {
    return new Error("無法存取指定的 AI 模型，請稍後再試。");
  }
  if (status === 500 || status === 503 || rawMsg.includes("UNAVAILABLE")) {
    return new Error("AI 伺服器暫時忙碌，請稍後幾秒再試。");
  }

  return new Error(rawMsg ? `${actionLabel}失敗：${rawMsg}` : `${actionLabel}失敗，請稍後再試。`);
};

const generateJsonWithModel = async <T>(
  model: string,
  contents: string,
  responseSchema: any,
  timeoutMs: number
): Promise<T> => {
  const client = getAiClient();
  const response = await withTimeout(
    client.models.generateContent({
      model,
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema,
      },
    }),
    timeoutMs
  );

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error("AI 回傳內容為空，請稍後再試。");
  }

  return JSON.parse(rawText) as T;
};

/**
 * 單次請求呼叫 AI：優先使用 gemini-3.8-flash；若遇忙碌、失敗或無回應（非金鑰錯誤），自動單次備援切換至 gemini-3.5-flash-lite。
 */
const callGeminiJson = async <T>(
  contents: string,
  responseSchema: any,
  actionLabel: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> => {
  try {
    return await generateJsonWithModel<T>(PRIMARY_MODEL, contents, responseSchema, timeoutMs);
  } catch (primaryErr: any) {
    if (isAuthError(primaryErr)) {
      console.error(`[日本語ごご！] ${actionLabel}驗證失敗:`, primaryErr);
      throw mapGeminiError(primaryErr, actionLabel);
    }

    console.warn(
      `[日本語ごご！] ${PRIMARY_MODEL} ${actionLabel}失敗，自動切換備援模型 ${FALLBACK_MODEL}:`,
      primaryErr
    );

    try {
      return await generateJsonWithModel<T>(FALLBACK_MODEL, contents, responseSchema, timeoutMs);
    } catch (fallbackErr: any) {
      console.error(`[日本語ごご！] 備援模型 ${FALLBACK_MODEL} ${actionLabel}亦失敗:`, fallbackErr);
      throw mapGeminiError(fallbackErr, actionLabel);
    }
  }
};

// --- LOCALSTORAGE CACHE HELPERS ---
const readLocalCache = <T>(mode: "WORD" | "GRAMMAR" | "READING", query: string): T | null => {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const key = `gogo_cache_${mode}_${query.trim()}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn("Failed to read localStorage cache:", e);
    return null;
  }
};

const writeLocalCache = <T>(mode: "WORD" | "GRAMMAR" | "READING", query: string, data: T): void => {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const key = `gogo_cache_${mode}_${query.trim()}`;
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to write localStorage cache:", e);
  }
};

// --- HEPBURN ROMAJI HELPER ---
export const toHepburnRomaji = (kana: string): string => {
  if (!kana) return "";
  const h = kana.replace(/[\u30a1-\u30f6]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0x60));

  const digraphs: Record<string, string> = {
    きゃ: "kya", きゅ: "kyu", きょ: "kyo",
    しゃ: "sha", しゅ: "shu", しょ: "sho",
    ちゃ: "cha", ちゅ: "chu", ちょ: "cho",
    にゃ: "nya", にゅ: "nyu", にょ: "nyo",
    ひゃ: "hya", ひゅ: "hyu", ひょ: "hyo",
    みゃ: "mya", みゅ: "myu", みょ: "myo",
    りゃ: "rya", りゅ: "ryu", りょ: "ryo",
    ぎゃ: "gya", ぎゅ: "gyu", ぎょ: "gyo",
    じゃ: "ja", じゅ: "ju", じょ: "jo",
    びゃ: "bya", びゅ: "byu", びょ: "byo",
    ぴゃ: "pya", ぴゅ: "pyu", ぴょ: "pyo",
    しぇ: "she", ちぇ: "che", じぇ: "je",
    てぃ: "ti", でぃ: "di", ふぁ: "fa",
    ふぃ: "fi", ふぇ: "fe", ふぉ: "fo",
    うぃ: "wi", うぇ: "we", うぉ: "wo",
  };

  const monographs: Record<string, string> = {
    あ: "a", い: "i", う: "u", え: "e", お: "o",
    か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
    さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
    た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
    な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
    は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
    ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
    や: "ya", ゆ: "yu", よ: "yo",
    ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
    わ: "wa", を: "o", ん: "n",
    が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
    ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
    だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
    ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
    ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
    ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o",
  };

  let result = "";
  let i = 0;
  while (i < h.length) {
    if (i + 1 < h.length) {
      const two = h.slice(i, i + 2);
      if (digraphs[two]) {
        result += digraphs[two];
        i += 2;
        continue;
      }
    }
    if (h[i] === "っ") {
      if (i + 1 < h.length) {
        const nextRomaji =
          (i + 2 < h.length && digraphs[h.slice(i + 1, i + 3)]) || monographs[h[i + 1]] || "";
        if (nextRomaji) {
          result += nextRomaji.startsWith("ch") ? "t" : nextRomaji[0];
        }
      }
      i++;
      continue;
    }
    if (h[i] === "ー") {
      const lastChar = result.slice(-1);
      if (/[aeiou]/.test(lastChar)) {
        result += lastChar;
      }
      i++;
      continue;
    }
    result += monographs[h[i]] || h[i];
    i++;
  }
  return result;
};

const formatPitchAccent = (pitch: string | number | undefined): string => {
  const raw = String(pitch ?? "0").trim();
  if (!raw) return "平板型 [0]";
  if (raw.includes("[")) return raw;
  const numMatch = raw.match(/\d+/);
  const num = numMatch ? numMatch[0] : raw;
  if (num === "0") return "平板型 [0]";
  if (num === "1") return "頭高型 [1]";
  return `中高/尾高 [${num}]`;
};

const normalizeWordDefinition = (raw: any, index: number): WordDefinition => {
  const furigana = String(raw.furigana || raw.reading || "").trim();
  const word = String(raw.word || furigana || "").trim();
  const romaji = String(raw.romaji || toHepburnRomaji(furigana || word)).trim();

  const meaningsArray: string[] = Array.isArray(raw.meanings)
    ? raw.meanings.map((m: any) => String(m).trim()).filter(Boolean)
    : raw.meaning
    ? [String(raw.meaning).trim()]
    : [];
  const meaningText = meaningsArray.join("；");

  const pitchVal = String(raw.pitch ?? raw.pitchAccent ?? "0").trim();
  const pitchAccent = formatPitchAccent(pitchVal);

  const examples = Array.isArray(raw.examples)
    ? raw.examples.slice(0, 2).map((ex: any) => ({
        sentence: String(ex?.sentence || "").trim(),
        reading: String(ex?.reading || "").trim(),
        translation: String(ex?.translation || "").trim(),
      }))
    : raw.exampleSentence
    ? [
        {
          sentence: String(raw.exampleSentence).trim(),
          reading: String(raw.exampleReading || "").trim(),
          translation: String(raw.exampleTranslation || "").trim(),
        },
      ]
    : [];

  return {
    id: raw.id || `w-${Date.now()}-${index}`,
    word,
    reading: furigana,
    furigana,
    romaji,
    pitch: pitchVal.replace(/[^\d]/g, "") || pitchVal,
    pitchAccent,
    partOfSpeech: String(raw.partOfSpeech || "").trim(),
    meanings: meaningsArray,
    meaning: meaningText,
    examples,
    exampleSentence: examples[0]?.sentence || "",
    exampleReading: examples[0]?.reading || "",
    exampleTranslation: examples[0]?.translation || "",
  };
};

// --- SCHEMAS ---
const wordDefinitionSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      word: { type: Type.STRING, description: "漢字或原詞" },
      furigana: { type: Type.STRING, description: "平假名讀音" },
      romaji: { type: Type.STRING, description: "赫本式羅馬拼音" },
      meanings: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "繁體中文釋義陣列",
      },
      pitch: { type: Type.STRING, description: "重音數字，例如 0, 1, 2" },
      partOfSpeech: { type: Type.STRING, description: "詞性，例如 名詞、五段動詞" },
      examples: {
        type: Type.ARRAY,
        description: "1至2句實用例句",
        items: {
          type: Type.OBJECT,
          properties: {
            sentence: { type: Type.STRING },
            reading: { type: Type.STRING },
            translation: { type: Type.STRING },
          },
          required: ["sentence", "reading", "translation"],
        },
      },
    },
    required: ["word", "furigana", "romaji", "meanings", "pitch", "examples"],
  },
};

const grammarSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      grammarPoint: { type: Type.STRING, description: "文法句型" },
      connection: { type: Type.STRING, description: "接續方式（繁體中文）" },
      meaning: { type: Type.STRING, description: "核心中文語意" },
      explanation: { type: Type.STRING, description: "簡潔用法說明（繁體中文）" },
      examples: {
        type: Type.ARRAY,
        description: "2句實用例句",
        items: {
          type: Type.OBJECT,
          properties: {
            sentence: { type: Type.STRING },
            reading: { type: Type.STRING },
            translation: { type: Type.STRING },
            breakdown: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  reading: { type: Type.STRING },
                  meaning: { type: Type.STRING },
                },
                required: ["word", "reading", "meaning"],
              },
            },
          },
          required: ["sentence", "reading", "translation"],
        },
      },
    },
    required: ["grammarPoint", "connection", "meaning", "explanation", "examples"],
  },
};

const readingSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "文章標題" },
    content: { type: Type.STRING, description: "日文原文" },
    translation: { type: Type.STRING, description: "繁體中文翻譯" },
    tokens: {
      type: Type.ARRAY,
      description: "重點單字與文法",
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          dictionaryForm: { type: Type.STRING },
          reading: { type: Type.STRING },
          meaning: { type: Type.STRING },
          type: { type: Type.STRING, enum: ["VOCAB", "GRAMMAR"] },
          jlpt: { type: Type.STRING, enum: ["N5", "N4", "N3", "N2", "N1", "Unknown"] },
          partOfSpeech: { type: Type.STRING },
          pitchAccent: { type: Type.STRING },
          exampleSentence: { type: Type.STRING },
          exampleReading: { type: Type.STRING },
          exampleTranslation: { type: Type.STRING },
        },
        required: [
          "text",
          "dictionaryForm",
          "reading",
          "meaning",
          "type",
          "jlpt",
          "exampleSentence",
          "exampleReading",
          "exampleTranslation",
        ],
      },
    },
  },
  required: ["title", "content", "translation", "tokens"],
};

const quizSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      type: { type: Type.STRING, enum: ["vocab", "grammar", "ordering", "reading"] },
      context: { type: Type.STRING, description: "僅 reading 題型填寫 80~120 字獨立日文短文，其餘題型留空字串" },
      instruction: { type: Type.STRING, description: "JLPT 作答指示語" },
      question: { type: Type.STRING, description: "題幹句子（漢字讀音用【漢字】、填空用 ___、重組用 ①＿＿ ②＿＿ ③★＿＿ ④＿＿）" },
      sentence: { type: Type.STRING, description: "重組題專用：含前置語境與 ①＿＿ ②＿＿ ③★＿＿ ④＿＿" },
      scrambleItems: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "重組題專用：4 個純詞段",
      },
      questionReading: { type: Type.STRING, description: "題幹平假名讀音" },
      questionTranslation: { type: Type.STRING, description: "題幹繁體中文翻譯" },
      options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "4 個純文字選項（無 A/1 前綴、無結尾句號）" },
      correctAnswerIndex: { type: Type.INTEGER, description: "正解索引 0~3" },
      explanation: { type: Type.STRING, description: "繁體中文詳解" },
    },
    required: [
      "id",
      "type",
      "instruction",
      "question",
      "questionReading",
      "questionTranslation",
      "options",
      "correctAnswerIndex",
      "explanation",
    ],
  },
};

// ==========================================
// 1. 單字查詢（LocalStorage 快取 + 單次 AI 解析）
// ==========================================
export const fetchWordDefinitions = async (query: string): Promise<WordDefinition[]> => {
  const queryStr = query.trim();
  if (!queryStr) return [];

  const cached = readLocalCache<WordDefinition[]>("WORD", queryStr);
  if (Array.isArray(cached) && cached.length > 0) {
    return cached.map((item, idx) => normalizeWordDefinition(item, idx));
  }

  const prompt = `解析日文單字：「${queryStr}」。
請用繁體中文精簡輸出：word(原詞)、furigana(平假名)、romaji(羅馬拼音)、meanings(中文釋義陣列)、pitch(重音數字)、partOfSpeech(詞性)、examples(1~2句日文例句含 reading 與繁中 translation)。嚴禁 Emoji。`;

  const rawList = await callGeminiJson<any[]>(prompt, wordDefinitionSchema, "單字解析");
  if (!Array.isArray(rawList) || rawList.length === 0) {
    throw new Error(`找不到「${queryStr}」的日文解析結果，請確認輸入內容後再試。`);
  }

  const formatted = rawList.map((item, idx) => normalizeWordDefinition(item, idx));
  writeLocalCache("WORD", queryStr, formatted);
  return formatted;
};

export const lookupJapanese = fetchWordDefinitions;

// ==========================================
// 2. 文法解析（LocalStorage 快取 + 單次 AI 解析）
// ==========================================
export const fetchGrammarDetails = async (grammarInput: string): Promise<GrammarDefinition[]> => {
  const queryStr = grammarInput.trim();
  if (!queryStr) return [];

  const cached = readLocalCache<GrammarDefinition[]>("GRAMMAR", queryStr);
  if (Array.isArray(cached) && cached.length > 0) {
    return cached;
  }

  const prompt = `解析日文文法：「${queryStr}」。
請以繁體中文精簡提供：grammarPoint(句型)、connection(接續方式)、meaning(核心語意)、explanation(用法說明)、examples(2句例句含 sentence、reading、translation 與 2~3 個 breakdown 重點單字)。嚴禁 Emoji。`;

  const data = await callGeminiJson<any[]>(prompt, grammarSchema, "文法解析");
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`找不到「${queryStr}」的文法解析結果，請確認輸入內容後再試。`);
  }

  const formatted: GrammarDefinition[] = data.map((d, i) => ({
    ...d,
    id: d.id || `g-${Date.now()}-${i}`,
  }));

  writeLocalCache("GRAMMAR", queryStr, formatted);
  return formatted;
};

// ==========================================
// 3. 文章解析（LocalStorage 快取 + 單次 AI 解析）
// ==========================================
export const analyzeReadingText = async (input: string): Promise<ReadingMaterial> => {
  const queryStr = input.trim();
  if (!queryStr) {
    throw new Error("請輸入欲解析的日文文章。");
  }

  const cached = readLocalCache<ReadingMaterial>("READING", queryStr);
  if (cached && cached.content) {
    return cached;
  }

  const prompt = `解析以下日文文章（繁體中文、精簡清晰、嚴禁 Emoji）：
「${queryStr}」
提供 title、content(原文)、translation(繁中翻譯)，並萃取重點單字(VOCAB)與文法(GRAMMAR)至 tokens（含 dictionaryForm, reading, meaning, jlpt, partOfSpeech, pitchAccent 及 1 句簡短例句）。`;

  const data = await callGeminiJson<Omit<ReadingMaterial, "id">>(prompt, readingSchema, "文章解析");
  if (!data || !data.content) {
    throw new Error("文章解析回傳格式不完整，請稍後再試。");
  }

  const formatted: ReadingMaterial = {
    ...data,
    id: `r-${Date.now()}`,
  };

  writeLocalCache("READING", queryStr, formatted);
  return formatted;
};

// ==========================================
// 4. 輔助查詢（句中單字、推薦詞彙/文法/文章）
// ==========================================
export const fetchSentenceVocabulary = async (sentence: string): Promise<SentenceWord[]> => {
  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        word: { type: Type.STRING },
        reading: { type: Type.STRING },
        meaning: { type: Type.STRING },
      },
      required: ["word", "reading", "meaning"],
    },
  };
  const prompt = `從日文例句「${sentence.trim()}」萃取 2~5 個重點單字（原形、平假名、繁中釋義，無 Emoji）。`;
  return callGeminiJson<SentenceWord[]>(prompt, schema, "例句詞彙拆解");
};

export const fetchRecommendedWords = async (
  level: string,
  count: number,
  exclude: string[] = [],
  category?: string
): Promise<WordDefinition[]> => {
  const catText = category ? `、主題「${category}」` : "";
  const excludeText = exclude.length > 0 ? `，排除：[${exclude.slice(0, 30).join(",")}]` : "";
  const prompt = `推薦 ${count} 個 JLPT ${level}${catText}實用單字${excludeText}。回傳 word, furigana, romaji, meanings(繁中), pitch, partOfSpeech, examples(1~2句)，無 Emoji。`;
  const rawList = await callGeminiJson<any[]>(prompt, wordDefinitionSchema, "推薦單字");
  return rawList.map((item, idx) => normalizeWordDefinition(item, idx));
};

export const fetchRecommendedGrammar = async (
  level: string,
  count: number,
  exclude: string[]
): Promise<GrammarDefinition[]> => {
  const excludeText = exclude.length > 0 ? `，排除：[${exclude.slice(0, 30).join(",")}]` : "";
  const prompt = `推薦 ${count} 個 JLPT ${level} 實用文法${excludeText}。繁體中文解說與2句例句，無 Emoji。`;
  const data = await callGeminiJson<any[]>(prompt, grammarSchema, "推薦文法");
  return data.map((d, i) => ({ ...d, id: `g-rec-${Date.now()}-${i}` }));
};

export const generateRecommendedReading = async (level: string): Promise<ReadingMaterial> => {
  const prompt = `創作一篇適合 JLPT ${level} 的日文短文（100~150字），附繁中標題、翻譯與重點 tokens，無 Emoji。`;
  const data = await callGeminiJson<Omit<ReadingMaterial, "id">>(prompt, readingSchema, "推薦閱讀");
  return { ...data, id: `r-rec-${Date.now()}` };
};

// ==========================================
// 5. 極簡測驗出題（單次請求直接生成指定題數，避免超時或爆 RPM）
// ==========================================
export interface DailyStudyQuizItem {
  type: "WORD" | "GRAMMAR" | "READING";
  term: string;
  summary?: string;
  detail?: string;
  content?: string;
}

const buildCompactStudyContext = (items: DailyStudyQuizItem[]): { summaryText: string; articleText: string } => {
  const terms: string[] = [];
  let articleText = "";

  for (const it of items) {
    if (it.type === "READING" && it.content) {
      if (!articleText) {
        articleText = it.content.trim().slice(0, 600);
      }
      terms.push(`[文章] ${it.term}`);
    } else {
      terms.push(
        `[${it.type === "GRAMMAR" ? "文法" : "單字"}] ${it.term}${it.summary ? `(${it.summary.slice(0, 30)})` : ""}`
      );
    }
  }

  return {
    summaryText: terms.slice(0, 20).join("、"),
    articleText,
  };
};

const normalizeQuizQuestions = (list: QuizQuestion[]): QuizQuestion[] => {
  return list.map((q, idx) => {
    const cleanOptions = Array.isArray(q.options)
      ? q.options.slice(0, 4).map((opt) =>
          String(opt || "")
            .replace(/^[A-Da-d1-4][.、\s):-]+\s*/, "")
            .replace(/[。.\s]+$/, "")
            .trim()
        )
      : [];

    const safeIdx =
      typeof q.correctAnswerIndex === "number" && q.correctAnswerIndex >= 0 && q.correctAnswerIndex < 4
        ? q.correctAnswerIndex
        : 0;

    return {
      ...q,
      id: q.id || `q_${Date.now()}_${idx}`,
      options: cleanOptions,
      correctAnswerIndex: safeIdx,
    };
  });
};

export const generateDailyStudyQuiz = async (
  items: DailyStudyQuizItem[],
  questionCount: number = 15
): Promise<QuizQuestion[]> => {
  const safeCount = Math.max(3, Math.min(questionCount || 15, 15));
  const { summaryText, articleText } = buildCompactStudyContext(items);

  const focusNote = summaryText
    ? `出題目標內容：${summaryText}${articleText ? `\n參考文章：「${articleText}」` : ""}`
    : "出題範圍：JLPT N4~N3 實用日語綜合能力";

  const distributionNote =
    safeCount === 15
      ? "題型平均混合共 15 題：漢字讀音題（3題）、單字填空題（3題）、文法助詞題（3題）、句子排序題（3題）、短文理解題（3題）。"
      : safeCount === 10
      ? "題型平均混合共 10 題：漢字讀音題（2題）、單字填空題（2題）、文法助詞題（2題）、句子排序題（2題）、短文理解題（2題）。"
      : safeCount === 5
      ? "題型平均混合共 5 題：漢字讀音、單字填空、文法助詞、句子排序、短文理解各 1 題。"
      : "共 3 題：漢字讀音題 1 題、句子排序題 1 題、短文理解題 1 題。";

  const prompt = `你是專業 JLPT 日語教師，請透過「單次生成」設計剛好 ${safeCount} 題多元日文選擇題。
${focusNote}

【題型分配】
${distributionNote}

【各題型規格】
1. 漢字讀音題 (type:"vocab")：context 留空 ""；instruction 為「下線部の漢字の読み方として最もよいものを、1・2・3・4 から一つ選びなさい。」；question 為完整日文句並以【漢字】標示目標字詞；options 為 4 個平假名。
2. 單字填空題 (type:"vocab")：context 留空 ""；instruction 為「（　）に入る最もよいものを、1・2・3・4 から一つ選びなさい。」；question 含 ___ 挖空，選出最合文意的單字。
3. 文法助詞題 (type:"grammar")：context 留空 ""；instruction 為「文の文法として最もよいものを、1・2・3・4 から一つ選びなさい。」；question 含 ___ 挖空，測試助詞、接續詞或動詞變化。
4. 句子排序題 (type:"ordering")：context 留空 ""；instruction 為「★ に入る最もよいものを、1・2・3・4 から一つ選びなさい。」；sentence 含前置語境與「①＿＿ ②＿＿ ③★＿＿ ④＿＿」，scrambleItems 與 options 為 4 個詞段且語法唯一解（4!=24 僅 1 種順序合法），correctAnswerIndex 指向 ★ 位置。
5. 短文理解題 (type:"reading")：instruction 為「文章を読んで、次の問いに最も適した答えを選びなさい。」；每題 context 必須各自撰寫一篇 80~120 字完全獨立、不同生活或職場主題的日文短文（嚴禁重複相同句型模板），question 針對該短文提問。

【嚴格規定】
- options 為 4 個純文字選項（禁止 A./1. 等前綴，結尾不可加句號），correctAnswerIndex 為 0~3。
- 每題必附 questionReading（平假名）、questionTranslation（繁中）與精簡繁體中文 explanation。
- 嚴禁 Emoji 與程式碼字樣（禁止 \\n 字面值與反引號）。
請直接回傳剛好 ${safeCount} 題的 JSON 陣列。`;

  const generated = await callGeminiJson<QuizQuestion[]>(prompt, quizSchema, "測驗出題", QUIZ_TIMEOUT_MS);
  if (!Array.isArray(generated) || generated.length === 0) {
    throw new Error("未取得有效測驗題目，請稍後再試。");
  }

  return normalizeQuizQuestions(generated);
};

export const generateQuizFromContent = async (
  words: WordDefinition[],
  grammar: GrammarDefinition[],
  specificPrompt?: string,
  questionCount: number = 15,
  jlptLevel?: string,
  sourceArticle?: string
): Promise<QuizQuestion[]> => {
  const items: DailyStudyQuizItem[] = [
    ...words.map((w) => ({ type: "WORD" as const, term: w.word, summary: w.meaning })),
    ...grammar.map((g) => ({ type: "GRAMMAR" as const, term: g.grammarPoint, summary: g.meaning })),
  ];
  if (sourceArticle?.trim()) {
    items.push({ type: "READING", term: "文章閱讀", content: sourceArticle.trim() });
  }
  if (specificPrompt?.trim()) {
    items.push({
      type: "WORD",
      term: specificPrompt.trim(),
      summary: jlptLevel ? `JLPT ${jlptLevel}` : undefined,
    });
  }
  return generateDailyStudyQuiz(items, questionCount);
};

export const generateTargetedQuiz = async (
  targetItem: string,
  questionCount: number = 3,
  level?: string
): Promise<QuizQuestion[]> => {
  const safeCount = questionCount <= 3 ? 3 : 5;
  return generateDailyStudyQuiz(
    [{ type: "WORD", term: targetItem.trim(), summary: level ? `JLPT ${level}` : undefined }],
    safeCount
  );
};

// ==========================================
// 6. 聽力練習與日記批改
// ==========================================
const listeningSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    fullContent: { type: Type.STRING },
    translation: { type: Type.STRING },
    segments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          reading: { type: Type.STRING },
          translation: { type: Type.STRING },
          tokens: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                dictionaryForm: { type: Type.STRING },
                reading: { type: Type.STRING },
                meaning: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["VOCAB", "GRAMMAR"] },
                jlpt: { type: Type.STRING, enum: ["N5", "N4", "N3", "N2", "N1", "Unknown"] },
                partOfSpeech: { type: Type.STRING },
              },
              required: ["text", "dictionaryForm", "reading", "meaning", "type", "jlpt", "partOfSpeech"],
            },
          },
        },
        required: ["text", "reading", "translation", "tokens"],
      },
    },
  },
  required: ["title", "fullContent", "translation", "segments"],
};

export const fetchListeningMaterial = async (level: string): Promise<any> => {
  const prompt = `生成 JLPT ${level} 日文聽力對話練習（純淨男女對話，嚴禁 XML/HTML/SSML 標籤，行首使用「女：」「男：」），附逐句假名、繁中翻譯與重點詞彙。`;
  const data = await callGeminiJson<any>(prompt, listeningSchema, "聽力教材生成");
  return { ...data, level };
};

export const checkListeningAnswer = async (correctText: string, userInput: string): Promise<any> => {
  const schema = {
    type: Type.OBJECT,
    properties: {
      correct: { type: Type.BOOLEAN },
      similarity: { type: Type.NUMBER },
      feedback: { type: Type.STRING },
    },
    required: ["correct", "similarity", "feedback"],
  };
  const prompt = `比對聽寫日文。正解：「${correctText}」；作答：「${userInput}」。計算相似度(0-100)並以繁體中文簡潔回饋。`;
  return callGeminiJson<any>(prompt, schema, "聽寫比對");
};

const diaryAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    correctedFullText: { type: Type.STRING },
    overallFeedback: { type: Type.STRING },
    jlptEstimatedLevel: { type: Type.STRING },
    corrections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          originalText: { type: Type.STRING },
          correctedText: { type: Type.STRING },
          explanation: { type: Type.STRING },
          grammarPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["originalText", "correctedText", "explanation"],
      },
    },
    vocabGrammarList: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          expression: { type: Type.STRING },
          reading: { type: Type.STRING },
          meaning: { type: Type.STRING },
          type: { type: Type.STRING, enum: ["VOCAB", "GRAMMAR"] },
        },
        required: ["expression", "reading", "meaning", "type"],
      },
    },
  },
  required: ["title", "correctedFullText", "overallFeedback", "jlptEstimatedLevel", "corrections"],
};

export const fetchDiaryCorrection = async (content: string): Promise<DiaryAnalysisResult> => {
  const prompt = `批改初學者（N5~N4程度）的日文日記，保持原意與換行排版（\\n），僅針對明顯錯誤提供繁體中文修正說明，並整理 3~5 個實用單字文法，無 Emoji：
「${content}」`;
  return callGeminiJson<DiaryAnalysisResult>(prompt, diaryAnalysisSchema, "日記批改");
};
