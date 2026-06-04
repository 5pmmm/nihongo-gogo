import { GoogleGenAI, Type } from "@google/genai";
import { WordDefinition, QuizQuestion, GrammarDefinition, ReadingMaterial, ChatMessage, DiaryAnalysisResult } from "../types";

let globalAiInstance: GoogleGenAI | null = null;

const ai = new Proxy({} as any, {
  get(target, prop) {
    const key = import.meta.env.VITE_GEMINI_API_KEY || "";
    if (!key) {
      throw new Error("請先在設定中配置 VITE_GEMINI_API_KEY 金鑰(Vite 環境變數) 才可以開始使用 AI 功能喔！");
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