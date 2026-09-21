
import { GoogleGenAI, Type } from "@google/genai";
import { WordDefinition, QuizQuestion, GrammarDefinition, ReadingMaterial, ChatMessage, DiaryAnalysisResult } from "../types";

let globalAiInstance: GoogleGenAI | null = null;

// Mock Response Generator for Offline Support or Headless Environments without Keys
const mockGenerateContent = async (args: any) => {
  const contents = args?.contents || "";
  let contentStr = "";
  if (typeof contents === 'string') {
    contentStr = contents;
  } else if (contents && typeof contents === 'object') {
    contentStr = JSON.stringify(contents);
  }

  let mockData: any = {};

  if (contentStr.includes("diary entry") || contentStr.includes("student diaries") || contentStr.includes("DIARY")) {
    mockData = {
      title: "私の体験 (我的體驗)",
      correctedFullText: "今日は友達と一緒に美味しいお寿司を食べました。とても楽しかったです！",
      overallFeedback: "（離線模式）日記結構清晰，大致表達流暢。只微調了名詞美化語使得表達更為擬真。做得很好，請繼續保持寫作！",
      jlptEstimatedLevel: "N5",
      corrections: [],
      vocabGrammarList: [
        {
          expression: "お寿司",
          reading: "おすし",
          meaning: "壽司 (多用美化語お開頭)",
          type: "VOCAB"
        }
      ]
    };
  } else if (contentStr.includes("mixed Japanese quiz") || contentStr.includes("10-question") || contentStr.includes("mixed Japanese quiz")) {
    mockData = [
      {
        id: "mock_q1",
        context: "助詞練習",
        question: "私は毎日日本語___勉強します。",
        questionReading: "わたしはまいにちにほんご___べんきょうします。",
        questionTranslation: "我每天學習日文。",
        options: ["を", "が", "に", "で"],
        correctAnswerIndex: 0,
        explanation: "「勉強する」是及物動詞，目標賓語使用助詞「を」來提示。"
      },
      {
        id: "mock_q2",
        context: "形容詞變化",
        question: "昨日は天気が___かったです。",
        questionReading: "きのうはてんきが___かったです。",
        questionTranslation: "昨天天氣很好。",
        options: ["よ", "いい", "わる", "たか"],
        correctAnswerIndex: 0,
        explanation: "「いい（好）」的過去式變化是「よかった（かったです）」，去い加かった。"
      },
      {
        id: "mock_q3",
        context: "句子重組",
        question: "(A)パンを (B)私は (C)食べます (D)新幹線で。請排序：",
        questionReading: "わたしは しんかんせんで ぱんを たべます。",
        questionTranslation: "我在新幹線上吃麵包。",
        options: ["B-D-A-C", "B-A-D-C", "D-B-A-C", "A-B-D-C"],
        correctAnswerIndex: 0,
        explanation: "日語的标准句型主語在最前 (我：B)，隨後是地點副詞 (新幹線：D) 及受詞 (麵包：A)，動詞 (吃：C) 放在最後。"
      }
    ];
  } else if (contentStr.includes("Japanese tutor") || contentStr.includes("User says")) {
    mockData = {
      reply: "こんにちは！お元気ですか？日本語の勉強を一緒に頑張りましょう！何か質問があれば何でも聞いてくださいね。",
      translation: "你好！你好嗎？讓我們一起加油學習日文吧！如果有任何問題隨時都可以問我喔。",
      translationEn: "Hello! How are you? Let's work hard together to study Japanese! If you have any questions, feel free to ask.",
      correction: null
    };
  } else if (contentStr.includes("tourist helper") || contentStr.includes("MENU") || contentStr.includes("LABEL")) {
    mockData = {
      title: "美味拉麵菜單 (Delicious Ramen Menu)",
      originalLanguage: "日語 (Japanese)",
      translatedTextZh: "這是一份道地的拉麵菜單，包含豚骨拉麵與人氣配餐。",
      translatedTextEn: "This is a local Japanese ramen menu featuring flavor-packed Tonkotsu pork-bone ramen.",
      pronunciation: "Oishii Ramen Menyuu",
      detectedItems: [
        {
          original: "豚骨ラーメン",
          kana: "とんこつらーめん",
          romaji: "Tonkotsu Ramen",
          translationZh: "豚骨拉麵",
          translationEn: "Pork-bone Broth Ramen"
        }
      ],
      travelTips: "點餐時可以手指著並說『これをお願いします (Kore wo onegai shimasu)』，代表『請給我這個』。"
    };
  } else if (contentStr.includes("listening practice") || contentStr.includes("listeningSchema") || contentStr.includes("listening")) {
    mockData = {
      title: "今日の天気予報 (今日天氣預報)",
      fullContent: "皆さん、こんにちは。今日の東京は朝からとても良い天気です。",
      translation: "各位好，今天的東京從早上開始就是大晴天。",
      segments: [
        {
          text: "今日の東京は朝からとても良い天気です。",
          reading: "きょうのとうきょうはあさからとてもよいてんきです。",
          translation: "今天的東京從早上開始就是大晴天。",
          tokens: [
            {
              text: "天氣",
              dictionaryForm: "天気",
              reading: "てんき",
              meaning: "天氣",
              type: "VOCAB",
              jlpt: "N5",
              partOfSpeech: "名詞"
            }
          ]
        }
      ]
    };
  } else if (contentStr.includes("Compare Japanese texts")) {
    mockData = {
      correct: true,
      similarity: 95,
      feedback: "（離線模式）您的拼寫與發音極其精準！做得非常棒，請繼續保持！"
    };
  } else if (contentStr.includes("AI Smart Assistant") || contentStr.includes("ROUTE") || contentStr.includes("RECIPE")) {
    mockData = {
      textAnswer: "（離線模擬模式）很高興為您解答！\n\n1.  **日本電車搭乘提示**：日本搭乘地鐵時請保持安靜，避免大聲傾談。\n2.  **實用短句**：『すみません (Sumimasen)』可以用作不好意思、對不起，或者搭話。 \n\n若想要完整的聯網高階搜尋與地圖答覆，請於設定中配置您的 VITE_GEMINI_API_KEY 喔！",
      detectedType: "GENERAL_KNOWLEDGE",
      sources: [
        { "title": "日本旅遊局首頁", "url": "https://www.japan.travel/" }
      ]
    };
  } else if (contentStr.includes("extract vocabulary") || contentStr.includes("vocabulary definitions")) {
    mockData = [
      {
        word: "日本語",
        reading: "にほんご",
        meaning: "日語、日語語言",
        exampleSentence: "日本語の勉強はとても面白いです。",
        exampleReading: "にほんごのべんきょうはとてもおもしろいです。",
        exampleTranslation: "學日文非常有趣。",
        sentenceBreakdown: [
          { "word": "勉強", "reading": "べんきょう", "meaning": "學習" },
          { "word": "面白い", "reading": "おもしろい", "meaning": "有趣的" }
        ]
      }
    ];
  } else if (contentStr.includes("extract grammar")) {
    mockData = [
      {
        grammarPoint: "～てください",
        connection: "動詞 て形 + ください",
        meaning: "請做某事",
        explanation: "用於委婉或禮貌地請求、要求對方進行某項動作。",
        examples: [
          {
            sentence: "本を読んでください。",
            reading: "ほんをよんでください。",
            translation: "請讀書。"
          }
        ]
      }
    ];
  } else if (contentStr.includes("everyday beginner vocabulary") || contentStr.includes("fetchRecommendedWords") || (contentStr.includes("Recommend") && contentStr.includes("words"))) {
    if (contentStr.includes("食物") || contentStr.includes("food") || contentStr.includes("dining")) {
      mockData = [
        {
          word: "寿司",
          reading: "すし",
          meaning: "壽司",
          exampleSentence: "日本の寿司はとても有名で美味しいです。",
          exampleReading: "にほんのすしはとてもゆうめいでおいしいです。",
          exampleTranslation: "日本的壽司非常有名且美味。",
          sentenceBreakdown: [
            { "word": "有名", "reading": "ゆうめい", "meaning": "有名" },
            { "word": "美味しい", "reading": "おいしい", "meaning": "美味" }
          ]
        },
        {
          word: "ラーメン",
          reading: "らーめん",
          meaning: "拉麵",
          exampleSentence: "寒い日に熱いラーメンを食べるのが好きです。",
          exampleReading: "さむいひにあついらーめんをたべるのがすきです。",
          exampleTranslation: "我喜歡在寒冷的日子吃熱騰騰的拉麵。",
          sentenceBreakdown: [
            { "word": "寒い", "reading": "さむい", "meaning": "寒冷" },
            { "word": "熱い", "reading": "あつい", "meaning": "熱" }
          ]
        }
      ];
    } else if (contentStr.includes("交通") || contentStr.includes("transportation") || contentStr.includes("transit")) {
      mockData = [
        {
          word: "新幹線",
          reading: "しんかんせん",
          meaning: "新幹線",
          exampleSentence: "東京から大阪まで新幹線で行きました。",
          exampleReading: "とうきょうからおおさかまでしんかんせんでいきました。",
          exampleTranslation: "我搭乘新幹線從東京前往大阪。",
          sentenceBreakdown: [
            { "word": "行く", "reading": "いく", "meaning": "去" }
          ]
        },
        {
          word: "電車",
          reading: "でんしゃ",
          meaning: "電車、火車",
          exampleSentence: "毎日電車に乗って学校へ通っています。",
          exampleReading: "まいにちでんしゃにのってがっこうへかよっています。",
          exampleTranslation: "我每天搭電車去學校上學。",
          sentenceBreakdown: [
            { "word": "学校", "reading": "がっこう", "meaning": "學校" }
          ]
        }
      ];
    } else if (contentStr.includes("旅遊") || contentStr.includes("travel")) {
      mockData = [
        {
          word: "旅行",
          reading: "りょこう",
          meaning: "旅遊、旅行",
          exampleSentence: "来週、日本へ旅行に行きます。",
          exampleReading: "らいしゅう、にほんへりょこうにいきます。",
          exampleTranslation: "下週我要去日本旅行。",
          sentenceBreakdown: [
            { "word": "来週", "reading": "らいしゅう", "meaning": "下週" }
          ]
        },
        {
          word: "ホテル",
          reading: "ほてる",
          meaning: "飯店、旅館",
          exampleSentence: "駅の近くの綺麗なホテルを予約しました。",
          exampleReading: "えきのちかくのきれいなほてるをよやくしました。",
          exampleTranslation: "我預訂了車站附近乾淨漂亮的飯店。",
          sentenceBreakdown: [
            { "word": "綺麗", "reading": "きれい", "meaning": "漂亮" }
          ]
        }
      ];
    } else if (contentStr.includes("購物") || contentStr.includes("shopping")) {
      mockData = [
        {
          word: "買い物",
          reading: "かいもの",
          meaning: "購物、買東西",
          exampleSentence: "週末にデパートで買い物をします。",
          exampleReading: "しゅうまつにでぱーとでかいものをします。",
          exampleTranslation: "週末要在百貨公司買東西。",
          sentenceBreakdown: [
            { "word": "週末", "reading": "しゅうまつ", "meaning": "週末" }
          ]
        }
      ];
    } else if (contentStr.includes("動漫") || contentStr.includes("anime")) {
      mockData = [
        {
          word: "アニメ",
          reading: "あにめ",
          meaning: "動漫、卡通",
          exampleSentence: "この日本のアニメは世界中で大人気です。",
          exampleReading: "このにほんのあにめはせかいじゅうでだいにんきです。",
          exampleTranslation: "這部日本動漫在全世界非常受歡迎。",
          sentenceBreakdown: [
            { "word": "大人気", "reading": "だいにんき", "meaning": "極具人氣" }
          ]
        }
      ];
    } else {
      mockData = [
        {
          word: "友達",
          reading: "ともだち",
          meaning: "朋友",
          exampleSentence: "今日は友達と一緒にカフェへ行きました。",
          exampleReading: "きょうはともだちといっしょにかふぇへいきました。",
          exampleTranslation: "今天跟朋友一起去了咖啡廳。",
          sentenceBreakdown: [
            { "word": "今日", "reading": "きょう", "meaning": "今天" }
          ]
        },
        {
          word: "勉強",
          reading: "べんきょう",
          meaning: "學習、用功",
          exampleSentence: "日本語の勉強は少し難しいですが、面白いです。",
          exampleReading: "にほんごのべんきょうはすこしむずかしいですが、おもしろいです。",
          exampleTranslation: "學習日文雖然有點難，但很有趣。",
          sentenceBreakdown: [
            { "word": "面白い", "reading": "おもしろい", "meaning": "有趣的" }
          ]
        }
      ];
    }
  } else if (contentStr.includes("beginner grammar patterns") || contentStr.includes("fetchRecommendedGrammar") || (contentStr.includes("Recommend") && contentStr.includes("grammar"))) {
    if (contentStr.includes("N1")) {
      mockData = [
        {
          grammarPoint: "～極まりない",
          connection: "形動（去だ）／名 + 極まりない",
          meaning: "極其...、無比... (用於譴責、批判、輕視等負面事態)",
          explanation: "書面語，表示某一狀態達到了極限，語氣極為強烈。",
          examples: [
            {
              sentence: "彼の態度は不愉快極まりない。",
              reading: "かれのたいどはふゆかいきわまりない。",
              translation: "他的態度令人極其不愉快。"
            }
          ]
        }
      ];
    } else if (contentStr.includes("N2")) {
      mockData = [
        {
          grammarPoint: "～つつある",
          connection: "動詞 ます形（去ます） + つつある",
          meaning: "正在...、漸漸在... (表示事物正朝某個方向持續變化)",
          explanation: "常用於書面或比較正式的場合，表示變化正在進展中。",
          examples: [
            {
              sentence: "日本の人口は減少しつつある。",
              reading: "にほんのじんこうはげんしょうしつつある。",
              translation: "日本的人口正在逐漸減少。"
            }
          ]
        }
      ];
    } else if (contentStr.includes("N3")) {
      mockData = [
        {
          grammarPoint: "～たびに",
          connection: "動詞 普通形 / 名詞 + の + たびに",
          meaning: "每次...就...、每當...",
          explanation: "表示「每當進行某動作，後面的情況就一定隨之發生」之意。",
          examples: [
            {
              sentence: "この曲を聞くたびに、故郷を思い出します。",
              reading: "このきょくをきくたびに、こきょうをおもいだします。",
              translation: "每當聽到這首歌，我就會想起故鄉。"
            }
          ]
        }
      ];
    } else if (contentStr.includes("N4")) {
      mockData = [
        {
          grammarPoint: "～ながら",
          connection: "動詞 ます形（去ます） + ながら",
          meaning: "一邊...一邊... (同時進行兩個動作)",
          explanation: "表示同時進行兩個動作，重點通常放在後面的主要動詞上。",
          examples: [
            {
              sentence: "速度を落としながら、ゆっくり曲がってください。",
              reading: "そくどをおとしながら、ゆっくりまがってください。",
              translation: "請一邊減速，一邊緩慢轉彎。"
            }
          ]
        }
      ];
    } else {
      mockData = [
        {
          grammarPoint: "～てください",
          connection: "動詞 て形 + ください",
          meaning: "請做某事",
          explanation: "用於委婉或禮貌地請求、要求對方進行某項動作。",
          examples: [
            {
              sentence: "本を読んでください。",
              reading: "ほんをよんでください。",
              translation: "請讀書。"
            }
          ]
        },
        {
          grammarPoint: "～たいです",
          connection: "動詞 ます形（去ます） + たいです",
          meaning: "想要做某事",
          explanation: "表達說話者自己（第一人稱）想要做某動作的願望。",
          examples: [
            {
              sentence: "お茶を飲みたいです。",
              reading: "おちゃをのみたいです。",
              translation: "我想喝茶。"
            }
          ]
        }
      ];
    }
  } else if (contentStr.includes("Japanese reading text") || contentStr.includes("custom Japanese reading article") || contentStr.includes("story/article") || contentStr.includes("ReadingMaterial") || contentStr.includes("original short article") || contentStr.includes("generateRecommendedReading")) {
    if (contentStr.includes("N1")) {
      mockData = {
        title: "日本語に現れる和の美意識 (日語中的和風美學觀)",
        content: "言葉は、その言語を話す民族の精神文化を色濃く反映する鏡である。日本語の語彙における「もののあわれ」や「わびさび」は、自然のはかなさに美を見い出す独自の美意識の表象である。",
        translation: "語言是生動反映說話民族精髓與精神文化的鏡子。日語詞彙中的「物哀」與「侘寂」，是以獨特美學視角在自然虛無消逝中尋見美感的表徵。",
        tokens: [
          {
            text: "美意識",
            dictionaryForm: "美意識",
            reading: "びいしき",
            meaning: "審美觀、美學概念",
            type: "VOCAB",
            jlpt: "N1",
            exampleSentence: "日本の伝統的な美意識に触れる。",
            exampleReading: "にほんのでんとうてきなびいしきにふれる。",
            exampleTranslation: "接觸到日本傳統的審美觀與美學思維。"
          }
        ]
      };
    } else if (contentStr.includes("N2")) {
      mockData = {
        title: "新幹線の安全性と最新技術 (新幹線的安全性與全新科技)",
        content: "1964年の開業以来、新幹線は乗車中の乗客の死亡事故を一度も起こしていない。これほどの安全性を維持できている背景には、高度運行管理システムがある。",
        translation: "自1964年開業以來，新幹線從未發生過導致乘客死亡的重大事故。高水準安全性的維持背景正是源於極度精緻的高度火車運行管理系統。",
        tokens: [
          {
            text: "維持",
            dictionaryForm: "維持",
            reading: "いじ",
            meaning: "維護、維持現狀",
            type: "VOCAB",
            jlpt: "N2",
            exampleSentence: "安全性を維持するために毎日点検します。",
            exampleReading: "あんぜんせいをいじするためにまいにちてんけんします。",
            exampleTranslation: "為了維持高度安全，每天都會進行車輛檢點運營。"
          }
        ]
      };
    } else if (contentStr.includes("N3")) {
      mockData = {
        title: "日本の伝統的な祭り (日本的傳統大祭典)",
        content: "夏になると、日本のあちこちでお祭りが開かれます。人々は「浴衣」を着て、賑やかに太鼓を叩き、夏の訪れをお祝いします。",
        translation: "一到了夏天，日本各個地方就會舉辦大祭典。人們穿上休閒的夏日浴衣相聚在一起，一邊熱烈敲著太鼓，祈福並慶祝盛夏的來臨。",
        tokens: [
          {
            text: "伝統的",
            dictionaryForm: "伝統的",
            reading: "てんとうてき",
            meaning: "傳統的、具有歷史傳承的",
            type: "VOCAB",
            jlpt: "N3",
            exampleSentence: "日本の伝統的なお祭りに参加しました。",
            exampleReading: "にほんのでんとうてきなおまつりにさんかしました。",
            exampleTranslation: "我參加了日本傳統的慶典活動。"
          }
        ]
      };
    } else if (contentStr.includes("N4")) {
      mockData = {
        title: "京都の美味しい食べ物 (京都的美味佳餚)",
        content: "京都には長い歴史があって、伝統的な料理がたくさんあります。特に「抹茶」で作られたデザートや、豆腐を使ったお料理は世界中で有名です。",
        translation: "京都擁有悠久漫長的历史，有很多傳承下來的精湛料理。其中用「抹茶」熬製的精工甜點與鮮美豆腐料理在全世界都非常聞名。",
        tokens: [
          {
            text: "歴史",
            dictionaryForm: "歴史",
            reading: "れきし",
            meaning: "歷史",
            type: "VOCAB",
            jlpt: "N4",
            exampleSentence: "歴史のあるお寺へ行きました。",
            exampleReading: "れきしのあるおてらへいきました。",
            exampleTranslation: "去了有歷史感的寺廟。"
          }
        ]
      };
    } else {
      mockData = {
        title: "富士山への旅行 (富士山之旅)",
        content: "富士山は日本で一番高くて美しい山です。多くの観光客が毎年登ります。富士山の近くの湖はとても綺麗です。",
        translation: "富士山是日本最高最美的山峰。每年有很多遊客前去登山。富士山附近的湖泊非常漂亮。",
        tokens: [
          {
            text: "一番",
            dictionaryForm: "一番",
            reading: "いちばん",
            meaning: "最、第一",
            type: "VOCAB",
            jlpt: "N5",
            exampleSentence: "日本で一番高い山です。",
            exampleReading: "にほんでいちばんたかいやまです。",
            exampleTranslation: "是日本最高的山。"
          }
        ]
      };
    }
  } else {
    mockData = {
      textAnswer: "（離線模式）請先在設定中配置 VITE_GEMINI_API_KEY 金鑰來體驗真實 AI 效果喔！",
      detectedType: "DAILY_AFFAIRS",
      sources: []
    };
  }

  return {
    text: JSON.stringify(mockData)
  };
};

