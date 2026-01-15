import os
from PIL import Image, ImageDraw, ImageFilter
import random
import math

def create_icon(size=1024):
    # 1. Background: Dark Blue/Purple Gradient
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Create gradient background in a rounded rect (macOS style squircle-ish)
    # Actually, for an AppIcon, we usually provide the full square and macOS masks it.
    # But to look nice as a raw file, let's fill the square.
    
    # Gradient definition
    top_color = (15, 23, 42)    # Dark Slate
    bottom_color = (49, 46, 129) # Indigo
    
    for y in range(size):
        r = int(top_color[0] + (bottom_color[0] - top_color[0]) * y / size)
        g = int(top_color[1] + (bottom_color[1] - top_color[1]) * y / size)
        b = int(top_color[2] + (bottom_color[2] - top_color[2]) * y / size)
        draw.line([(0, y), (size, y)], fill=(r, g, b))

    # 2. Grid lines (Scientific look)
    grid_color = (99, 102, 241, 50) # Indigo-500, low alpha
    step = size // 8
    for i in range(1, 8):
        pos = i * step
        draw.line([(pos, 0), (pos, size)], fill=grid_color, width=2)
        draw.line([(0, pos), (size, pos)], fill=grid_color, width=2)

    # 3. Scatter Plot Data
    # Center 
    cx, cy = size / 2, size / 2
    
    # Cluster 1: Cyan (T-cells?)
    for _ in range(40):
        # Gaussian distribution around center
        ox = random.gauss(0, size/10)
        oy = random.gauss(0, size/10)
        
        # Color: Cyan with variation
        c_r = random.randint(30, 60)
        c_g = random.randint(200, 230)
        c_b = random.randint(230, 255)
        
        # Draw dot
        r = random.randint(size//100, size//60)
        x = cx + ox - size/6
        y = cy + oy + size/6
        
        draw.ellipse([x-r, y-r, x+r, y+r], fill=(c_r, c_g, c_b, 220))

    # Cluster 2: Magenta (Monocytes?)
    for _ in range(35):
        ox = random.gauss(0, size/12)
        oy = random.gauss(0, size/12)
        
        c_r = random.randint(200, 255)
        c_g = random.randint(50, 100)
        c_b = random.randint(200, 255)
        
        r = random.randint(size//90, size//55)
        x = cx + ox + size/5
        y = cy + oy - size/6
        
        draw.ellipse([x-r, y-r, x+r, y+r], fill=(c_r, c_g, c_b, 210))

    # Cluster 3: Orange (Granulocytes?)
    for _ in range(30):
        ox = random.gauss(0, size/9)
        oy = random.gauss(0, size/14)
        
        c_r = random.randint(240, 255)
        c_g = random.randint(140, 180)
        c_b = random.randint(50, 80)
        
        r = random.randint(size//110, size//70)
        x = cx + ox - size/5
        y = cy + oy - size/4
        
        draw.ellipse([x-r, y-r, x+r, y+r], fill=(c_r, c_g, c_b, 230))

    # 4. Subtle Glow/Overlay
    # Draw a large circle in the center to highlight
    # (Manual gradient for radial glow is hard in PIL simple mode, skipping for simplicity)
    
    # 5. Save
    img.save("app_icon.png")
    print("Icon generated: app_icon.png")

if __name__ == "__main__":
    create_icon()
