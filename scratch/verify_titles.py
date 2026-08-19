import os
from PIL import Image

uploaded_dir = r"C:\Users\Saikumar\.gemini\antigravity\brain\5e6a244e-4df5-40bf-9a02-ef32d0fa73cd\.user_uploaded"
files = {
    "media_1786418832249.png": "32249",
    "media_1786418836840.png": "36840",
    "media_1786418841740.png": "41740"
}

for fname, label in files.items():
    path = os.path.join(uploaded_dir, fname)
    img = Image.open(path).convert("RGB")
    w, h = img.size
    print(f"--- {label} ({w}x{h}) ---")
    # Scan the top 120 rows to sample colored pixels
    title_pixels = []
    for y in range(0, min(120, h), 5):
        row_str = ""
        for x in range(0, w, 20):
            r, g, b = img.getpixel((x, y))
            if r < 240 or g < 240 or b < 240:
                row_str += "#"
            else:
                row_str += " "
        if "#" in row_str:
            print(f"y={y:3d}: {row_str}")
