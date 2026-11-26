import { GoogleGenAI, Type } from "@google/genai";
import {
  WordDefinition,
  QuizQuestion,
  GrammarDefinition,
  ReadingMaterial,
  DiaryAnalysisResult,
  SentenceWord,
} from "../types";

const MODEL_NAME = "gemini-2.5-flash";
const REQUEST_TIMEOUT_MS = 15000;

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
    throw new Error("尚未設定 Gemini API 金鑰（請確認環境變數 VITE_GEMINI_API_KEY），無法連線解析。");
  }
  if (!globalAiInstance || cachedApiKey !== key) {
    globalAiInstance = new GoogleGenAI({ apiKey: key });
    cachedApiKey = key;
  }
  return globalAiInstance;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<T> => {
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

const mapGeminiError = (err: any, actionLabel: string): Error => {
  if (err?.message === "GEMINI_TIMEOUT") {
    return new Error(`${actionLabel}連線逾時（超過 15 秒未回應），請稍後再試或檢查網路連線。`);
  }

  const rawMsg = String(err?.message || err || "");
  const status = err?.status || err?.code;

  if (status === 429 || rawMsg.includes("RESOURCE_EXHAUSTED") || rawMsg.includes("quota") || rawMsg.includes("429")) {
    return new Error("目前查詢人數較多或免費 API 額度暫滿，請稍後幾秒再試。");
  }
  if (
    status === 400 ||
    status === 403 ||
    rawMsg.includes("API_KEY_INVALID") ||
    rawMsg.includes("PERMISSION_DENIED") ||
    rawMsg.includes("金鑰")
  ) {
    return new Error("Gemini API 金鑰無效或未設定，請確認 VITE_GEMINI_API_KEY。");
  }
  if (status === 404 || rawMsg.includes("NOT_FOUND")) {
    return new Error(`無法存取 AI 模型（${MODEL_NAME}），請確認模型設定是否正確。`);
  }
  if (status === 500 || status === 503 || rawMsg.includes("UNAVAILABLE")) {
    return new Error("AI 伺服器暫時忙碌，請稍後幾秒再試。");
  }

  return new Error(rawMsg ? `${actionLabel}失敗：${rawMsg}` : `${actionLabel}失敗，請確認網路連線後再試。`);
};

const callGeminiJson = async <T>(
  contents: string,
  responseSchema: any,
  actionLabel: string,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<T> => {
  try {
    const client = getAiClient();
    const response = await withTimeout(
      client.models.generateContent({
        model: MODEL_NAME,
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
  } catch (err: any) {
    console.error(`[日本語ごご！] ${actionLabel}錯誤:`, err);
    throw mapGeminiError(err, actionLabel);
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

// --- HEPBURN ROMAJI HELPER (用於補全沒有 romaji 的舊快取或缺失欄位) ---
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

// --- COMPACT SCHEMAS ---
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
      explanation: { type: Type.STRING, description: "簡潔精準的用法與語氣說明（繁體中文）" },
      examples: {
        type: Type.ARRAY,
        description: "2句實用例句與重點詞彙整理",
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
    translation: { type: Type.STRING, description: "流暢的繁體中文逐句對照翻譯" },
    tokens: {
      type: Type.ARRAY,
      description: "萃取重點單字與文法",
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
      context: { type: Type.STRING, description: "閱讀題短文本文（僅 reading 題型填寫 80~120 字日文短文，其餘題型留空字串）" },
      instruction: { type: Type.STRING, description: "JLPT 作答指示語" },
      question: { type: Type.STRING, description: "題幹句子（漢字讀音用【漢字】標示，填空用 ___，重組用 ①＿＿ ②＿＿ ③★＿＿ ④＿＿）" },
      sentence: { type: Type.STRING, description: "重組題專用：含前置語境與 ①＿＿ ②＿＿ ③★＿＿ ④＿＿ 的完整句型" },
      scrambleItems: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "重組題專用：4 個純詞段（無編號、無句號）",
      },
      questionReading: { type: Type.STRING, description: "題幹完整平假名讀音" },
      questionTranslation: { type: Type.STRING, description: "題幹繁體中文翻譯" },
      options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "4 個純文字選項（無 A/B/C/D 或 1/2/3/4 前綴）" },
      correctAnswerIndex: { type: Type.INTEGER, description: "正解索引 0~3" },
      explanation: { type: Type.STRING, description: "精準繁體中文詳解" },
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
// 1. 單字查詢（LocalStorage 快取 + Gemini 2.5 Flash）
// ==========================================
export const fetchWordDefinitions = async (query: string): Promise<WordDefinition[]> => {
  const queryStr = query.trim();
  if (!queryStr) return [];

  const cached = readLocalCache<WordDefinition[]>("WORD", queryStr);
  if (Array.isArray(cached) && cached.length > 0) {
    return cached.map((item, idx) => normalizeWordDefinition(item, idx));
  }

  const prompt = `解析日文單字：「${queryStr}」（若有多個詞請逐一解析）。
要求：
1. word(漢字或原詞)、furigana(平假名)、romaji(赫本拼音)、meanings(繁體中文釋義陣列)、pitch(重音數字如"0","1")、partOfSpeech(詞性)。
2. examples：1~2句自然實用例句（sentence, reading, translation繁體中文）。
3. 嚴禁任何表情符號(Emoji)，回覆精簡勿贅述。`;

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
// 2. 文法解析（LocalStorage 快取 + Gemini 2.5 Flash）
// ==========================================
export const fetchGrammarDetails = async (grammarInput: string): Promise<GrammarDefinition[]> => {
  const queryStr = grammarInput.trim();
  if (!queryStr) return [];

  const cached = readLocalCache<GrammarDefinition[]>("GRAMMAR", queryStr);
  if (Array.isArray(cached) && cached.length > 0) {
    return cached;
  }

  const prompt = `解析日文文法：「${queryStr}」。
要求（繁體中文、精簡清晰）：
1. grammarPoint(標準句型)、connection(接續規則)、meaning(核心語意)、explanation(語氣與使用注意)。
2. examples：2句自然例句，含 sentence、reading(平假名)、translation(繁中) 及 2~3 個 breakdown 重點單字。
3. 嚴禁 Emoji。`;

  const data = await callGeminiJson<any[]>(prompt, grammarSchema, "文法解析");
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`找不到「${queryStr}」的文法解析結果，請確認輸入後再試。`);
  }

  const formatted: GrammarDefinition[] = data.map((d, i) => ({
    ...d,
    id: d.id || `g-${Date.now()}-${i}`,
  }));

  writeLocalCache("GRAMMAR", queryStr, formatted);
  return formatted;
};

// ==========================================
// 3. 文章解析（LocalStorage 快取 + Gemini 2.5 Flash）
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

  const prompt = `解析以下日文文章（精簡清晰、繁體中文、嚴禁 Emoji）：
「${queryStr}」
要求：
1. title(簡潔標題)、content(完整原文)、translation(流暢繁中翻譯)。
2. tokens：萃取文章重點單字(VOCAB)與文法(GRAMMAR)，提供 dictionaryForm、reading、meaning、jlpt、partOfSpeech、pitchAccent 與 1 句實用簡短例句(exampleSentence, exampleReading, exampleTranslation)。`;

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
  const prompt = `創作一篇適合 JLPT ${level} 的簡短日文生活或文化短文（100~160字），附繁中標題、全文翻譯與重點詞彙文法 tokens，無 Emoji。`;
  const data = await callGeminiJson<Omit<ReadingMaterial, "id">>(prompt, readingSchema, "推薦閱讀");
  return { ...data, id: `r-rec-${Date.now()}` };
};

// ==========================================
// 5. JLPT 模擬測驗出題（15 題拆為 3 個並行 5 題請求，確保 5 題型均分且不逾時）
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
      terms.push(`[${it.type === "GRAMMAR" ? "文法" : "單字"}] ${it.term}${it.summary ? `(${it.summary.slice(0, 30)})` : ""}`);
    }
  }

  return {
    summaryText: terms.slice(0, 20).join("、"),
    articleText,
  };
};

const QUIZ_COMMON_RULES = `共用規則（嚴格遵守）：
1. 繁體中文解說與翻譯，嚴禁 Emoji 與任何程式碼字樣（禁止 \\n 字面值、反引號）。
2. options 固定 4 個純文字選項（禁止 A./1. 等前綴，結尾不可加句號）。
3. correctAnswerIndex 為 0~3 整數；每題必附 questionReading（平假名）、questionTranslation（繁中）與精準繁中 explanation。`;

const normalizeQuizBatch = (list: QuizQuestion[], prefix: string): QuizQuestion[] => {
  if (!Array.isArray(list)) return [];
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
      id: q.id || `${prefix}_${Date.now()}_${idx}`,
      options: cleanOptions,
      correctAnswerIndex: safeIdx,
    };
  });
};

