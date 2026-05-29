
import { GoogleGenAI, Type } from "@google/genai";
import { WordDefinition, QuizQuestion, GrammarDefinition, ReadingMaterial, ChatMessage, DiaryAnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

// --- WORD SCHEMA ---
const wordDefinitionSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      word: { type: Type.STRING, description: "The Japanese word (Kanji or Kana)" },
      reading: { type: Type.STRING, description: "The Hiragana reading of the word" },
      meaning: { type: Type.STRING, description: "Traditional Chinese meaning" },
      exampleSentence: { type: Type.STRING, description: "A Japanese example sentence using the word" },
      exampleReading: { type: Type.STRING, description: "The complete Hiragana reading of the example sentence" },
      exampleTranslation: { type: Type.STRING, description: "Traditional Chinese translation of the example sentence" },
      sentenceBreakdown: {
        type: Type.ARRAY,
        description: "A list of key vocabulary words found in the example sentence",
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING, description: "The word as it appears or dictionary form" },
            reading: { type: Type.STRING, description: "Hiragana reading" },
            meaning: { type: Type.STRING, description: "Brief Chinese meaning" }
          },
          required: ["word", "reading", "meaning"]
        }
      }
    },
    required: ["word", "reading", "meaning", "exampleSentence", "exampleReading", "exampleTranslation"],
  },
};

// --- GRAMMAR SCHEMA ---
const grammarSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      grammarPoint: { type: Type.STRING, description: "The grammar pattern (e.g., ～ことになる)" },
      connection: { type: Type.STRING, description: "Connection rule (e.g., Verb Dictionary Form + ...)" },
      meaning: { type: Type.STRING, description: "Meaning in Traditional Chinese" },
      explanation: { type: Type.STRING, description: "Detailed explanation of nuance and usage in Traditional Chinese" },
      examples: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            sentence: { type: Type.STRING, description: "Japanese example sentence" },
            reading: { type: Type.STRING, description: "Hiragana reading of the sentence" },
            translation: { type: Type.STRING, description: "Traditional Chinese translation" },
          },
          required: ["sentence", "reading", "translation"],
        },
      },
    },
    required: ["grammarPoint", "connection", "meaning", "explanation", "examples"],
  },
};

// --- READING SCHEMA ---
const readingSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "A suitable title for the text" },
    content: { type: Type.STRING, description: "The full Japanese article content" },
    translation: { type: Type.STRING, description: "Traditional Chinese translation of the article" },
    tokens: {
      type: Type.ARRAY,
      description: "List of key vocabulary and grammar points found in the text",
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "The word/grammar as it appears in text" },
          dictionaryForm: { type: Type.STRING, description: "Dictionary form" },
          reading: { type: Type.STRING, description: "Hiragana reading" },
          meaning: { type: Type.STRING, description: "Meaning in context (Traditional Chinese)" },
          type: { type: Type.STRING, enum: ["VOCAB", "GRAMMAR"] },
          jlpt: { type: Type.STRING, enum: ["N5", "N4", "N3", "N2", "N1", "Unknown"] },
          exampleSentence: { type: Type.STRING, description: "A short example sentence using this token" },
          exampleReading: { type: Type.STRING, description: "Hiragana reading of the example" },
          exampleTranslation: { type: Type.STRING, description: "Chinese translation of the example" }
        },
        required: ["text", "dictionaryForm", "reading", "meaning", "type", "jlpt", "exampleSentence", "exampleReading", "exampleTranslation"]
      }
    }
  },
  required: ["title", "content", "translation", "tokens"]
};

// --- QUIZ SCHEMA ---
const quizSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING, description: "Unique ID" },
      context: { type: Type.STRING, description: "Context text (e.g., short article or sentence background)" },
      question: { type: Type.STRING, description: "Question text. For ordering, use segments like (A) (B) (C). For fill-in-blank, use ___." },
      questionReading: { type: Type.STRING, description: "Full Hiragana/Katakana reading for the question text" },
      questionTranslation: { type: Type.STRING, description: "Traditional Chinese translation for the question text" },
      options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "4 options" },
      correctAnswerIndex: { type: Type.INTEGER, description: "Index 0-3" },
      explanation: { type: Type.STRING, description: "Detailed explanation in Traditional Chinese. Must explain the grammar/vocabulary used." },
    },
    required: ["id", "question", "questionReading", "questionTranslation", "options", "correctAnswerIndex", "explanation"],
  },
};

