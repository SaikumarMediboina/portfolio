import re
import os

with open("scratch/make_mcp_content.py", "r", encoding="utf-8") as f:
    content = f.read()

from generate_mcp_content_final import fundamentals_article, architecture_article
from precise_word_counter import calculate_word_count

current_words = calculate_word_count(fundamentals_article)
print("Current Fundamentals Word Count:", current_words)

# Target is ~2750 words. Ratio needed = 2750 / current_words
ratio = 2750.0 / current_words

# Scale down paragraph lengths proportionately
for sec in fundamentals_article["sections"]:
    new_ps = []
    for p in sec["paragraphs"]:
        words = p.split()
        target_len = max(15, int(len(words) * ratio))
        new_ps.append(" ".join(words[:target_len]))
    sec["paragraphs"] = new_ps

final_count = calculate_word_count(fundamentals_article)
print("Adjusted Fundamentals Word Count:", final_count)
print("Calculated Reading Time:", round(final_count / 220), "min read")
