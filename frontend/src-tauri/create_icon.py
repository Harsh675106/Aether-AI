from pathlib import Path
from PIL import Image

out = Path('icons/icon.ico')
out.parent.mkdir(exist_ok=True)
img = Image.new('RGBA', (256, 256), (20, 90, 180, 255))
for y in range(256):
    for x in range(256):
        img.putpixel((x, y), (20 + ((x + y) % 8) * 20, 90 + ((x * 3 + y * 5) % 40), 180 + ((x * 7 + y * 3) % 40), 255))
img.save(out, format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print(out, 'created', out.stat().st_size)