export const fetchWordDefinitions = async (wordsInput: string): Promise<WordDefinition[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze these Japanese words: "${wordsInput}". Traditional Chinese.`,
    config: { responseMimeType: "application/json", responseSchema: wordDefinitionSchema },
  });
  return JSON.parse(response.text) as WordDefinition[];
};

export const fetchGrammarDetails = async (grammarInput: string): Promise<GrammarDefinition[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Expert Japanese grammar analysis for: "${grammarInput}". Traditional Chinese.`,
    config: { responseMimeType: "application/json", responseSchema: grammarSchema },
  });
  const data = JSON.parse(response.text);
  return data.map((d: any, i: number) => ({ ...d, id: `g-${Date.now()}-${i}` }));
};

export const fetchRecommendedWords = async (level: string, count: number, exclude: string[]): Promise<WordDefinition[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Recommend ${count} JLPT ${level} words. Exclude: [${exclude.join(',')}]. Traditional Chinese.`,
    config: { responseMimeType: "application/json", responseSchema: wordDefinitionSchema },
  });
  return JSON.parse(response.text) as WordDefinition[];
};

export const fetchRecommendedGrammar = async (level: string, count: number, exclude: string[]): Promise<GrammarDefinition[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Recommend ${count} JLPT ${level} grammar. Exclude: [${exclude.join(',')}]. Traditional Chinese.`,
    config: { responseMimeType: "application/json", responseSchema: grammarSchema },
  });
  const data = JSON.parse(response.text);
  return data.map((d: any, i: number) => ({ ...d, id: `g-rec-${Date.now()}-${i}` }));
};

export const analyzeReadingText = async (input: string): Promise<ReadingMaterial> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze this text: "${input}". Extract vocab and grammar. Traditional Chinese.`,
    config: { responseMimeType: "application/json", responseSchema: readingSchema },
  });
  return { ...JSON.parse(response.text), id: `r-${Date.now()}` };
};

export const generateRecommendedReading = async (level: string): Promise<ReadingMaterial> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a short JLPT ${level} story/article. Traditional Chinese.`,
    config: { responseMimeType: "application/json", responseSchema: readingSchema },
  });
  return { ...JSON.parse(response.text), id: `r-rec-${Date.now()}` };
};