const ai = new Proxy({} as any, {
  get(target, prop) {
    if (
      typeof prop === 'symbol' ||
      prop === 'then' ||
      prop === 'toJSON' ||
      prop === 'constructor' ||
      prop === 'prototype'
    ) {
      return undefined;
    }

    const key = import.meta.env.VITE_GEMINI_API_KEY || "";
    if (!key) {
      if (prop === 'models') {
        return {
          generateContent: mockGenerateContent
        };
      }
      return undefined;
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
      description: "A highly comprehensive list of key vocabulary and grammar points found in the text. Make sure to extract a generous, rich selection of words, deliberately containing simple/everyday words, intermediate vocabulary, advanced/difficult terms, and proper nouns/domain-specific terms (專有名詞 / 專業術語). Do not be overly selective; provide a thorough lexical breakdown.",
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "The word/grammar as it appears in text" },
          dictionaryForm: { type: Type.STRING, description: "Dictionary form" },
          reading: { type: Type.STRING, description: "Hiragana reading of the word" },
          meaning: { type: Type.STRING, description: "Meaning in context (Traditional Chinese)" },
          type: { type: Type.STRING, enum: ["VOCAB", "GRAMMAR"] },
          jlpt: { type: Type.STRING, enum: ["N5", "N4", "N3", "N2", "N1", "Unknown"], description: "The JLPT level. Use N5 for basic/easy/everyday words, N4/N3 for intermediate, N2/N1 for advanced/hard words, and 'Unknown' specifically for proper nouns, place names, technical terminology, names, or brand terms." },
          exampleSentence: { type: Type.STRING, description: "A short, natural example sentence using this token" },
          exampleReading: { type: Type.STRING, description: "Hiragana reading of the example sentence" },
          exampleTranslation: { type: Type.STRING, description: "Traditional Chinese translation of the example sentence" }
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
      context: { type: Type.STRING, description: "Context text (e.g., short article, sentence background, or spoken script for listening)" },
      question: { type: Type.STRING, description: "Question text. For ordering, use segments like (A) (B) (C). For fill-in-blank, use ___." },
      questionReading: { type: Type.STRING, description: "Full Hiragana/Katakana reading for the question text" },
      questionTranslation: { type: Type.STRING, description: "Traditional Chinese translation for the question text" },
      options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "4 options" },
      correctAnswerIndex: { type: Type.INTEGER, description: "Index 0-3" },
      explanation: { type: Type.STRING, description: "Detailed explanation in Traditional Chinese. Must explain the grammar/vocabulary used." },
      type: { type: Type.STRING, enum: ["vocab", "grammar", "ordering", "listening", "reading"], description: "The type of question being generated" }
    },
    required: ["id", "question", "questionReading", "questionTranslation", "options", "correctAnswerIndex", "explanation", "type"],
  },
};

