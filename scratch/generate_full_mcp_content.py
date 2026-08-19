import json
import os
import re

# Helper function to count words in text
def count_words(text):
    return len(re.findall(r'\b\w+\b', text))

print("Python word count verifier ready.")
