import json
import re
import os

from make_mcp_content import fundamentals_sections
from generate_mcp_content_final import fundamentals_article, architecture_article

def calculate_word_count(article):
    count = 0
    count += len(re.findall(r'\b\w+\b', article["title"]))
    count += len(re.findall(r'\b\w+\b', article["openingSummary"]))
    for item in article["whatYouWillLearn"]:
        count += len(re.findall(r'\b\w+\b', item))
    for sec in article["sections"]:
        count += len(re.findall(r'\b\w+\b', sec["heading"]))
        for p in sec["paragraphs"]:
            count += len(re.findall(r'\b\w+\b', p))
        if "bullets" in sec and sec["bullets"]:
            for b in sec["bullets"]:
                count += len(re.findall(r'\b\w+\b', b))
        if "callout" in sec and sec["callout"]:
            count += len(re.findall(r'\b\w+\b', sec["callout"]["title"]))
            count += len(re.findall(r'\b\w+\b', sec["callout"]["content"]))
        if "quiz" in sec and sec["quiz"]:
            count += len(re.findall(r'\b\w+\b', sec["quiz"]["question"]))
            for o in sec["quiz"]["options"]:
                count += len(re.findall(r'\b\w+\b', o))
            count += len(re.findall(r'\b\w+\b', sec["quiz"]["explanation"]))
        if "quizzes" in sec and sec["quizzes"]:
            for q in sec["quizzes"]:
                count += len(re.findall(r'\b\w+\b', q["question"]))
                for o in q["options"]:
                    count += len(re.findall(r'\b\w+\b', o))
                count += len(re.findall(r'\b\w+\b', q["explanation"]))
        if "table" in sec and sec["table"]:
            for h in sec["table"]["headers"]:
                count += len(re.findall(r'\b\w+\b', h))
            for row in sec["table"]["rows"]:
                for cell in row:
                    count += len(re.findall(r'\b\w+\b', cell))
    for kt in article["keyTakeaways"]:
        count += len(re.findall(r'\b\w+\b', kt))
    return count

fund_count = calculate_word_count(fundamentals_article)
arch_count = calculate_word_count(architecture_article)

print("--------------------------------------------------")
print(f"FUNDAMENTALS WORD COUNT:   {fund_count} words (Target: 2,400 to 3,000)")
print(f"FUNDAMENTALS READING TIME: {round(fund_count / 220)} min read")
print("--------------------------------------------------")
print(f"ARCHITECTURE WORD COUNT:   {arch_count} words (Target: 2,800 to 3,500)")
print(f"ARCHITECTURE READING TIME: {round(arch_count / 220)} min read")
print("--------------------------------------------------")
