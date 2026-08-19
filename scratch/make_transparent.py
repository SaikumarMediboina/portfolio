import os
from PIL import Image

# CORRECT SWAPPED MAPPING:
# media_1786418841740.png = Active vs Passive Health Check (1024x410, blue/green headers)
# media_1786418832249.png = Node Health State Machine (787x564, 4 circles)
# media_1786418836840.png = Liveness vs Readiness (715x564)

mappings = {
    "active-vs-passive-health-check.png": "media_1786418841740.png",
    "health-state-machine.png": "media_1786418832249.png",
    "liveness-readiness-slow-alive.png": "media_1786418836840.png"
}

user_uploaded_dir = r"C:\Users\Saikumar\.gemini\antigravity\brain\5e6a244e-4df5-40bf-9a02-ef32d0fa73cd\.user_uploaded"
src_dir = "src/assets"
pub_dir = "public/assets"

for asset_name, original_name in mappings.items():
    original_path = os.path.join(user_uploaded_dir, original_name)
    if not os.path.exists(original_path):
        print(f"Original file not found: {original_path}")
        continue
    
    # Open original untouched image and convert to RGBA
    img = Image.open(original_path).convert("RGBA")
    width, height = img.size
    
    # Crop 12px from each side to completely cut off the outer border line
    crop_margin = 12
    cropped = img.crop((crop_margin, crop_margin, width - crop_margin, height - crop_margin))
    
    # Process pixels for transparency
    datas = cropped.getdata()
    new_data = []
    
    for item in datas:
        r, g, b, a = item
        # If the pixel is white or near-white, make it transparent
        if r > 240 and g > 240 and b > 240:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
            
    cropped.putdata(new_data)
    
    # Save to src/assets
    src_path = os.path.join(src_dir, asset_name)
    cropped.save(src_path, "PNG")
    
    # Save to public/assets
    pub_path = os.path.join(pub_dir, asset_name)
    cropped.save(pub_path, "PNG")
    print(f"Correctly mapped, cropped 12px, and saved: {asset_name} from {original_name}")
