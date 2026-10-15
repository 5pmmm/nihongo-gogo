/**
 * 題庫與測驗題目淨化與題意分離工具 (Quiz Formatter & Sanitizer)
 * 1. 嚴禁出現程式碼文字（消除 \n 字面值、反引號、標籤、JSON 符號、程式關鍵字）。
 * 2. 題目與提示字詞徹底分離，提示字樣依層級下修並分開斷行。
 * 3. 聽力音訊語音淨化：剔除「男：」「女：」發音，改由純男女聲音質表達。
 * 4. 文字拼音題與重組題結構化分離主體與指示字。
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
}

/**
 * 智能分離題目本體與作答提示字樣，並徹底淨化程式碼字串
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
}): FormattedQuestionDisplay => {
  const isOrdering =
    rawQ?.type === 'ordering' ||
    rawQ?.subType === 'ordering' ||
    Boolean(rawQ?.scrambleItems && rawQ.scrambleItems.length > 0);

  // 基礎字串淨化
  let rawInstruction = stripCodeArtifacts(rawQ.instruction || '');
  let rawQuestion = stripCodeArtifacts(rawQ.question || '');
  let rawSentence = stripCodeArtifacts(rawQ.sentence || '');
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
  } else if (rawInstruction.includes('拼音') || rawInstruction.includes('読み方')) {
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
    };
  }

  // ----------------------------------------------------
  // 情況 B：標準題目（單字、文字拼音、文法、讀解、聽力）
  // ----------------------------------------------------
  // 先自 rawQuestion 檢查是否混雜了提示詞與題目本體
  let candidateQuestion = rawQuestion;

  // 1. 拆分「下線の言葉の読み方として最もよいものを...」開頭的字串
  const phoneticPrefixMatch = candidateQuestion.match(
    /^((?:次の)?(?:下線の言葉|下線部|漢字|言葉)の読み方[^\n。]*?(?:選びなさい|選んでください)[。]?)\s*([\s\S]+)$/
  );
  if (phoneticPrefixMatch) {
    if (!extractedInstruction) extractedInstruction = phoneticPrefixMatch[1].trim();
    candidateQuestion = phoneticPrefixMatch[2].trim();
  }

  // 2. 拆分單字拼音如「「才能」の読み方として最もよいものを一つ選びなさい。」
  const singleTargetWordMatch = candidateQuestion.match(
    /^[「『]([^」』]+)[」』]の読み方[^\n。]*?(?:選びなさい|答えなさい|どれですか|何ですか)[。]?$/
  );
  if (singleTargetWordMatch) {
    if (!extractedInstruction) {
      extractedInstruction = '下線の言葉の読み方として最もよいものを、1・2・3・4 から一つ選びなさい。';
    }
    candidateQuestion = `「${singleTargetWordMatch[1]}」`;
  }

  // 3. 多行字串檢查（首行若為指示句，則分離）
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

  // 4. 若已有 rawInstruction 則以 rawInstruction 為主
  if (rawInstruction) {
    extractedInstruction = rawInstruction;
  }

  // 5. 若無提取出指示，則依子題型給予適切的層級下修提示語
  if (!extractedInstruction) {
    if (subTypeLabel === '文字拼音題') {
      extractedInstruction = '下線の言葉の読み方として最も適当なものを選びなさい。';
    } else if (sub === 'vocab') {
      extractedInstruction = '下線の言葉の用法や意味として最も適当なものを選びなさい。';
    } else if (sub === 'grammar') {
      extractedInstruction = '（　）に入れるのに最もよいものを、1・2・3・4から一つ選びなさい。';
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

  return {
    instruction: extractedInstruction,
    subTypeLabel,
    precedingContext,
    mainQuestion: mainQuestion || rawQuestion,
    isOrdering: false,
    readingGuide,
    translation,
  };
};

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
