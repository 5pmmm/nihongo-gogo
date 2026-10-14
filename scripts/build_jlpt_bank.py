import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from data_n5 import get_n5_questions
from data_n4 import get_n4_questions
from data_n3 import get_n3_questions
from data_n2 import get_n2_questions
from data_n1 import get_n1_questions

def build():
    all_questions = []
    
    n5 = get_n5_questions()
    n4 = get_n4_questions()
    n3 = get_n3_questions()
    n2 = get_n2_questions()
    n1 = get_n1_questions()
    
    all_questions.extend(n5)
    all_questions.extend(n4)
    all_questions.extend(n3)
    all_questions.extend(n2)
    all_questions.extend(n1)
    
    print(f"Total compiled questions: {len(all_questions)}")
    for lvl, arr in [('N5', n5), ('N4', n4), ('N3', n3), ('N2', n2), ('N1', n1)]:
        types = {}
        for q in arr:
            types[q['type']] = types.get(q['type'], 0) + 1
        print(f"  {lvl} (Total {len(arr)}): {types}")
        
    ts_content = "import { QuizQuestion } from '../types';\n\n"
    ts_content += "export const jlptQuestionsBank: QuizQuestion[] = "
    ts_content += json.dumps(all_questions, ensure_ascii=False, indent=2)
    ts_content += ";\n"
    
    with open("data/jlptQuestionsBank.ts", "w", encoding="utf-8") as f:
        f.write(ts_content)
        
    print("Successfully written to data/jlptQuestionsBank.ts")

if __name__ == '__main__':
    build()
