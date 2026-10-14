import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from data_n5 import get_n5_questions
from data_n4 import get_n4_questions
from data_n3 import get_n3_questions
from data_n2 import get_n2_questions
from data_n1 import get_n1_questions

def normalize_question(q):
    sub = q.get('type')  # 'vocab', 'grammar', 'ordering', 'reading', 'listening'
    # Determine standard JLPT section category: 'VOCAB' | 'GRAMMAR_READING' | 'LISTENING'
    if sub == 'vocab':
        category = 'VOCAB'
    elif sub in ('grammar', 'ordering', 'reading'):
        category = 'GRAMMAR_READING'
    elif sub == 'listening':
        category = 'LISTENING'
    else:
        category = 'VOCAB'

    ans = q.get('answer', q.get('correctAnswerIndex', 0))

    normalized = {
        'id': q['id'],
        'level': q['level'],
        'type': category,  # 'VOCAB' | 'GRAMMAR_READING' | 'LISTENING' as strictly requested
        'subType': sub,    # 'vocab' | 'grammar' | 'ordering' | 'reading' | 'listening'
        'category': category,
        'question': q['question'],
        'options': q['options'],
        'answer': ans,
        'correctAnswerIndex': ans,
        'explanation': q['explanation'],
        'year': q.get('year', '2024年 7月')
    }

    if 'context' in q and q['context']:
        normalized['context'] = q['context']
    if 'sentence' in q and q['sentence']:
        normalized['sentence'] = q['sentence']
    if 'scrambleItems' in q and q['scrambleItems']:
        normalized['scrambleItems'] = q['scrambleItems']
    if 'instruction' in q and q['instruction']:
        normalized['instruction'] = q['instruction']
    if 'transcript' in q and q['transcript']:
        normalized['transcript'] = q['transcript']
    if 'dialogueLines' in q and q['dialogueLines']:
        normalized['dialogueLines'] = q['dialogueLines']
    if 'questionReading' in q and q['questionReading']:
        normalized['questionReading'] = q['questionReading']
    if 'questionTranslation' in q and q['questionTranslation']:
        normalized['questionTranslation'] = q['questionTranslation']

    return normalized

def build():
    all_questions = []

    n5 = [normalize_question(q) for q in get_n5_questions()]
    n4 = [normalize_question(q) for q in get_n4_questions()]
    n3 = [normalize_question(q) for q in get_n3_questions()]
    n2 = [normalize_question(q) for q in get_n2_questions()]
    n1 = [normalize_question(q) for q in get_n1_questions()]

    all_questions.extend(n5)
    all_questions.extend(n4)
    all_questions.extend(n3)
    all_questions.extend(n2)
    all_questions.extend(n1)

    print(f"Total compiled questions: {len(all_questions)}")
    for lvl, arr in [('N5', n5), ('N4', n4), ('N3', n3), ('N2', n2), ('N1', n1)]:
        types = {}
        subtypes = {}
        for q in arr:
            types[q['type']] = types.get(q['type'], 0) + 1
            subtypes[q['subType']] = subtypes.get(q['subType'], 0) + 1
        print(f"  {lvl} (Total {len(arr)}): Category={types}, SubTypes={subtypes}")

    ts_content = "import { QuizQuestion } from '../types';\n\n"
    ts_content += "export const jlptQuestionsBank: QuizQuestion[] = "
    ts_content += json.dumps(all_questions, ensure_ascii=False, indent=2)
    ts_content += ";\n"

    with open("data/jlptQuestionsBank.ts", "w", encoding="utf-8") as f:
        f.write(ts_content)

    print("Successfully written to data/jlptQuestionsBank.ts")

if __name__ == '__main__':
    build()
