import { GoogleGenAI, Type } from "@google/genai";
import { WordDefinition, QuizQuestion, GrammarDefinition, ReadingMaterial, ChatMessage, DiaryAnalysisResult } from "../types";

let globalAiInstance: GoogleGenAI | null = null;

// 1. 這段是完美的環境變數保險箱通道
const ai = new Proxy({} as any, {
  get(target, prop) {
    const key = import.meta.env.VITE_GEMINI_API_KEY || "";
    if (!key) {
      throw new Error("請先在設定中配置 VITE_GEMINI_API_KEY 金鑰(Vite 環境變數) 才可以開始使用 AI功能喔！");
    }
    if (!globalAiInstance) {
      globalAiInstance = new GoogleGenAI({ apiKey: key });
    }
    const val = (globalAiInstance as any)[prop];
    if (typeof val === 'function') {
      return val.bind(globalAiInstance);
    }
    return val;
  }
}) as unknown as GoogleGenAI;


// 2. 這邊要補回你原本專案的核心 AI 功能（Vercel 說找不到的就在這裡）

/**
 * 核心聊天功能
 */
export const getChatResponse = async (messages: ChatMessage[]): Promise<string> => {
  try {
    const formattedMessages = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: formattedMessages
    });

    return response.text || "AI 沒有回應";
  } catch (error) {
    console.error("Chat Error:", error);
    throw error;
  }
};

/**
 * 日記分析功能
 */
export const generateDiaryAnalysis = async (diaryText: string): Promise<DiaryAnalysisResult> => {
  try {
    const prompt = `你是一位專業的日文老師。請分析以下學生的日文日記，並以 JSON 格式回傳修正與建議。
    日記內容：${diaryText}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
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
                  original: { type: Type.STRING },
                  corrected: { type: Type.STRING },
                  explanation: { type: Type.STRING }
                }
              }
            },
            vocabGrammarList: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  expression: { type: Type.STRING },
                  reading: { type: Type.STRING },
                  meaning: { type: Type.STRING },
                  type: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Diary Analysis Error:", error);
    throw error;
  }
};

// 如果你原本還有其他的 export 功能（例如 generateQuiz 或 translateTravelPhoto），也可以依此類推留在最下方！