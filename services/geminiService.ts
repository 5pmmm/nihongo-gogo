import { GoogleGenAI, Type } from "@google/genai";
import { WordDefinition, QuizQuestion, GrammarDefinition, ReadingMaterial, ChatMessage, DiaryAnalysisResult } from "../types";

let globalAiInstance: GoogleGenAI | null = null;

// 1. 環境變數保險箱通道
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


// 2. 補齊所有核心 AI 功能（聊天、日記、拍照翻譯、測驗）

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
 * 旅遊照片翻譯功能（Vercel 剛才卡住的就是這一招！）
 */
export const translateTravelPhoto = async (base64Image: string): Promise<string> => {
  try {
    // 移除 base64 的開頭標籤 (例如 data:image/jpeg;base64,)
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: cleanBase64
          }
        },
        { text: "請翻譯這張旅遊照片中的所有日文字，並給出詳細的中文對照說明與單字解析。" }
      ]
    });
    return response.text || "未能辨識圖片中的文字";
  } catch (error) {
    console.error("Translate Travel Photo Error:", error);
    throw error;
  }
};

/**
 * 日記分析功能
 */
export const generateDiaryAnalysis = async (diaryText: string): Promise<DiaryAnalysisResult> => {
  try {
    const prompt = `你是一位專業的日文老師。請分析以下學生的日文日記，並以 JSON 格式回傳修正與建議。 日記內容：${diaryText}`;
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

/**
 * 測驗生成功能（預防萬一，順便幫你補好！）
 */
export const generateQuiz = async (level: string, type: string): Promise<QuizQuestion[]> => {
  try {
    const prompt = `請生成 5 題日文 ${level} 程度的 ${type} 選擇題，並以 JSON 陣列格式回傳。`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              context: { type: Type.STRING },
              question: { type: Type.STRING },
              questionReading: { type: Type.STRING },
              questionTranslation: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswerIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Generate Quiz Error:", error);
    throw error;
  }
};