export const fetchWordDefinitions = async (wordsInput: string): Promise<WordDefinition[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `
      You are an expert Japanese linguist. Core task: Analyze the following Japanese content and extract vocabulary definitions:
      "${wordsInput}"

      Your goal is to perform a highly thorough lexical analysis. Extract a wide, multi-level vocabulary set under these guidelines:
      1. **High Comprehensiveness**: Do not perform simple selection. Capture a broad list of tokens from the text.
      2. **Diverse Range of Difficulty**:
         - **Advanced / Difficult Words (難詞/專有名詞)**: Extract complex compound words, advanced kanji terms, formal or literary vocabulary, and technical terms.
         - **Everyday & Intermediate Words (日常/中等詞)**: Extract everyday words, common speech, standard verbs/adjectives, and compound phrases.
         - **Easy / Standard Words (簡單詞)**: Extract basic terms to allow comprehensive beginner/intermediate reviews.
         - **Specialized Names & Proper Nouns (專有名詞 / 專業術語)**: Extract place names, company and brand names, personal names, or historical terms. Map the JLPT tier to "N1", "N2", "N3", "N4", "N5" or "Unknown" as appropriate.
      3. For each word item, provide its correct Hiragana pronunciation reading, concise contextual meaning in Traditional Chinese (Taiwan), and a high-quality example sentence in Japanese, along with its complete Furigana reading and Traditional Chinese translation.
      
      Response Language: Traditional Chinese (台灣繁體中文).
    `,
    config: { responseMimeType: "application/json", responseSchema: wordDefinitionSchema },
  });
  return JSON.parse(response.text) as WordDefinition[];
};

