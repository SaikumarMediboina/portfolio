import re

from make_mcp_content import fundamentals_sections

# We trim long paragraphs in fundamentals_sections to reach ~2,750 words (target: 2,400 to 3,000)

for sec in fundamentals_sections:
    # Reduce long paragraph lists to top 2-3 dense sentences
    new_paragraphs = []
    for p in sec["paragraphs"]:
        # Keep sentences concise
        sentences = [s.strip() for s in p.split(".") if s.strip()]
        if len(sentences) > 3:
            new_paragraphs.append(". ".join(sentences[:3]) + ".")
        else:
            new_paragraphs.append(p)
    sec["paragraphs"] = new_paragraphs

def get_fund_count():
    count = 0
    for sec in fundamentals_sections:
        count += len(re.findall(r'\b\w+\b', sec["heading"]))
        for p in sec["paragraphs"]:
            count += len(re.findall(r'\b\w+\b', p))
        if "bullets" in sec and sec["bullets"]:
            for b in sec["bullets"]:
                count += len(re.findall(r'\b\w+\b', b))
        if "callout" in sec and sec["callout"]:
            count += len(re.findall(r'\b\w+\b', sec["callout"]["title"]))
            count += len(re.findall(r'\b\w+\b', sec["callout"]["content"]))
        if "quizzes" in sec and sec["quizzes"]:
            for q in sec["quizzes"]:
                count += len(re.findall(r'\b\w+\b', q["question"]))
                for o in q["options"]:
                    count += len(re.findall(r'\b\w+\b', o))
                count += len(re.findall(r'\b\w+\b', q["explanation"]))
    return count

print("Trimmed Fundamentals Section Word Count:", get_fund_count())
