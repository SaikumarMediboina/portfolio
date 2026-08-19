import re

from make_mcp_content import fundamentals_sections
from append_architecture import architecture_sections

def count_words(obj):
    if isinstance(obj, str):
        return len(re.findall(r'\b\w+\b', obj))
    elif isinstance(obj, list):
        return sum(count_words(item) for item in obj)
    elif isinstance(obj, dict):
        return sum(count_words(val) for val in obj.values())
    return 0

for i, sec in enumerate(fundamentals_sections):
    w = count_words(sec)
    print(f"Sec {i+1} ({sec['id']}): {w} words")

total_fund = sum(count_words(sec) for sec in fundamentals_sections)
print(f"Total Fundamentals sections words: {total_fund}")