export const fetchGrammarDetails = async (grammarInput: string): Promise<GrammarDefinition[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `Expert Japanese grammar analysis for: "${grammarInput}". Traditional Chinese.`,
    config: { responseMimeType: "application/json", responseSchema: grammarSchema },
  });
  const data = JSON.parse(response.text);
  return data.map((d: any, i: number) => ({ ...d, id: `g-${Date.now()}-${i}` }));
};

export const fetchRecommendedWords = async (level: string, count: number, exclude: string[] = [], category?: string): Promise<WordDefinition[]> => {
  const categoryPhrase = category ? ` belonging strictly to the category "${category}" (for example: daily terms, food/dining, transportation, travel, shopping, anime/slang)` : "";
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `Recommend ${count} JLPT ${level} words${categoryPhrase}. Exclude: [${exclude.join(',')}]. Traditional Chinese (Taiwan).`,
    config: { responseMimeType: "application/json", responseSchema: wordDefinitionSchema },
  });
  return JSON.parse(response.text) as WordDefinition[];
};

export const fetchRecommendedGrammar = async (level: string, count: number, exclude: string[]): Promise<GrammarDefinition[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `Recommend ${count} JLPT ${level} grammar. Exclude: [${exclude.join(',')}]. Traditional Chinese (Taiwan).`,
    config: { responseMimeType: "application/json", responseSchema: grammarSchema },
  });
  const data = JSON.parse(response.text);
  return data.map((d: any, i: number) => ({ ...d, id: `g-rec-${Date.now()}-${i}` }));
};

export const analyzeReadingText = async (input: string): Promise<ReadingMaterial> => {
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `
      You are an expert Japanese linguist. Core task: Analyze the following Japanese text very carefully:
      "${input}"

      Your goal is to perform a highly comprehensive lexical and grammatical breakdown.
      Extract a wide and extensive range of important, everyday, intermediate, and advanced vocabulary (VOCAB), as well as key grammar patterns (GRAMMAR) from this text.

      MANDATORY extraction details:
      1. DO NOT be overly selective. Produce a thorough, extensive list of words that represents all parts of the text.
      2. Ensure a fully balanced selection that highlights the entire difficulty spectrum:
         - **Difficult/Advanced Words**: Extract complex terms, compounds, kanji with advanced readings, literary words, and sophisticated verbs (map to JLPT N1 or N2).
         - **Everyday & Intermediate Words**: Extract daily conversational words, compound particles, common nouns, verbs, adverbs, and adjectives (map to N3 or N4).
         - **Simple/Easy Words**: Extract standard, basic words that beginner learners can review (map to N5).
         - **Proper Nouns & Specialized Terminology (專有名詞 / 專業術語)**: Extract names of places, people, historical events, brand names, or field-specific terminology. Categorize these under 'Unknown'.
      3. For each vocabulary or grammar item, provide its Base Form, precise Hiragana Reading (for pronunciation), contextual meaning in Traditional Chinese (Taiwan), and a high-quality example sentence showing natural usage in context, including its furigana reading and translation.
      4. Avoid duplicate tokens.
      
      Response language: Traditional Chinese (繁體中文).
    `,
    config: { responseMimeType: "application/json", responseSchema: readingSchema },
  });
  return { ...JSON.parse(response.text), id: `r-${Date.now()}` };
};