export const generateQuizFromContent = async (words: WordDefinition[], grammar: GrammarDefinition[], specificPrompt?: string): Promise<QuizQuestion[]> => {
  const context = JSON.stringify({ words, grammar, rawInput: specificPrompt });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      Based on this content: ${context}
      
      Generate a 10-question mixed Japanese quiz.
      
      MANDATORY MIX:
      1. 3 Fill-in-the-blank questions (___) about particles or conjugation.
      2. 2 Sentence ordering questions (e.g. Arrange A, B, C, D to form a sentence).
      3. 2 Reading comprehension questions based on a context snippet.
      4. 3 Vocabulary/Kanji usage questions.
      
      CRITICAL: For EVERY question, provide:
      - 'questionReading': The full phonetic reading (Hiragana/Katakana) for the question text.
      - 'questionTranslation': A natural Traditional Chinese translation for the question text.
      
      Difficulty: Match the input content.
      Language: Traditional Chinese (Taiwan).
      Target: 10 total questions.
    `,
    config: { responseMimeType: "application/json", responseSchema: quizSchema },
  });
  return JSON.parse(response.text) as QuizQuestion[];
};

export const getChatResponse = async (
  history: ChatMessage[],
  newMessage: string,
  context?: string,
  image?: string
): Promise<any> => {
  const historyWithoutImages = history.map(h => ({
    role: h.role,
    text: h.text,
    translation: h.translation,
    translationEn: h.translationEn,
    correction: h.correction,
    timestamp: h.timestamp,
    hasImage: !!h.image
  }));

  const chatPrompt = `You are a professional Japanese tutor. 
User says: "${newMessage}". (Note: User may input in Traditional Chinese, English, or Japanese, or a mix of them).
History of past chat: ${JSON.stringify(historyWithoutImages)}.
Context: ${context || 'None'}.

Task:
1. Always reply primarily in friendly, polite Japanese (以日文對答為主).
2. Fully support and acknowledge inputs in Traditional Chinese, English, or Japanese.
3. If an image is provided, examine it, teach the user relevant Japanese terms or describe what's in the image.
4. Correct any grammar, spelling, or particle errors in the user's input politely.
5. Provide both polished Traditional Chinese (zh-TW) and English translations of your Japanese reply.`;

  let requestContents: any = chatPrompt;

  if (image) {
    const match = image.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,(.+)$/);
    if (match) {
      const mimeType = match[1];
      const base64Data = match[2];
      
      const imagePart = {
        inlineData: {
          mimeType,
          data: base64Data
        }
      };
      
      const textPart = {
        text: chatPrompt
      };
      
      requestContents = { parts: [imagePart, textPart] };
    }
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: requestContents,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reply: { type: Type.STRING, description: "Your Japanese reply as a friendly tutor. Talk about the image in Japanese if uploaded!" },
          translation: { type: Type.STRING, description: "Traditional Chinese translation of your reply." },
          translationEn: { type: Type.STRING, description: "English translation of your reply." },
          correction: { 
            type: Type.OBJECT, 
            description: "Optional grammar or spelling correction if the user made any mistake in their last message. Return null or do NOT include this object if no correction is needed.",
            properties: {
              correctedJapanese: { type: Type.STRING, description: "The corrected and polished Japanese sentence." },
              explanationChinese: { type: Type.STRING, description: "Clear and helpful explanation of the error or suggestions in Traditional Chinese (Taiwan)." },
              explanationEnglish: { type: Type.STRING, description: "Clear and helpful explanation in English." }
            },
            required: ["correctedJapanese", "explanationChinese", "explanationEnglish"]
          }
        },
        required: ["reply", "translation", "translationEn"]
      }
    }
  });
  return JSON.parse(response.text);
};

// Travel Photo Scanner/Translator Schema
const travelTranslationSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Identify what this is (e.g. 'Ramen Shop Menu' or 'Skin hydration cream label')" },
    originalLanguage: { type: Type.STRING, description: "The original detected language" },
    translatedTextZh: { type: Type.STRING, description: "Polished overall Traditional Chinese translation / Summary" },
    translatedTextEn: { type: Type.STRING, description: "Polished overall English translation / Summary" },
    pronunciation: { type: Type.STRING, description: "Romaji or Hiragana pronunciation helper for the main title/text" },
    detectedItems: {
      type: Type.ARRAY,
      description: "List of items, words, prices, or ingredients detected in the image",
      items: {
        type: Type.OBJECT,
        properties: {
          original: { type: Type.STRING, description: "Japanese text from the item" },
          kana: { type: Type.STRING, description: "Hiragana/Katakana pronunciation guide" },
          romaji: { type: Type.STRING, description: "Romaji guide (very helpful for ordering out loud)" },
          translationZh: { type: Type.STRING, description: "Meaning in Traditional Chinese" },
          translationEn: { type: Type.STRING, description: "Meaning in English" },
          description: { type: Type.STRING, description: "Brief description, ingredients help, key options, allergies advice or warning (optional)" }
        },
        required: ["original", "kana", "romaji", "translationZh", "translationEn"]
      }
    },
    travelTips: { type: Type.STRING, description: "Useful travel tips, cultural context, allergens, dietary notes, or purchasing advice in Traditional Chinese" }
  },
  required: ["title", "translatedTextZh", "translatedTextEn", "detectedItems", "travelTips"]
};

export const translateTravelPhoto = async (
  image: string,
  scanType: 'MENU' | 'LABEL' | 'SIGN' | 'GENERAL'
): Promise<any> => {
  const match = image.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image format. Base64 expected.");
  }
  
  const mimeType = match[1];
  const base64Data = match[2];

  const scanTypeLabels = {
    MENU: "菜單 (Menu/Food Item/Price list)",
    LABEL: "商品標籤/包裝/藥妝說明書 (Product Label/Package/Instructions)",
    SIGN: "指路路標/看板文字/公告 (Signboard/Map/Bulletin Board)",
    GENERAL: "一般拍照直譯 (General Japanese Sign)"
  };

  const prompt = `You are a real-time Japanese tourist helper and translator in Japan.
The user has uploaded a photo of a ${scanTypeLabels[scanType]} and wants immediate and intuitive help.

Analyze the image or photo carefully:
1. Detect and extract all written Japanese keys, words, dish names, prices, or labels.
2. Formulate a structured, easy-to-read translation including pronunciation (kana and romaji) so the user can easily repeat/display it to Japanese servers, clerks, or locals.
3. Identify allergens (like pork, nuts, eggs, dairy), caffeine, and side instructions if applicable.
4. Give a warm, helpful summary in Traditional Chinese and English, and provide practical travel nuggets (such as: how to order this, is there a tax-free label, is it spicy).`;

  const imagePart = {
    inlineData: {
      mimeType,
      data: base64Data
    }
  };

  const textPart = {
    text: prompt
  };

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: { parts: [imagePart, textPart] },
    config: {
      responseMimeType: "application/json",
      responseSchema: travelTranslationSchema
    }
  });

  return JSON.parse(response.text);
};

// --- LISTENING SCHEMA ---
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
          text: { type: Type.STRING, description: "One sentence or short natural segment" },
          reading: { type: Type.STRING, description: "Full hiragana/katakana reading" },
          translation: { type: Type.STRING, description: "Traditional Chinese translation" },
          tokens: {
            type: Type.ARRAY,
            description: "Vocabulary and grammar analysis for this segment",
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                dictionaryForm: { type: Type.STRING },
                reading: { type: Type.STRING },
                meaning: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["VOCAB", "GRAMMAR"] },
                jlpt: { type: Type.STRING, enum: ["N5", "N4", "N3", "N2", "N1", "Unknown"] },
                partOfSpeech: { type: Type.STRING, description: "e.g. 名詞, 動詞, 形容詞" }
              },
              required: ["text", "dictionaryForm", "reading", "meaning", "type", "jlpt", "partOfSpeech"]
            }
          }
        },
        required: ["text", "reading", "translation", "tokens"],
      },
    },
  },
  required: ["title", "fullContent", "translation", "segments"],
};

export const fetchListeningMaterial = async (level: string): Promise<any> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a JLPT ${level} listening practice material. Style: NHK News or short interesting article. Break it into natural sentences/segments. Traditional Chinese translation.`,
    config: { responseMimeType: "application/json", responseSchema: listeningSchema },
  });
  return { ...JSON.parse(response.text), level };
};