const fetchQuizBatch = async (prompt: string, batchTag: string): Promise<QuizQuestion[]> => {
  const result = await callGeminiJson<QuizQuestion[]>(prompt, quizSchema, `測驗出題(${batchTag})`);
  if (!Array.isArray(result) || result.length === 0) {
    throw new Error(`測驗批次（${batchTag}）未回傳有效題目，請重試。`);
  }
  return normalizeQuizBatch(result, batchTag);
};

export const generateDailyStudyQuiz = async (
  items: DailyStudyQuizItem[],
  questionCount: number = 15
): Promise<QuizQuestion[]> => {
  const { summaryText, articleText } = buildCompactStudyContext(items);
  const focusNote = summaryText
    ? `測驗核心範圍：${summaryText}${articleText ? `\n參考文章節錄：「${articleText}」` : ""}`
    : "測驗範圍：JLPT N4~N3 實用日語綜合能力";

  // 15 題模式：拆成 3 個並行請求（每次 5 題），強制 5 種題型各 3 題
  if (questionCount === 15) {
    const batch1Prompt = `你是 JLPT 出題專家。根據以下內容設計 5 題日文測驗（無需文章 context，context 留空字串 ""）：
${focusNote}

題型配額（共 5 題）：
- 第 1~3 題（3 題漢字讀音題, type:"vocab"）：instruction 固定為「下線部の漢字の読み方として最もよいものを、1・2・3・4 から一つ選びなさい。」。question 為完整自然日文句子並將目標漢字以【漢字】框出，options 為 4 個平假名。
- 第 4~5 題（2 題單字選填題, type:"vocab"）：instruction 固定為「（　）に入る最もよいものを、1・2・3・4 から一つ選びなさい。」。question 為完整日文句子並以 ___ 挖空，選出最合文意的單字。

${QUIZ_COMMON_RULES}
請回傳剛好 5 題。`;

    const batch2Prompt = `你是 JLPT 出題專家。根據以下內容設計 5 題日文測驗（context 留空字串 ""）：
${focusNote}

題型配額（共 5 題）：
- 第 1 題（1 題單字選填題, type:"vocab"）：instruction 固定為「（　）に入る最もよいものを、1・2・3・4 から一つ選びなさい。」。question 含 ___ 挖空。
- 第 2~4 題（3 題文法助詞與接續題, type:"grammar"）：instruction 固定為「文の文法として最もよいものを、1・2・3・4 から一つ選びなさい。」。question 含 ___ 挖空，測試助詞、接續詞或動詞/形容詞變化，干擾項須有明確文法錯誤。
- 第 5 題（1 題句子重組排序題, type:"ordering"）：instruction 固定為「★ に入る最もよいものを、1・2・3・4 から一つ選びなさい。」。sentence 須有前置語境並包含「①＿＿ ②＿＿ ③★＿＿ ④＿＿」，scrambleItems 與 options 為 4 個詞段，語法唯一解（4!=24 中僅1種順序合法，嚴禁對稱比較句多解），correctAnswerIndex 指向 ★ 位置詞段。

${QUIZ_COMMON_RULES}
請回傳剛好 5 題。`;

    const batch3Prompt = `你是 JLPT 出題專家。根據以下內容設計 5 題日文測驗：
${focusNote}

題型配額（共 5 題）：
- 第 1~2 題（2 題句子重組排序題, type:"ordering"）：context 留空 ""；instruction 為「★ に入る最もよいものを、1・2・3・4 から一つ選びなさい。」；sentence 須有前置語境並含「①＿＿ ②＿＿ ③★＿＿ ④＿＿」，scrambleItems 與 options 為 4 個詞段，語法唯一解（4!=24 中僅1種順序合法），correctAnswerIndex 指向 ★ 位置。
- 第 3~5 題（3 題短文閱讀理解題, type:"reading"）：instruction 為「文章を読んで、次の問いに最も適した答えを選びなさい。」。每題必須於 context 撰寫一篇 80~120 字完全獨立、主題截然不同的日本生活或職場短文（例如：第1篇為職場郵件/會議通知、第2篇為日常交通/購物經驗、第3篇為社區公告/季節生活；若有提供參考文章，僅限其中1篇改編使用，其餘2篇必為全新主題），嚴禁重複句型模板。question 為針對該篇短文的精準理解提問。

${QUIZ_COMMON_RULES}
請回傳剛好 5 題。`;

    const [b1, b2, b3] = await Promise.all([
      fetchQuizBatch(batch1Prompt, "b1_kanji_vocab"),
      fetchQuizBatch(batch2Prompt, "b2_vocab_grammar_order"),
      fetchQuizBatch(batch3Prompt, "b3_order_reading"),
    ]);

    // 依嚴格題型區間組合：1~3 漢字讀音、4~6 單字選填、7~9 文法、10~12 重組、13~15 短文閱讀
    const kanjiQs = b1.slice(0, 3).map((q) => ({ ...q, type: "vocab" as const, context: "" }));
    const vocabFillQs = [...b1.slice(3, 5), ...b2.slice(0, 1)].map((q) => ({
      ...q,
      type: "vocab" as const,
      context: "",
    }));
    const grammarQs = b2.slice(1, 4).map((q) => ({ ...q, type: "grammar" as const, context: "" }));
    const orderingQs = [...b2.slice(4, 5), ...b3.slice(0, 2)].map((q) => ({
      ...q,
      type: "ordering" as const,
      context: "",
    }));
    const readingQs = b3.slice(2, 5).map((q) => ({ ...q, type: "reading" as const }));

    const combined = [...kanjiQs, ...vocabFillQs, ...grammarQs, ...orderingQs, ...readingQs];
    for (const rq of readingQs) {
      if (!rq.context || rq.context.trim().length < 30) {
        throw new Error("閱讀題短文生成不完整，請點擊重新生成測驗。");
      }
    }
    return combined;
  }

  // 10 題模式：拆成 2 個並行 5 題請求（5 題型各 2 題）
  if (questionCount === 10) {
    const batch1Prompt = `你是 JLPT 出題專家。根據以下內容設計 5 題日文測驗（context 留空 ""）：
${focusNote}
配額：
- 第 1~2 題：漢字讀音題（type:"vocab", instruction:"下線部の漢字の読み方として最もよいものを、1・2・3・4 から一つ選びなさい。", question含【漢字】）。
- 第 3~4 題：單字選填題（type:"vocab", instruction:"（　）に入る最もよいものを、1・2・3・4 から一つ選びなさい。", question含 ___）。
- 第 5 題：文法助詞與接續題（type:"grammar", instruction:"文の文法として最もよいものを、1・2・3・4 から一つ選びなさい。", question含 ___）。
${QUIZ_COMMON_RULES}
回傳剛好 5 題。`;

    const batch2Prompt = `你是 JLPT 出題專家。根據以下內容設計 5 題日文測驗：
${focusNote}
配額：
- 第 1 題：文法助詞與接續題（type:"grammar", context:"", instruction:"文の文法として最もよいものを、1・2・3・4 から一つ選びなさい。", question含 ___）。
- 第 2~3 題：句子重組排序題（type:"ordering", context:"", instruction:"★ に入る最もよいものを、1・2・3・4 から一つ選びなさい。", sentence含前置語境與 ①＿＿ ②＿＿ ③★＿＿ ④＿＿，scrambleItems/options 4詞段，唯一解）。
- 第 4~5 題：短文閱讀理解題（type:"reading", instruction:"文章を読んで、次の問いに最も適した答えを選びなさい。", 每題 context 須各有一篇獨立不同生活/職場主題的 80~120 字日文短文）。
${QUIZ_COMMON_RULES}
回傳剛好 5 題。`;

    const [b1, b2] = await Promise.all([
      fetchQuizBatch(batch1Prompt, "b10_1"),
      fetchQuizBatch(batch2Prompt, "b10_2"),
    ]);

    const ordered = [
      ...b1.slice(0, 2), // 漢字讀音 2
      ...b1.slice(2, 4), // 單字選填 2
      ...b1.slice(4, 5), // 文法 1
      ...b2.slice(0, 1), // 文法 1
      ...b2.slice(1, 3), // 排序 2
      ...b2.slice(3, 5), // 閱讀 2
    ];
    return ordered;
  }

  // 5 題或 3 題單批次模式
  const safeCount = questionCount <= 3 ? 3 : 5;
  const singlePrompt =
    safeCount === 3
      ? `你是 JLPT 出題專家。根據以下內容設計 3 題日文測驗：
${focusNote}
配額：
1. 漢字讀音題（type:"vocab", context:"", instruction:"下線部の漢字の読み方として最もよいものを、1・2・3・4 から一つ選びなさい。", question含【漢字】）。
2. 句子重組排序題（type:"ordering", context:"", instruction:"★ に入る最もよいものを、1・2・3・4 から一つ選びなさい。", sentence含 ①＿＿ ②＿＿ ③★＿＿ ④＿＿ 且唯一解）。
3. 短文閱讀理解題（type:"reading", instruction:"文章を読んで、次の問いに最も適した答えを選びなさい。", context須為獨立生活/職場 80~120 字短文）。
${QUIZ_COMMON_RULES}
回傳剛好 3 題。`
      : `你是 JLPT 出題專家。根據以下內容設計 5 題日文測驗（5 題型各 1 題）：
${focusNote}
配額：
1. 漢字讀音題（type:"vocab", context:"", instruction:"下線部の漢字の読み方として最もよいものを、1・2・3・4 から一つ選びなさい。", question含【漢字】）。
2. 單字選填題（type:"vocab", context:"", instruction:"（　）に入る最もよいものを、1・2・3・4 から一つ選びなさい。", question含 ___）。
3. 文法助詞與接續題（type:"grammar", context:"", instruction:"文の文法として最もよいものを、1・2・3・4 から一つ選びなさい。", question含 ___）。
4. 句子重組排序題（type:"ordering", context:"", instruction:"★ に入る最もよいものを、1・2・3・4 から一つ選びなさい。", sentence含 ①＿＿ ②＿＿ ③★＿＿ ④＿＿ 且唯一解）。
5. 短文閱讀理解題（type:"reading", instruction:"文章を読んで、次の問いに最も適した答えを選びなさい。", context須為獨立生活/職場 80~120 字短文）。
${QUIZ_COMMON_RULES}
回傳剛好 5 題。`;

  return fetchQuizBatch(singlePrompt, `single_${safeCount}`);
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
  const prompt = `生成 JLPT ${level} 日文聽力對話練習（純淨男女對話，嚴禁任何 XML/HTML/SSML 標籤，行首使用「女：」「男：」），附逐句假名、繁中翻譯與重點詞彙。`;
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
