import os
from PIL import Image

original_path = r"C:\Users\Saikumar\.gemini\antigravity\brain\5e6a244e-4df5-40bf-9a02-ef32d0fa73cd\.user_uploaded\media_1786414984045.png"
img = Image.open(original_path).convert("RGB")
width, height = img.size

# Let's inspect the first 30 rows of pixels in the middle column
mid_x = width // 2
print("Top 30 pixels in the middle column:")
for y in range(30):
    r, g, b = img.getpixel((mid_x, y))
    # Print if it's not white
    if r < 255 or g < 255 or b < 255:
        print(f"y={y}: color=({r},{g},{b})")

# Let's inspect the first 30 columns of pixels in the middle row
mid_y = height // 2
print("\nLeft 30 pixels in the middle row:")
for x in range(30):
    r, g, b = img.getpixel((x, mid_y))
    if r < 255 or g < 255 or b < 255:
        print(f"x={x}: color=({r},{g},{b})")
