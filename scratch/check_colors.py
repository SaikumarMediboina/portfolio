import os
from PIL import Image

uploaded_dir = r"C:\Users\Saikumar\.gemini\antigravity\brain\5e6a244e-4df5-40bf-9a02-ef32d0fa73cd\.user_uploaded"

f1 = os.path.join(uploaded_dir, "media_1786418832249.png")
f2 = os.path.join(uploaded_dir, "media_1786418841740.png")

img1 = Image.open(f1).convert("RGB")
img2 = Image.open(f2).convert("RGB")

print("img1 size:", img1.size)
print("img2 size:", img2.size)

# In img1 (787x564): check the top area for "Active Health Check" vs "Node Health State Machine"
# Let's crop top 100px of both and check where green/red/purple colors are!
# In "Active vs Passive", Active is Blue/Purple title on left, Passive is Green title on right.
# In "Node Health State Machine", the title "Node Health State Machine" is at top middle in Black/Blue with blue line under it!

def check_title_colors(img, name):
    w, h = img.size
    print(f"\nColor analysis for {name}:")
    for y in range(20, 80, 5):
        for x in range(50, w - 50, 20):
            r, g, b = img.getpixel((x, y))
            # Check for non-white
            if r < 230 or g < 230 or b < 230:
                if b > r + 30 and b > g + 30:
                    print(f"Blue pixel at ({x},{y}): ({r},{g},{b})")
                elif g > r + 30 and g > b + 30:
                    print(f"Green pixel at ({x},{y}): ({r},{g},{b})")

check_title_colors(img1, "media_1786418832249.png")
check_title_colors(img2, "media_1786418841740.png")
