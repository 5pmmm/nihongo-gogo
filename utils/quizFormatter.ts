import React from 'react';

/**
 * 題庫與測驗題目淨化與題意分離工具 (Quiz Formatter & Sanitizer)
 * 1. 嚴禁出現程式碼文字（消除 \n 字面值、反引號、標籤、JSON 符號、程式關鍵字）。
 * 2. 題目與提示字詞徹底分離，提示字樣依層級下修並分開斷行。
 * 3. 聽力音訊語音淨化：剔除「男：」「女：」發音，改由純男女聲音質表達。
 * 4. 文字拼音題、劃線題與重組題結構化分離主體與指示字，確保劃線目標句完整呈現。
 * 5. 使用 React.createElement 構造 DOM 節點，100% 相容於純 .ts 檔案環境，杜絕 TS1005 JSX 解析報錯。
 */

// 移除所有表情符號（Emoji），同時精準保留日文檢定專用符號（如 ★、☆、①、②、③、④ 等）
export const removeEmojis = (str: string): string => {
  if (!str) return '';
  return str
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2702}-\u{27B0}\u{FE0F}]/gu,
      ''
    )
    .trim();
};

// 徹底消除所有程式碼殘留、轉義字串、標籤及語法字樣
export const stripCodeArtifacts = (text: string): string => {
  if (!text) return '';
  let cleaned = text;

  // 1. 移除字面值轉義符號（如字面上的 \n, \r, \t, \\n 等）轉為自然換行或空格
  cleaned = cleaned.replace(/\\r\\n/g, '\n');
  cleaned = cleaned.replace(/\\n/g, '\n');
  cleaned = cleaned.replace(/\\t/g, ' ');
  cleaned = cleaned.replace(/\\"/g, '"');
  cleaned = cleaned.replace(/\\'/g, "'");

  // 2. 移除 markdown 程式碼區塊標記及反引號
  cleaned = cleaned.replace(/```(?:json|javascript|typescript|ts|js|html|code)?/gi, '');
  cleaned = cleaned.replace(/```/g, '');
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
  cleaned = cleaned.replace(/`/g, '');

  // 3. 移除 HTML / XML / SSML 標籤
  cleaned = cleaned.replace(/<\/?[a-zA-Z][^>]*>/g, '');

  // 4. 移除程式碼關鍵字或 JSON 欄位殘留
  cleaned = cleaned.replace(/\b(?:undefined|null|\[object\s+Object\])\b/g, '');
  cleaned = cleaned.replace(/^(?:(?:code|json|javascript|typescript|output):\s*)+/gi, '');

  // 5. 移除全庫 Emoji
  cleaned = removeEmojis(cleaned);

  return cleaned.trim();
};

export interface FormattedQuestionDisplay {
  instruction: string;
  subTypeLabel: string;
  precedingContext?: string;
  mainQuestion: string;
  isOrdering: boolean;
  scrambleItems?: string[];
  readingGuide?: string;
  translation?: string;
  hasUnderline: boolean;
}

/**
 * 判斷文字是否純為題目指引/指示語，而未包含具體目標句子
 */
const isPureInstructionPhrase = (text: string): boolean => {
  if (!text) return false;
  const trimmed = text.trim();
  const matchesInstructionPattern =
    /^(?:次の)?(?:下線の言葉|下線部|漢字|言葉)?(?:の用法や意味|の意味|の用法|の読み方|に入れるのに最もよいもの|について|を読んで)?[^。\n]*?(?:選びなさい|選んでください|答えなさい|どれですか|何ですか)[。]?$/.test(
      trimmed
    );
  return matchesInstructionPattern;
};

/**
 * 智能分離題目本體與作答提示字樣，並徹底淨化程式碼字串。
 * 針對下線題、劃線題進行嚴密檢查，若題目本體被誤填為指引，自動從上下文或解析救援完整目標句子。
 */
export const formatQuestionDisplay = (rawQ: {
  question?: string;
  sentence?: string;
  instruction?: string;
  scrambleItems?: string[];
  type?: string;
  subType?: string;
  questionReading?: string;
  questionTranslation?: string;
  context?: string;
  explanation?: string;
  options?: string[];
}): FormattedQuestionDisplay => {
  const isOrdering =
    rawQ?.type === 'ordering' ||
    rawQ?.subType === 'ordering' ||
    Boolean(rawQ?.scrambleItems && rawQ.scrambleItems.length > 0);

  // 基礎字串淨化
  let rawInstruction = stripCodeArtifacts(rawQ.instruction || '');
  let rawQuestion = stripCodeArtifacts(rawQ.question || '');
  let rawSentence = stripCodeArtifacts(rawQ.sentence || '');
  let rawContext = stripCodeArtifacts(rawQ.context || '');
  let rawExplanation = stripCodeArtifacts(rawQ.explanation || '');
  let readingGuide = stripCodeArtifacts(rawQ.questionReading || '');
  let translation = stripCodeArtifacts(rawQ.questionTranslation || '');

  let extractedInstruction = '';
  let precedingContext = '';
  let mainQuestion = '';

  // 取得子分類標籤
  const sub = (rawQ.subType || rawQ.type || 'vocab').toLowerCase();
  let subTypeLabel = '單字拆解題';
  if (isOrdering) {
    subTypeLabel = '星號排序題';
  } else if (sub === 'listening') {
    subTypeLabel = '聽力理解題';
  } else if (sub === 'reading') {
    subTypeLabel = '文章理解題';
  } else if (sub === 'grammar') {
    subTypeLabel = '文法句型題';
  } else if (
    rawInstruction.includes('拼音') ||
    rawInstruction.includes('読み方') ||
    rawQuestion.includes('読み方')
  ) {
    subTypeLabel = '文字拼音題';
  }

  // ----------------------------------------------------
  // 情況 A：星號重組題（Ordering）
  // ----------------------------------------------------
  if (isOrdering) {
    extractedInstruction =
      rawInstruction || '★ に入る最もよいものを、1・2・3・4 から一つ選びなさい。';

    // 取得句子主體（優先取 sentence，若無則取 question）
    let sentenceText = rawSentence || rawQuestion;

    // 清除句子中重複出現的提示字與候選項目（避免出現 【1. 人が 2. 少なく...】 重複文字）
    sentenceText = sentenceText.replace(/★\s*に入る最もよいものを[^\n]*選びなさい[。]?/g, '');
    sentenceText = sentenceText.replace(/【\s*[1-4A-Da-d][\.\、\s\)\:\-][^】]*】/g, '');
    sentenceText = sentenceText.replace(/\[\s*[1-4A-Da-d][\.\、\s\)\:\-][^\]]*\]/g, '');

    // 提取前置情境（例如「（駅の改札が混雑中なので、）」）
    const contextMatch = sentenceText.match(/^([（(][^）)]+[）)])\s*([\s\S]*)$/);
    if (contextMatch) {
      precedingContext = contextMatch[1].trim();
      mainQuestion = contextMatch[2].replace(/\n+/g, ' ').trim();
    } else {
      mainQuestion = sentenceText.replace(/\n+/g, ' ').trim();
    }

    // 淨化待重組詞片
    const cleanScramble = (rawQ.scrambleItems || []).map(item =>
      stripCodeArtifacts(item)
        .replace(/^[1-4A-Da-d][\.\、\s\)\:\-]\s*/, '')
        .replace(/[。\.\s]+$/, '')
        .trim()
    );

    return {
      instruction: extractedInstruction,
      subTypeLabel,
      precedingContext,
      mainQuestion: mainQuestion || sentenceText,
      isOrdering: true,
      scrambleItems: cleanScramble,
      readingGuide,
      translation,
      hasUnderline: true,
    };
  }

  // ----------------------------------------------------
  // 情況 B：標準題目（單字、文字拼音、文法、讀解、聽力）
  // ----------------------------------------------------
  let candidateQuestion = rawQuestion;

  // 1. 拆分各類常見日文指示前綴（例如：「次の文の空欄に入る最も適切な言葉を選びなさい。試験の合格ラインは...」）
  const generalPrefixMatch = candidateQuestion.match(
    /^((?:(?:次の(?:文の)?|下線部の?|下線の言葉の?|漢字の?|言葉の?|文章を読んで、?|会話を聞いて、?)?[^。\n]*?(?:選びなさい|選んでください|答えなさい|どれですか|何ですか))[。！？\s]*)([\s\S]+)$/
  );
  if (generalPrefixMatch) {
    const prefixCandidate = generalPrefixMatch[1].trim();
    const remainingStem = generalPrefixMatch[2].trim();
    if (remainingStem.length >= 2) {
      if (!extractedInstruction) extractedInstruction = prefixCandidate;
      candidateQuestion = remainingStem;
    }
  }

  // 2. 拆分「下線の言葉の読み方として最もよいものを...」開頭的字串
  const phoneticPrefixMatch = candidateQuestion.match(
    /^((?:次の)?(?:下線の言葉|下線部|漢字|言葉)の読み方[^\n。]*?(?:選びなさい|選んでください)[。]?)\s*([\s\S]+)$/
  );
  if (phoneticPrefixMatch) {
    if (!extractedInstruction) extractedInstruction = phoneticPrefixMatch[1].trim();
    candidateQuestion = phoneticPrefixMatch[2].trim();
  }

  // 3. 拆分單字拼音如「「才能」の読み方として最もよいものを一つ選びなさい。」
  const singleTargetWordMatch = candidateQuestion.match(
    /^[「『]([^」』]+)[」』]の読み方[^\n。]*?(?:選びなさい|答えなさい|どれですか|何ですか)[。]?$/
  );
  if (singleTargetWordMatch) {
    if (!extractedInstruction) {
      extractedInstruction = '下線の言葉の読み方として最も適当なものを選びなさい。';
    }
    candidateQuestion = `【${singleTargetWordMatch[1]}】`;
  }

  // 4. 多行字串檢查（首行若為指示句，則分離）
  const lines = candidateQuestion.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    const firstLine = lines[0];
    const isInstructionLike =
      /(?:選びなさい|選んでください|答えなさい|どれですか|何ですか|請選出|選出|問題|提示|ヒント)/.test(
        firstLine
      );
    if (isInstructionLike) {
      if (!extractedInstruction) extractedInstruction = firstLine;
      candidateQuestion = lines.slice(1).join(' ').trim();
    }
  }

  // 5. 移除任何殘留的重複開頭指示句（避免前綴黏在題目主體最前方）
  const secondaryPrefix = candidateQuestion.match(
    /^(?:次の文の空欄に入る最も適切な言葉を選びなさい|下線の言葉の用法や意味として最も適当なものを選びなさい|下線部の言葉の用法として最も適当なものを選びなさい|下線の言葉の読み方として最も適当なものを選びなさい|（\s*）に入る最もよいものを、1・2・3・4から一つ選びなさい|文章を読んで、次の問いに最も適した答えを選びなさい)[。！？\s]*/
  );
  if (secondaryPrefix && secondaryPrefix[0]) {
    const after = candidateQuestion.slice(secondaryPrefix[0].length).trim();
    if (after.length >= 2) {
      candidateQuestion = after;
    }
  }

  // 6. 若已有 rawInstruction 則以 rawInstruction 為主
  if (rawInstruction) {
    extractedInstruction = rawInstruction;
  }

  // 7. 核心防護：檢測 candidateQuestion 是否純粹是指令（如「下線の言葉の用法や意味として最も適当なものを選びなさい。」）
  // 若是，則表示目標句子缺失，必須執行智能救援！
  if (isPureInstructionPhrase(candidateQuestion) && sub !== 'reading' && sub !== 'listening') {
    if (!extractedInstruction) {
      extractedInstruction = candidateQuestion;
    }

    let rescuedSentence = '';

    // 救援來源 1: rawSentence (若有填寫目標句子)
    if (rawSentence && !isPureInstructionPhrase(rawSentence)) {
      rescuedSentence = rawSentence;
    }
    // 救援來源 2: rawContext (若為單句背景)
    else if (rawContext && rawContext.length < 120 && !isPureInstructionPhrase(rawContext)) {
      rescuedSentence = rawContext;
    }
    // 救援來源 3: rawExplanation 中引號內的完整日文例句
    else if (rawExplanation) {
      const quoteMatch = rawExplanation.match(/[「『]([^」』]{5,80})[」』]/);
      if (quoteMatch && quoteMatch[1]) {
        rescuedSentence = quoteMatch[1].trim();
      }
    }
    // 救援來源 4: rawExplanation 句號前或整體解說中提取日文句子
    if (!rescuedSentence && rawExplanation) {
      const jpSentenceMatch = rawExplanation.match(/([^\s\n「『]{3,40}(?:です|ます|た|だ|ない|ある|いる|した)[。])/);
      if (jpSentenceMatch) {
        rescuedSentence = jpSentenceMatch[1].trim();
      }
    }

    if (rescuedSentence) {
      candidateQuestion = rescuedSentence;
    }
  }

  // 8. 若無提取出指示，則依子題型給予適切的層級下修提示語
  if (!extractedInstruction) {
    if (subTypeLabel === '文字拼音題') {
      extractedInstruction = '下線の言葉の読み方として最も適当なものを選びなさい。';
    } else if (sub === 'vocab') {
      extractedInstruction = '下線の言葉の用法や意味として最も適当なものを選びなさい。';
    } else if (sub === 'grammar') {
      extractedInstruction = '（　）に入る最もよいものを、1・2・3・4から一つ選びなさい。';
    } else if (sub === 'listening') {
      extractedInstruction = '会話を聞いて、質問に最も適した答えを選びなさい。';
    } else if (sub === 'reading') {
      extractedInstruction = '文章を読んで、次の問いに最も適した答えを選びなさい。';
    } else {
      extractedInstruction = '最も適当なものを、1・2・3・4 から一つ選びなさい。';
    }
  }

  // 淨化提示字，移除多餘標籤
  extractedInstruction = extractedInstruction
    .replace(/^(?:問題[:：]?\s*|【問題】\s*|【提示】\s*|提示[:：]?\s*)/, '')
    .trim();

  // 提取題目中的前置括號情境（若有）
  const contextInQuestion = candidateQuestion.match(/^([（(][^）)]+[）)])\s*([\s\S]*)$/);
  if (contextInQuestion) {
    precedingContext = contextInQuestion[1].trim();
    mainQuestion = contextInQuestion[2].replace(/\n+/g, ' ').trim();
  } else {
    mainQuestion = candidateQuestion.replace(/\n+/g, ' ').trim();
  }

  const hasUnderline =
    mainQuestion.includes('【') ||
    mainQuestion.includes('___') ||
    mainQuestion.includes('＿＿') ||
    mainQuestion.includes('<u>');

  // 淨化 readingGuide，剔除開頭殘留的題意指示假名讀音（如「つぎのぶんのくうらんに...」）
  let cleanReadingGuide = readingGuide;
  if (cleanReadingGuide) {
    cleanReadingGuide = cleanReadingGuide
      .replace(/^つぎの(?:ぶんの)?くうらんに[^\s。]*?(?:えらびなさい|てきせつなことばをえらびなさい)[。]?\s*/, '')
      .replace(/^かせんの(?:ことばの)?[^\s。]*?(?:えらびなさい|もっともてきとうなものをえらびなさい)[。]?\s*/, '')
      .replace(/^ぶんしょうをよんで[^\s。]*?えらびなさい[。]?\s*/, '')
      .replace(/^かいわをきいて[^\s。]*?えらびなさい[。]?\s*/, '')
      .trim();
  }

  return {
    instruction: extractedInstruction,
    subTypeLabel,
    precedingContext,
    mainQuestion: mainQuestion || rawQuestion,
    isOrdering: false,
    readingGuide: cleanReadingGuide,
    translation,
    hasUnderline,
  };
};

/**
 * 將日文題目文字中標註的 【單字】 或底線 ___ 轉為高對比、清晰的美觀劃線標記。
 * 核心設計：使用 React.createElement 而非 JSX 標籤，保證在純 .ts 檔案環境中不觸發 TS1005: '>' expected 語法錯誤。
 */
export function renderQuestionSentence(text: string): React.ReactNode {
  if (!text) return null;

  // 拆分 【...】 或 ___ / ＿＿
  const parts = text.split(/(【[^】]+】|___+|＿＿+)/g);

  return parts.map((part, index) => {
    if (part.startsWith('【') && part.endsWith('】')) {
      const inner = part.slice(1, -1);
      return React.createElement(
        'span',
        {
          key: index,
          className:
            'border-b-2 border-[#4F6375] font-bold text-[#3D4F5F] px-1.5 py-0.5 bg-[#4F6375]/10 rounded-xs mx-0.5 inline-block',
        },
        inner
      );
    }
    if (/^(___+|＿＿+)$/.test(part)) {
      return React.createElement(
        'span',
        {
          key: index,
          className:
            'inline-block border-b-2 border-[#2B303A] min-w-[2.5rem] text-center font-bold px-1.5 mx-0.5 text-[#4F6375]',
        },
        '＿＿'
      );
    }
    return React.createElement('span', { key: index }, part);
  });
}

/**
 * 聽力音訊純化結構
 */
export interface CleanDialogueLine {
  gender: 'male' | 'female';
  text: string;
}

/**
 * 聽力語音純化工具：徹底移除「男：」「女：」「男の人：」「女の人：」等文字標籤，
 * 確保語音朗讀時不念出男女標籤，而是透過男聲/女聲音質直接呈現。
 */
export const cleanSpeakerDialogue = (text: string): string => {
  if (!text) return '';
  let cleaned = stripCodeArtifacts(text).trim();

  // 移除開頭括號情境動作（如（ため息）或（笑いながら））
  cleaned = cleaned.replace(/^[（(][^）)]*[）)]\s*/g, '');

  // 嚴密移除各種說話者標籤，包括男、女、男の人、女の人、男性、女性、A男、B女、M、F
  cleaned = cleaned.replace(
    /^(?:(?:男|女)(?:の人|性|の声)?|(?:男性|女性)|(?:[MF]|Male|Female)|[AB男女])[:：\s\.\-)]\s*/gi,
    ''
  );

  // 移除中間殘留的括號舞台動作
  cleaned = cleaned.replace(/[（(][^）)]*[）)]/g, '');

  return cleaned.trim();
};

/**
 * 將聽力對話或文字解析為標準純淨對話序列（標記男女聲部，排除口播標籤）
 */
export const parseListeningDialogue = (rawQ: {
  dialogueLines?: { speaker?: string; text: string; gender?: string }[];
  transcript?: string;
  context?: string;
  question?: string;
}): CleanDialogueLine[] => {
  const result: CleanDialogueLine[] = [];

  // 1. 若已經有 dialogueLines 陣列
  if (rawQ.dialogueLines && rawQ.dialogueLines.length > 0) {
    for (const line of rawQ.dialogueLines) {
      const originalText = line.text || '';
      let gender: 'male' | 'female' = 'female';

      if (line.gender === 'male' || line.gender === 'female') {
        gender = line.gender;
      } else if (
        /^(?:男(?:の人|性|の声)?|[AM]|Male)/i.test(line.speaker || '') ||
        /^(?:男(?:の人|性|の声)?|[AM]|Male)[:：]/i.test(originalText)
      ) {
        gender = 'male';
      } else {
        gender = 'female';
      }

      const spokenText = cleanSpeakerDialogue(originalText);
      if (spokenText) {
        result.push({ gender, text: spokenText });
      }
    }

    if (result.length > 0) return result;
  }

  // 2. 若為 transcript 字串
  const sourceText = rawQ.transcript || rawQ.context || rawQ.question || '';
  const lines = sourceText.split('\n').map(l => l.trim()).filter(Boolean);

  let currentGender: 'male' | 'female' = 'male';

  for (const line of lines) {
    let gender: 'male' | 'female' | null = null;
    if (/^(?:男(?:の人|性|の声)?|[AM]|Male)[:：]/i.test(line)) {
      gender = 'male';
    } else if (/^(?:女(?:の人|性|の声)?|[BF]|Female)[:：]/i.test(line)) {
      gender = 'female';
    } else {
      // 輪替對話
      gender = currentGender === 'male' ? 'female' : 'male';
    }
    currentGender = gender;

    const spokenText = cleanSpeakerDialogue(line);
    if (spokenText) {
      result.push({ gender, text: spokenText });
    }
  }

  // 3. 若仍為空，提供安全兜底
  if (result.length === 0 && sourceText) {
    result.push({ gender: 'female', text: cleanSpeakerDialogue(sourceText) });
  }

  return result;
};