export const generateRecommendedReading = async (level: string): Promise<ReadingMaterial> => {
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `Write an engaging, highly random, and original short article/story in Japanese suitable for JLPT ${level} learners. The topic should be completely random (for example: Japanese food culture, a seasonal festival, travel adventures, dynamic daily interactions, or a whimsical tale). Return the response strictly matching the schema with full token breakdowns and traditional Chinese (Taiwan) translations.`,
    config: { responseMimeType: "application/json", responseSchema: readingSchema },
  });
  return { ...JSON.parse(response.text), id: `r-rec-${Date.now()}` };
};

export const generateQuizFromContent = async (
  words: WordDefinition[], 
  grammar: GrammarDefinition[], 
  specificPrompt?: string, 
  questionCount: number = 10,
  jlptLevel?: string,
  sourceArticle?: string
): Promise<QuizQuestion[]> => {
  const isArticleQuiz = Boolean(sourceArticle?.trim());
  const context = JSON.stringify({ 
    words, 
    grammar, 
    rawInput: specificPrompt, 
    targetLevel: jlptLevel,
    sourceArticle: sourceArticle?.trim() || undefined,
    isArticleQuiz
  });
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `
      Based on the following content context: ${context}
      
      Your goal is to generate a highly professional, diverse, and engaging Japanese quiz containing EXACTLY ${questionCount} questions.
      
      CRITICAL FOCUS ON USER ARTICLE AND CUSTOM INPUT:
      - **ARTICLE-BASED QUIZ MODE (使用者貼出文章出題模式 - 依文章深度命題)**:
        If 'sourceArticle' is provided (or if 'rawInput' contains a user-pasted Japanese article / reading text):
        - You MUST strictly build the entire quiz directly based on the provided article!
        - Extract authentic learning points across the whole article to test comprehensive understanding:
          1. **vocab**: Extract vocabulary, kanji, and loanwords used in the article. Test kanji readings (拼音/假名標音), kanji writing from kana, loanword spelling, or target word contextual usage/fill-in-the-blank.
          2. **grammar**: Select key grammar patterns, particles (は, が, を, に, で, と, から, まで, etc.), or verb/adjective conjugations (て形, ない形, 可能形, 受身形, 使役形, etc.) that appear in the article. Test them with clear blanks "___".
          3. **ordering**: Pick an important clause or sentence structure from the article. Rearrange it into 4 segments following the strict 4-slot structure (①＿ ②＿ ③★＿ ④＿), ensuring 100% unique solution order with necessary preceding context.
          4. **listening**: Construct a vivid 2-4 line Japanese spoken dialogue between two speakers (女： / 男：) discussing, reacting to, or role-playing the topic/events described in the article.
          5. **reading**: Ask in-depth comprehension, detail, reason, or main idea questions directly based on the user's article.

      - If 'rawInput' is provided (especially when containing Japanese words, vocabularies, sentences, or specific grammar topics input by the user) OR if 'words' / 'grammar' arrays are not empty, you MUST STRICTLY use these words and topics as the core subjects of the generated questions!
      - DO NOT ignore user-entered words/topics or replace them with arbitrary, unrelated JLPT presets. Under all circumstances, the custom user input is the absolute HIGHEST priority constraint.
      - If and only if no specific words, article, or 'rawInput' are provided and 'targetLevel' is set, match the general difficulty level of JLPT ${jlptLevel}.
      - Otherwise, generate a well-balanced, general Japanese practice test matching the provided content.

      **CRITICAL ANTI-SPOILER MANDATE (題目上方絕對禁止洩漏答案 - 嚴格維護測驗公平性)**:
      - For "vocab", "grammar", and "ordering" questions:
        - The 'context' property MUST be an EMPTY STRING ("") or null!
        - NEVER output the unblanked target sentence, source paragraph, or the solution into the 'context' property!
        - Doing so causes the application to display the complete sentence in a prompt/hint box right above the question, which leaks the answer immediately (e.g., student sees the missing word or the exact order of the sentence directly in the box above the question).
        - All sentences with blanks (___) or numbered slots (①＿ ②＿ ③★＿ ④＿) MUST be placed strictly inside the 'question' property.
      - For "reading" questions:
        - The 'context' property MUST contain the article passage or relevant paragraphs for the user to read and answer the comprehension question.
      - For "listening" questions:
        - The 'context' property MUST contain the clean spoken dialogue script (without any XML/SSML tags) for the audio synthesizer to play, while remaining hidden from the user until revealed.
      
      You must distribute the requested ${questionCount} questions proportionally across the following 5 distinct types (aiming for roughly equal distribution, e.g., if count is 5, generate 1 of each; if count is 10, generate 2 of each; if count is 15, generate 3 of each; if count is 20, generate 4 of each):
      
      1. **Type: "vocab"** - VOCABULARY & KANJI & KANA JUDGMENT (單字漢字讀音與平假片假判斷題):
         - *Kanji Reading (漢字讀音)*: Provide a sentence with a target Kanji in brackets (e.g. 「昨日」) and ask for the correct hiragana reading.
         - *Kanji Writing (漢字書寫)*: Provide a sentence with a target Hiragana word in brackets (e.g. いっしょに「あそび」ましょう) and ask for the correct kanji spelling.
         - *Kana Judgment (平假片假判斷)*: Test the spelling of common loanwords (e.g., 「コーヒー」, 「デパート」) or similar kana (シ/ツ, ソ/ン) or voiced/unvoiced sounds (e.g., 「てんぷら」 vs 「でんぷら」).
         - *Word Usage (字彙用法)*: Choose the correct word (noun, verb, adjective, adverb) that fits the context semantically and grammatically.
         
      2. **Type: "grammar"** - GRAMMAR, CONJUGATION & PARTICLES (文法、接續與助詞填空題):
         - Test specific JLPT grammar points (e.g., ～ている, ～ほうがいい, ～なければならない) or particles (は, が, を, に, で, と, も, から, まで) in clear blanks "___".
         - Make sure the question prompts ask clearly for the correct particle or conjugation form that makes the sentence grammatically complete and natural.
         - All distractor options (B, C, D) must have distinct, identifiable grammatical reasons for being incorrect (e.g., mismatched particle, impossible verb inflection, unnatural collocation).
         
      3. **Type: "ordering"** - SENTENCE ORDERING & ARRANGEMENT (句子重組與星號題 - 並び替え):
         - 【JLPT 題目生成與審查規範 (最高規格絕對約束)】:
           1. **唯一解約束（絕對要求）**:
              - 重組題（星號題）所給的 4 個選項，在語意與文法組合上必須為「全宇宙唯一合法順序」！在 4! = 24 種排列中，除了正解之外，其餘 23 種組合在文法接續或語境邏輯上都必須完全無法成立。
              - **嚴禁出現對稱句型而無前文的情境**：例如「AよりB」可與「BよりA」任意互換（如題目「私は ①_ ②_ ③★_ ④_ いいです」配選項「紅茶 / コーヒー / のほうが / より」，此時「コーヒーより紅茶」與「紅茶よりコーヒー」皆完全合法，造成雙重解或答案模糊，此類題目絕對嚴格禁止！）。
              - **比較級與對立句型強制給出明確語境**：若使用比較級（如 ～より～のほうが）或對立句型，題幹開頭**必須給出明確原因、先決條件或語境**（例如：「コーヒーが苦手なので、私は ①＿ ②＿ ③★＿ ④＿ いいです。」），以語境鎖定唯一的主賓順序，徹底杜絕多解！
           2. **標點與接續嚴謹度**:
              - 選項單字（重組單字區之 4 個詞段）**絕對不得自帶結尾句號（。）**或題幹中已有的助詞或標點。
              - 句型接續（動詞連用形、て形、名詞修飾、副詞修飾、格助詞搭配）必須僅有一種在語法上成立的排列方式。
           3. **干擾項邏輯**:
              - 錯誤選項（B、C、D）必須為明顯的文法錯誤或不自然接續，不得僅依靠前後主詞或名詞對調來充當選項。
         - Follow this strict formatting structure for ordering questions:
           - The 'question' property MUST specify a template sentence with four numbered underlines like this: "（語境前文，如：コーヒーが苦手なので、）私は ①＿ ②＿ ③★＿ ④＿ いいです。" and ask the user to find the segment that goes into the star ★ (3rd space) position.
           - Below that template, list the 4 unordered word/phrase segments clearly using brackets (e.g. "【重組單字區：1. 紅茶 / 2. コーヒー / 3. のほうが / 4. より】").
           - Below that list, write the clear instruction: "請重組句子，並選出 ★ (第三個空格) 處正確的重組單字：".
           - 'options': Provide the 4 candidate words from the 【重組單字區】 without alphabetical or numerical prefixes (e.g. ["紅茶", "コーヒー", "のほうが", "より"]). 'correctAnswerIndex' must accurately point to the segment that fits into the ★ (第三個空格) position! (Alternatively, if full sequence paths are provided, they must be formatted as "2 → 4 → 1 → 3 (コーヒーより紅茶のほうが)" where incorrect paths contain obvious grammatical connection errors).
           - 'explanation': MUST provide:
             1. 完整正確句子 (e.g. 「コーヒーが苦手なので、私はコーヒーより紅茶のほうがいいです。」)
             2. 正確排列順序 (e.g. 「2 → 4 → 1 → 3」)
             3. ★ 處單字明確指認 (e.g. 「第 3 個空格（★）放入的是『1. 紅茶』」)
             4. 詳細文法剖析：解釋接續關係（「名詞＋より＋名詞＋のほうが＋形容詞」句型，因前文提到不喝咖啡，因此鎖定咖啡比紅茶），並逐一指出為何其他順序無法成立。
          
      4. **Type: "listening"** - LISTENING COMPREHENSION SIMULATION (聽力情境模擬題):
         - Since this is a visual app, you must simulate a listening question:
           - **CRITICAL DIALOGUE TRANSCRIPT CLEANLINESS (聽力原文純淨化 - 絕對禁止任何標籤)**:
             - The generated 'context' (spoken script / 對話原文) **MUST NOT contain any XML, HTML, or SSML tags** (strictly NO <prosody>, NO </prosody>, NO <voice>, NO XML tags whatsoever).
             - The transcript must contain ONLY pure, clean Japanese text with speaker markers (e.g. "女：", "男：").
             - Example format:
               "🎧 [聽力播放模擬]
女：昨日、大切な書類をなくしちゃって本当に焦ったよ。
男：えっ、本当？見つかったの？
女：うん、同僚の机の上に置き忘れていただけだったの。"
           - In the 'question' property, ask a comprehension question in Traditional Chinese about what was said (e.g. "兩個人在對話中討論了什麼？" or "女生最後在哪裡找到重要文件？").
           
      5. **Type: "reading"** - READING COMPREHENSION (閱讀理解題):
         - In the 'context' property, provide a short 2-3 sentence Japanese dialogue, diary entry, memo, email, or daily scenario paragraph.
         - In the 'question' property, ask a comprehension question in Traditional Chinese (e.g. "關於這段文章，下列敘述何者正確？", "主角今天打算要去做什麼？", or "這封電子郵件最主要的目的是什麼？").
         
      CRITICAL LANGUAGE & METADATA GUIDELINES:
      - Use ONLY Traditional Chinese (zh-TW, 台灣繁體中文) for all explanations, instructions, options, and translations.
      - **CRITICAL OPTION FORMATTING GUIDELINE**: The 4 elements inside the 'options' array **MUST NOT** contain any alphabetic or numeric prefixes (such as "A. ", "B. ", "C. ", "D. ", "A ", "B ", "C ", "D ", "A、", "B、", "C、", "D、" or "1. ", "2. ", "3. ", "4. "). Return only the **raw content/text** of the option itself. Do not add any alphabetical or numerical labels in front of options, as the client app shuffles the options and renders its own dynamic labels.
      - **NO TRAILING PERIODS IN OPTIONS**: Segments inside 'options' must not end with Japanese period "。" or English period ".".
      - 'questionReading': ALWAYS provide the full furigana/phonetic reading guide in Hiragana/Katakana for the complete 'question' text.
      - 'questionTranslation': Provide a complete, beautiful, and natural Traditional Chinese translation of the whole 'question' text.
      - 'explanation': Provide extremely detailed, step-by-step review explanations. Explicitly name the correct answer, explain the grammatical rules or lexical choices tested, and detail why other options do not fit or why they are incorrect.
      - Ensure the 'type' property is correctly set to one of "vocab", "grammar", "ordering", "listening", or "reading" for each question.
      
      Return exactly ${questionCount} questions.
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
    travelTips: { type: Type.STRING, description: "Highly comprehensive, helpful reminders, usage notices, allergen safety cautions (過敏原提示如蛋、奶、小麥、花生等), caffeine warnings, tax refund details, and preparation guidelines written in comforting Traditional Chinese, structured cleanly with bullets" }
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
    MENU: "菜單 (Menu / Food Items / Soft drinks lists)",
    LABEL: "商品標籤 / 包裝細節 / 藥妝說明 / 成分成分表與警語 (Product Package / Ingredients Sheet / Drug & Cosmetics Label)",
    SIGN: "路標 / 指路牌 / 警告告示 / 指示牌 (Signboard / Public Notice / Danger Signs)",
    GENERAL: "整合性拍照直譯 (Universal Sight Scan)"
  };

  const prompt = `You are an elite, real-time Japanese travel scanner and translator assisting tourists in Japan.
The user has uploaded a photo of a ${scanTypeLabels[scanType]} and requires an extremely comprehensive, clear, and detailed analysis.

CRITICAL DIRECTIVES:
1. DEEP & THOROUGH SCANNING: You MUST scan and extract everything visible. Do not focus only on large main headings. Carefully parse small prints, tiny background texts, ingredients lists, nutrition tables, manufacturer guidelines, additives labels, allergen warnings (such as 蛋/egg, 乳/milk, 小麥/wheat, 蕎麥/buckwheat, 花生/peanut, 蝦/shrimp, 蟹/crab, 肉類/meat etc.), spicy labels, side effects, or warning statements.
2. DETAILED ITEM BREAKDOWN: In the "detectedItems" array, list these items from largest/most prominent to the smallest prints or minor details. For each item:
   - Provide the exact Japanese text as written ("original").
   - Provide the phonetic guide ("kana" and "romaji") so a tourist can pronounce it.
   - Provide a natural and accurate Traditional Chinese translation ("translationZh").
   - Use the "description" field to fully detail what this item represents, its ingredients, allergen warnings, or volume/quantity markings, making sure to highlight any risk factors.
3. EXTRACT WARN reminder (貼心提醒):
   - Compile all dietary rules, caffeine presence, alcohol presence, pediatric warnings, critical warnings, tax-free tips, usage instructions, or spicy/allergen notations comprehensively under the "travelTips" field in Traditional Chinese.
   - Organize "travelTips" clearly with warm, empathetic markdown list bullet points so they are visually appealing and easily understandable to read.`;

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
    model: "gemini-3.5-flash",
    contents: `Generate a JLPT ${level} listening practice material. Style: JLPT conversation or short interesting article. CRITICAL DIALOGUE TRANSCRIPT CLEANLINESS: The dialogue transcript must NOT contain any XML/HTML/SSML tags (strictly NO <prosody>, NO </prosody>). Use only pure speaker lines like "女：..." and "男：...". Break it into natural sentences/segments. Traditional Chinese translation.`,
    config: { responseMimeType: "application/json", responseSchema: listeningSchema },
  });
  return { ...JSON.parse(response.text), level };
};

export const checkListeningAnswer = async (correctText: string, userInput: string): Promise<any> => {
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
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
    correctedFullText: { type: Type.STRING, description: "The fully polished and corrected Japanese diary passage. CRITICAL: You MUST strictly match and preserve the user's custom line breaks (\\n) and paragraph layout. If the user has sentences separated to different lines, make sure the corrected equivalents are placed on equivalent line breaks so both side-by-side versions match up perfectly." },
    overallFeedback: { type: Type.STRING, description: "Warm, professional feedback in Traditional Chinese on their writing style, vocabulary, and grammar" },
    jlptEstimatedLevel: { type: Type.STRING, description: "Estimated JLPT level of this text (e.g., N5, N4, N3)" },
    corrections: {
      type: Type.ARRAY,
      description: "Sentence-by-sentence analysis of corrections. CRITICAL: ONLY generate correction entries for sentences that have significant, substantive errors (e.g. wrong grammar, major particle mistakes, or word selection errors/用詞錯誤/大錯誤). If a sentence has NO actual mistakes or only has extremely minor tweaks (like changing one word just for slightly better flow, or a basic punctuation fix), do NOT include it here. It is much better to have 0 or 1 significant correction cards than to show boring minor stylistic nitpicks.",
      items: {
        type: Type.OBJECT,
        properties: {
          originalText: { type: Type.STRING, description: "The original Japanese sentence written by the user" },
          correctedText: { type: Type.STRING, description: "The corrected and polished Japanese sentence." },
          explanation: { type: Type.STRING, description: "Direct and clear explanation in Traditional Chinese of why this error is incorrect and how to fix it." },
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
      You are an expert Japanese language tutor who corrects student diaries, specializing in teaching beginners and intermediate learners (specifically JLPT N4/N5 level).
      Please analyze and correct this Japanese diary entry written by a student:
      
      "${content}"
      
      CRITICAL LEVEL RESTRICTION (N4/N5 Focus):
      The corrections, polished sentences, suggested vocabulary, and grammar points MUST be tailored for a JLPT N4/N5 level learner:
      1. Do NOT use advanced/formal/difficult vocabulary (N1/N2). At most, use common or helpful N3 level vocabulary/grammar if absolutely necessary for naturalness. Keep all words and grammar patterns friendly, simple, standard, and highly practical.
      2. Do NOT over-correct. Keep the student's original tone, context, and ideas intact. Avoid turning simple, warm daily diary thoughts into cold, overly formal, high-level academic or technical written Japanese.
      3. Polished sentences should sound natural, fluent, and idiomatic, but remain accessible and reading-friendly (mostly using N4/N5 vocabulary).
      4. The 3-5 vocabulary or grammar points extracted MUST be simple, practical everyday words or grammar patterns that are highly useful for beginners or intermediate (N4/N5) Japanese learners to learn and build dialogue with.
      
      CRITICAL CORRECTION CARD SELECTION CONSTRAINT:
      1. ONLY create items in the "corrections" list if the sentence contains an actual SIGNIFICANT spelling error, wrong particle usage, grammatically invalid structure, or severe word choice misuse (用詞錯誤、大錯誤).
      2. If a sentence is grammatically correct and has NO major mistakes, do NOT include it in the "corrections" list.
      3. Minor improvements (e.g. changing one character for a slightly "better" stylistic flow, adding minor particles that are optional, or choosing a slightly nicer synonym) SHOULD NOT be generated in the "corrections" list. Just apply these silent tweaks directly to the "correctedFullText" passage. Keep the corrections list clean so the user doesn't get overwhelmed with trivial style critiques. Always make sure the final corrected text stands out clearly so the user can easily observe the full diary context.
      
      Tasks:
      1. Correct all spelling, grammar, particles, and vocabulary errors based on the N4/N5 level.
      2. Polish the sentences to make them sound like natural, idiomatic but simple and accessible Japanese (using N4/N5 friendly, polite or casual diary style, such as using -desu/-masu consistently unless they wrote casual).
      3. CRITICAL LAYOUT MATCHING: The correctedFullText MUST preserve the exact paragraph breaks, vertical whitespace, and manual line-break structure (\n) of the original student submission. If the original text is formatted sentence-by-sentence, or has custom paragraph spacings/bullet structures, the corrected version MUST correspond line-for-line to match that layout perfectly. Avoid merging independent lines into flat block paragraphs.
      4. Provide detailed sentence-by-sentence corrections and explanations in Traditional Chinese (Taiwan) ONLY for sentences with actual major errors.
      5. Extract 3-5 suitable beginner/intermediate (N4/N5, at most N3) vocabulary words or grammar points from their diary with readings and Traditional Chinese meanings.
      6. Provide an overall encouragement score/grade/feedback in Traditional Chinese, acknowledging their current level.
     `,
    config: {
      responseMimeType: "application/json",
      responseSchema: diaryAnalysisSchema,
    },
  });
  return JSON.parse(response.text) as DiaryAnalysisResult;
};

