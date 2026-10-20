from pathlib import Path
from PIL import Image
import base64
import io

root = Path(__file__).resolve().parents[1]
src = Image.open(root / "public" / "Sebrae.svg.png").convert("RGBA")
bg = Image.new("RGB", src.size, (255, 255, 255))
bg.paste(src, mask=src.split()[-1])
bg.thumbnail((800, 432), Image.Resampling.LANCZOS)

assets = root / "src" / "assets"
assets.mkdir(parents=True, exist_ok=True)
bg.save(assets / "sebrae-logo.jpg", "JPEG", quality=90, optimize=True)

buf = io.BytesIO()
bg.save(buf, "JPEG", quality=90, optimize=True)
raw = buf.getvalue()
b64 = base64.b64encode(raw).decode("ascii")

out = root / "src" / "lib" / "sebraeLogoData.js"
out.write_text(
    "\n".join(
        [
            f"export const SEBRAE_LOGO_WIDTH = {bg.size[0]};",
            f"export const SEBRAE_LOGO_HEIGHT = {bg.size[1]};",
            "export const SEBRAE_LOGO_FORMAT = 'JPEG';",
            f"export const SEBRAE_LOGO_DATA_URL = 'data:image/jpeg;base64,{b64}';",
            "",
        ]
    ),
    encoding="utf-8",
)

print(f"jpg_bytes={len(raw)} size={bg.size} wrote={out}")
