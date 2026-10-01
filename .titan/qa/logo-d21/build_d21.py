"""Build LensSpace D2.1 candidate files (scratchpad only)."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).parent
OUT = ROOT / "d21"
OUT.mkdir(exist_ok=True)
FONT = Path(r"C:/Local-Disc-D/Project/enterpreneurship/lensspace/.next/dev/static/media/0c89a48fa5027cee-s.p.2cyn07wtgehh0.woff2")

TILE = "#07322F"
LIDS = ('<path d="M29 92C48 61 71 47 94 47s46 14 65 45" fill="none" stroke="{up}" stroke-width="{w}" stroke-linecap="round"/>'
        '<path d="M29 96C48 127 71 141 94 141s46-14 65-45" fill="none" stroke="{lo}" stroke-width="{w}" stroke-linecap="round"/>')


def mark_body(up="#7FD8C8", lo="#F0FBF9", ring_l="#35C2A8", ring_r="#128F84", axis="#F0FBF9", pupil="#FF6B4A"):
    # Fix 1: butt caps end both ring halves under the axis (no protruding bumps).
    # Fix 2: right half lifted from #0D7A72 (2.7:1) to palette #128F84 (~3.5:1).
    # Highlight dot removed: invisible below 48 px and a 7th colour.
    return (LIDS.format(up=up, lo=lo, w=10)
            + f'<path d="M94 64A30 30 0 0 0 94 124" fill="none" stroke="{ring_l}" stroke-width="7" stroke-linecap="butt"/>'
            + f'<path d="M94 64A30 30 0 0 1 94 124" fill="none" stroke="{ring_r}" stroke-width="7" stroke-linecap="butt"/>'
            + f'<path d="M94 59V129" stroke="{axis}" stroke-width="5" stroke-linecap="round"/>'
            + f'<circle cx="94" cy="94" r="13" fill="{pupil}"/>')


def mono_body(ink):
    return (LIDS.format(up=ink, lo=ink, w=10)
            + f'<circle cx="94" cy="94" r="30" fill="none" stroke="{ink}" stroke-width="7"/>'
            + f'<path d="M94 59V129" stroke="{ink}" stroke-width="5" stroke-linecap="round"/>'
            + f'<circle cx="94" cy="94" r="13" fill="{ink}"/>')


def small_body():
    # Fix 3: 16-32 px cut. Thicker lids, one-colour ring, no axis/highlight, content scaled up in the tile.
    return ('<g transform="translate(94 94) scale(1.12) translate(-94 -94)">'
            + LIDS.format(up="#7FD8C8", lo="#F0FBF9", w=15)
            + '<circle cx="94" cy="94" r="24" fill="none" stroke="#35C2A8" stroke-width="10"/>'
            + '<circle cx="94" cy="94" r="12" fill="#FF6B4A"/>'
            + '</g>')


def svg(w, h, body, title="LensSpace"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title">'
            f'<title id="title">{title}</title>{body}</svg>\n')


def tile(rx=44, fill=TILE, extra=""):
    return f'<rect width="188" height="188" rx="{rx}" fill="{fill}"{extra}/>'


def wordmark_path(text="LensSpace", x=224, baseline=116, size=82, tracking=-4, weight=700):
    # Fix 4: outline Space Grotesk Bold so the lockup no longer depends on installed fonts.
    font = TTFont(str(FONT))
    if "fvar" in font:
        font = instantiateVariableFont(font, {"wght": weight})
    gs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font["hmtx"]
    scale = size / font["head"].unitsPerEm
    pen = SVGPathPen(gs)
    cursor = x
    for ch in text:
        name = cmap[ord(ch)]
        gs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, cursor, baseline)))
        cursor += hmtx[name][0] * scale + tracking
    return pen.getCommands(), cursor - tracking


def main():
    files = {
        "mark.svg": svg(188, 188, tile() + mark_body()),
        "app-icon.svg": svg(188, 188, tile(rx=0) + mark_body()),
        "mark-small.svg": svg(188, 188, tile() + small_body()),
        "mark-monochrome-dark.svg": svg(188, 188, tile() + mono_body("#FFFFFF")),
        "mark-monochrome-light.svg": svg(188, 188, tile(fill="#FFFFFF") + mono_body(TILE)),
        # Fix 5: untiled single-ink symbol (stamps, receipts, embroidery, photos).
        "symbol-ink-dark.svg": svg(188, 188, mono_body(TILE)),
        "symbol-ink-white.svg": svg(188, 188, mono_body("#FFFFFF")),
    }
    d, end = wordmark_path()
    width = round(end + 8)
    for name, ink, stroke in (("horizontal.svg", TILE, ""), ("horizontal-inverse.svg", "#F2FBF9", ' stroke="#2B5E58" stroke-width="3"')):
        body = f'<g>{tile(extra=stroke)}{mark_body()}</g><path d="{d}" fill="{ink}"/>'
        files[name] = svg(width, 188, body)
    for name, content in files.items():
        (OUT / f"lensspace-{name}").write_text(content, encoding="utf-8")
    print(f"wrote {len(files)} files to {OUT} (lockup width {width})")


if __name__ == "__main__":
    main()
