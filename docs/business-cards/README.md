# SecondLook business cards

Two personal fronts and one shared back, using the original vector logo from `docs/videos/assets/mark.svg`. Names are typeset as Quinntyne Brown and Rodney Brown; both carry the title Co-founder.

## VistaPrint upload

Choose **standard 3.5 x 2 inch, horizontal, two-sided business cards**. Create a separate version/order for each founder:

| Founder | Front | Back |
| --- | --- | --- |
| Quinntyne Brown | `quinntyne-front.pdf` | `shared-back.pdf` |
| Rodney Brown | `rodney-front.pdf` | `shared-back.pdf` |

The individual PDFs are vector artwork with embedded fonts, without visible guides or crop marks. Matching 300 dpi PNGs are also supplied. Upload the PDFs first. Confirm the full background reaches the outer bleed edge in the VistaPrint preview and all text stays inside its safe zone. Both faces are landscape and upright.

## Bleed / gutters / safe margins

- Finished card: **3.5 x 2 inches**.
- Full artwork: **3.61 x 2.11 inches**.
- Bleed: **0.055 inches on every side**, extending the background beyond the cut.
- Minimum safe area: **3.36 x 1.86 inches**, inset 0.125 inches from the artwork edge. Essential text and logo remain inside it.
- These are individual card faces, not a sheet imposed with multiple cards; VistaPrint handles sheet gutters and cutting.

Dimensions follow [VistaPrint Canada's business-card guide](https://www.vistaprint.ca/hub/business-card-dimensions), checked October 28, 2026. These files target its standard rectangular cards; other products may use different templates.

`preview.png` shows the trimmed appearance. `proof-with-guides.pdf` shows trim (pink) and safe area (blue), with generous review gutters. **Do not upload the proof or preview as print artwork.**

## Regeneration

Run `python docs/business-cards/generate.py` from the repository root. Requires Python with reportlab, svglib, pypdf, pymupdf and Pillow, plus the Windows Segoe UI regular/bold fonts. Artwork uses the brand's original RGB colours; the printer handles final press conversion.