// --- AI ASSISTANT SCHEMA ---
export interface TransitStep {
  instruction: string;
  mode: 'WALK' | 'SUBWAY' | 'BUS' | 'TRAIN' | 'DRIVE' | 'BICYCLE' | 'FLIGHT';
  duration: string;
  cost?: string;
  stops?: string[];
}

export interface RouteMapData {
  startPoint: string;
  endPoint: string;
  totalDuration: string;
  totalCost?: string;
  steps: TransitStep[];
}

export interface CurrencyData {
  fromUnit: string;
  toUnit: string;
  amount: number;
  rate: number;
  convertedAmount: number;
}

export interface RecipeData {
  dishName: string;
  prepTime: string;
  difficulty: string;
  ingredients: string[];
  instructions: string[];
}

export interface AssistantResponse {
  textAnswer: string;
  detectedType: 'ROUTE' | 'RECIPE' | 'EXCHANGE_RATE' | 'GENERAL_KNOWLEDGE' | 'DAILY_AFFAIRS';
  sources: { title: string; url: string }[];
  routeMap?: RouteMapData;
  currencyConverter?: CurrencyData;
  recipeDetail?: RecipeData;
}

const assistantSchema = {
  type: Type.OBJECT,
  properties: {
    textAnswer: { type: Type.STRING, description: "The thorough main answer to the query in Traditional Chinese (Taiwan), supporting proper markdown headings, bullet points, and paragraphs." },
    detectedType: { type: Type.STRING, enum: ["ROUTE", "RECIPE", "EXCHANGE_RATE", "GENERAL_KNOWLEDGE", "DAILY_AFFAIRS"], description: "The category that best fits the query." },
    sources: {
      type: Type.ARRAY,
      description: "2-4 authoritative web search sources, wiki links, official portals, news sources, or reference sites related to the answer.",
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Name of the source or article" },
          url: { type: Type.STRING, description: "Helpful reference URL (e.g., wiki, google maps, or general informative site)" }
        },
        required: ["title", "url"]
      }
    },
    routeMap: {
      type: Type.OBJECT,
      description: "Detailed transit route/directions schematic (ONLY populate if relevant to directions, transit lines, voyages, or travel routes)",
      properties: {
        startPoint: { type: Type.STRING, description: "Starting point" },
        endPoint: { type: Type.STRING, description: "Destination point" },
        totalDuration: { type: Type.STRING, description: "e.g., '1小時15分鐘' or '25分鐘'" },
        totalCost: { type: Type.STRING, description: "e.g., '140 TWD', '650日圓', or '免費'" },
        steps: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              instruction: { type: Type.STRING, description: "Step-by-step instruction, e.g. '搭捷運板南線往南港方向'" },
              mode: { type: Type.STRING, enum: ["WALK", "SUBWAY", "BUS", "TRAIN", "DRIVE", "BICYCLE", "FLIGHT"] },
              duration: { type: Type.STRING, description: "Duration of this step, e.g., '12分鐘'" },
              cost: { type: Type.STRING, description: "Cost of this step if any" },
              stops: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Intermediate stops, station names or landmarks passed along this step (optional)"
              }
            },
            required: ["instruction", "mode", "duration"]
          }
        }
      },
      required: ["startPoint", "endPoint", "totalDuration", "steps"]
    },
    currencyConverter: {
      type: Type.OBJECT,
      description: "Currency converter metadata (ONLY populate if relevant to currency exchange rates or money/price conversion query)",
      properties: {
        fromUnit: { type: Type.STRING, description: "Source currency code" },
        toUnit: { type: Type.STRING, description: "Target currency code" },
        amount: { type: Type.NUMBER, description: "Source amount" },
        rate: { type: Type.NUMBER, description: "Conversion rate" },
        convertedAmount: { type: Type.NUMBER, description: "Resulting converted amount" }
      },
      required: ["fromUnit", "toUnit", "amount", "convertedAmount", "rate"]
    },
    recipeDetail: {
      type: Type.OBJECT,
      description: "Interactive recipe information (ONLY populate if relevant to dishes, cooking, ingredients, bakes, or beverage mixes)",
      properties: {
        dishName: { type: Type.STRING },
        prepTime: { type: Type.STRING, description: "Preparation & cook time" },
        difficulty: { type: Type.STRING, description: "e.g., '簡單', '中等', '挑戰'" },
        ingredients: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Ingredients list with amount, e.g. ['低筋麵粉 120克', '砂糖 50克']"
        },
        instructions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Complete list of step instructions"
        }
      },
      required: ["dishName", "prepTime", "difficulty", "ingredients", "instructions"]
    }
  },
  required: ["textAnswer", "detectedType", "sources"]
};

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export const analyzeAssistantQuery = async (
  query: string,
  history?: ChatMessage[]
): Promise<AssistantResponse> => {
  let conversationContext = "";
  if (history && history.length > 0) {
    conversationContext = "Here is the conversation history so far for context, leading up to this follow-up query:\n" +
      history.map(msg => `- ${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}`).join('\n') +
      "\n\nNow, please answer the user's latest follow-up question below while preserving this context.\n";
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `
      You are highly styled AI Smart Assistant with the knowledge capabilities of Gemini and Google Search.
      
      ${conversationContext}
      
      Core task: Respond thoroughly to the following user query:
      "${query}"

      Depending on the query type (direction route, recipe cooking, currency conversion, general knowledge, or daily affairs), analyze it completely.
      1. Provide a comprehensive, clear, polite and format-rich answer in Traditional Chinese (Taiwan, 繁體中文).
      2. Set 'detectedType' to 'ROUTE' if they query about directions, how to get from point A to B, transit lines, driving, walking, or geographic pathways.
      3. Set 'detectedType' to 'RECIPE' if they ask how to cook something, recipes, baked goods, or drink instructions.
      4. Set 'detectedType' to 'EXCHANGE_RATE' if they ask about currency conversion, exchange rates, prices in different currencies, etc.
      5. Set 'detectedType' to 'GENERAL_KNOWLEDGE' or 'DAILY_AFFAIRS' for general topics.
      6. Return 2-4 appropriate search citations/references under 'sources' showing where information came from (real-world web domains or helpful URL bookmarks related to the topic).
      7. Format the textAnswer beautifully and compactly. Ensure paragraphs have clean formatting, and **strictly avoid excessive empty lines, redundant consecutive double-nl \\n\\n, or empty spacing tokens like '\\n2. \\n\\n*'**. Keep list numbering tight without empty lines inside lists. Write naturally as a professional narrator in beautiful, pure Traditional Chinese (Taiwan).
      8. CRITICAL: Avoid any corrupt or garbled characters, unescaped quotes inside JSON strings, or raw backslash escape strings. The response must be perfectly readable Traditional Chinese. Do not mix irrelevant language/characters.

      If 'detectedType' as 'ROUTE', you MUST populate 'routeMap' with an extremely detailed transit schedule including realistic intermediary stations, methods of transit, walking durations, total costs, etc.
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: assistantSchema,
      tools: [{ googleSearch: {} }]
    }
  });

  return JSON.parse(response.text) as AssistantResponse;
};