export const checkListeningAnswer = async (correctText: string, userInput: string): Promise<any> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Compare Japanese texts. Correct: "${correctText}". User input: "${userInput}". Calculate similarity (0-100) and provide encouraging feedback in Traditional Chinese.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          correct: { type: Type.BOOLEAN },
          similarity: { type: Type.NUMBER },
          feedback: { type: Type.STRING },
        },
        required: ["correct", "similarity", "feedback"],
      },
    },
  });
  return JSON.parse(response.text);
};

// --- DIARY CORRECTION SCHEMA ---
const diaryAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Suggest a suitable, poetic, or descriptive title in Japanese for this diary entry. (Optional: provide Traditional Chinese translation alongside, e.g., 「雨の日（雨天）」)" },
    correctedFullText: { type: Type.STRING, description: "The fully polished and corrected Japanese diary passage" },
    overallFeedback: { type: Type.STRING, description: "Warm, professional feedback in Traditional Chinese on their writing style, vocabulary, and grammar" },
    jlptEstimatedLevel: { type: Type.STRING, description: "Estimated JLPT level of this text (e.g., N5, N4, N3, N2, N1)" },
    corrections: {
      type: Type.ARRAY,
      description: "Sentence-by-sentence analysis of corrections",
      items: {
        type: Type.OBJECT,
        properties: {
          originalText: { type: Type.STRING, description: "The original Japanese sentence as written by the user" },
          correctedText: { type: Type.STRING, description: "The corrected and polished Japanese sentence. If no correction is needed, keep it identical but explain that it is perfect!" },
          explanation: { type: Type.STRING, description: "Clear and helpful explanation of why the correction was made, or general guidance / grammar tips (in Traditional Chinese)" },
          grammarPoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Key grammar patterns or vocabulary terms introduced or corrected in this sentence"
          }
        },
        required: ["originalText", "correctedText", "explanation"]
      }
    },
    vocabGrammarList: {
      type: Type.ARRAY,
      description: "List of 3-5 critical vocabulary and grammar expressions from this diary to save/learn",
      items: {
        type: Type.OBJECT,
        properties: {
          expression: { type: Type.STRING, description: "The word or grammar pattern" },
          reading: { type: Type.STRING, description: "Hiragana/Katakana reading" },
          meaning: { type: Type.STRING, description: "Meaning in Traditional Chinese" },
          type: { type: Type.STRING, enum: ["VOCAB", "GRAMMAR"] }
        },
        required: ["expression", "reading", "meaning", "type"]
      }
    }
  },
  required: ["title", "correctedFullText", "overallFeedback", "jlptEstimatedLevel", "corrections"]
};

export const fetchDiaryCorrection = async (content: string): Promise<DiaryAnalysisResult> => {
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `
      You are an expert Japanese language tutor who corrects student diaries. 
      Please analyze and correction this Japanese diary entry written by a student:
      
      "${content}"
      
      Tasks:
      1. Correct all spelling, grammar, particles, and vocabulary errors.
      2. Polish the sentences to make them sound like natural, idiomatic Japanese (such as using natural collocations, formal vs. informal consistency, and friendly diary style).
      3. Provide detailed sentence-by-sentence corrections and explanations in Traditional Chinese (Taiwan).
      4. Extract 3-5 vocabulary or grammar points from their diary with reading and Traditional Chinese meaning so they can review and memorize them.
      5. Provide an overall encouragement score/grade/feedback in Traditional Chinese.
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: diaryAnalysisSchema,
    },
  });
  return JSON.parse(response.text) as DiaryAnalysisResult;
};

