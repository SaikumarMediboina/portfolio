import os
import json
import re

with open("scratch/make_mcp_content.py", "r", encoding="utf-8") as f:
    code = f.read()

# Scale paragraphs so total count drops from ~3800 to ~2700
# Let's shorten long paragraphs in make_mcp_content.py

from make_mcp_content import fundamentals_sections

print("Current sections:", len(fundamentals_sections))
