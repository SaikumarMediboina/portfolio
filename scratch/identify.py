import os
from PIL import Image

uploaded_dir = r"C:\Users\Saikumar\.gemini\antigravity\brain\5e6a244e-4df5-40bf-9a02-ef32d0fa73cd\.user_uploaded"
files = ["media_1786418832249.png", "media_1786418836840.png", "media_1786418841740.png"]

for filename in files:
    path = os.path.join(uploaded_dir, filename)
    img = Image.open(path).convert("RGB")
    width, height = img.size
    
    # Let's count dark pixels along the vertical middle column
    mid_x = width // 2
    dark_y_count = 0
    for y in range(height):
        r, g, b = img.getpixel((mid_x, y))
        if r < 150 and g < 150 and b < 150:
            dark_y_count += 1
            
    # Let's count dark pixels along the horizontal middle row
    mid_y = height // 2
    dark_x_count = 0
    for x in range(width):
        r, g, b = img.getpixel((x, mid_y))
        if r < 150 and g < 150 and b < 150:
            dark_x_count += 1
            
    print(f"File {filename} ({width}x{height}): dark vertical pixels = {dark_y_count}, dark horizontal pixels = {dark_x_count}")
