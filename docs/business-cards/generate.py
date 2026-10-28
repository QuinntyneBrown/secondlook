"""Regenerate the VistaPrint standard-card artwork and review proof."""
from pathlib import Path
from io import BytesIO
import shutil
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.graphics import renderPDF
from svglib.svglib import svg2rlg
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
import pymupdf
from PIL import Image, ImageOps, ImageDraw

HERE = Path(__file__).resolve().parent
W, H = 3.61 * 72, 2.11 * 72
BLEED = .055 * 72
INK, PAPER, ORANGE = '#14181f', '#f6f4ef', '#ee6a1e'
pdfmetrics.registerFont(TTFont('Segoe', 'C:/Windows/Fonts/segoeui.ttf'))
pdfmetrics.registerFont(TTFont('SegoeBold', 'C:/Windows/Fonts/segoeuib.ttf'))
shutil.copyfile(HERE.parent / 'videos/assets/mark.svg', HERE / 'logo.svg')
logo = svg2rlg(str(HERE / 'logo.svg'))

def text(c, x, y, value, size=10, color=INK, bold=False):
    c.setFillColor(HexColor(color))
    c.setFont('SegoeBold' if bold else 'Segoe', size)
    c.drawString(x, y, value)

def rect(c, x, y, w, h, color):
    c.setFillColor(HexColor(color))
    c.rect(x, y, w, h, fill=1, stroke=0)

def mark(c, x, y, size):
    c.saveState()
    c.translate(x, y)
    c.scale(size / 48, size / 48)
    renderPDF.draw(logo, c, 0, 0)
    c.restoreState()

def draw(c, name=None, email=None):
    if name:
        rect(c, 0, 0, W, H, PAPER)
        rect(c, 0, H-5, W, 5, ORANGE)
        mark(c, 18, 98, 34)
        text(c, 61, 111, 'SecondLook', 20, bold=True)
        text(c, 62, 99, 'BUY WITH A CLEARER PICTURE.', 6.6)
        text(c, 19, 72, name, 17, bold=True)
        text(c, 20, 57, 'Co-founder', 9)
        rect(c, 20, 45, 22, 2, ORANGE)
        text(c, 20, 30, email, 10)
        text(c, 20, 15, 'www.secondlook.care', 10, bold=True)
    else:
        rect(c, 0, 0, W, H, INK)
        mark(c, 19, 103, 30)
        text(c, 57, 113, 'SecondLook', 16, PAPER, True)
        text(c, 20, 81, 'Before you buy as is,', 17, PAPER, True)
        text(c, 20, 60, 'get a second look.', 17, ORANGE, True)
        text(c, 20, 40, 'A local mechanic. A live video inspection.', 8.7, PAPER)
        text(c, 20, 28, 'An estimate to get safety certified.', 8.7, PAPER)
        text(c, 20, 12, 'www.secondlook.care', 9, PAPER, True)

def create(filename, name=None, email=None):
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=(W,H), pageCompression=1)
    c.setTitle('SecondLook | ' + (name or 'Shared back'))
    c.setAuthor('SecondLook')
    draw(c,name,email)
    c.showPage(); c.save()
    reader = PdfReader(buffer)
    writer = PdfWriter()
    page = reader.pages[0]
    page.trimbox = RectangleObject([BLEED,BLEED,W-BLEED,H-BLEED])
    page.bleedbox = RectangleObject([0,0,W,H])
    writer.add_page(page)
    writer.add_metadata({'/Title': 'SecondLook | ' + (name or 'Shared back')})
    with open(HERE / filename, 'wb') as output:
        writer.write(output)
    doc = pymupdf.open(HERE / filename)
    doc[0].get_pixmap(dpi=300).save(HERE / filename.replace('.pdf','.png'))

create('quinntyne-front.pdf', 'Quinntyne Brown', 'quinntyne@secondlook.care')
create('rodney-front.pdf', 'Rodney Brown', 'rodney@secondlook.care')
create('shared-back.pdf')

# A separate proof carries guides; the upload files never contain guide marks.
c = canvas.Canvas(str(HERE / 'proof-with-guides.pdf'), pagesize=(612,792))
c.setTitle('SecondLook | Review proof - do not upload')
text(c,36,753,'SecondLook / business card proof',19,bold=True)
text(c,36,732,'Review only. Upload the individual artwork PDFs to VistaPrint.',10)
for index, (name,email) in enumerate([
    ('Quinntyne Brown','quinntyne@secondlook.care'),
    ('Rodney Brown','rodney@secondlook.care'),
    (None,None),
]):
    y=540-index*210
    text(c,36,y+H+12,name or 'Shared back',11,bold=True)
    c.saveState(); c.translate(36,y); draw(c,name,email)
    c.setLineWidth(.5)
    c.setStrokeColor(HexColor('#e43366'))
    c.rect(BLEED,BLEED,W-2*BLEED,H-2*BLEED,fill=0)
    c.setStrokeColor(HexColor('#078cbd')); c.setDash(3,2)
    c.rect(9,9,W-18,H-18,fill=0)
    c.restoreState()
    text(c,320,y+115,'Pink: trim / finished card',10)
    text(c,320,y+98,'Blue: minimum safe area',10)
    text(c,320,y+72,'Finished: 3.5 x 2 inches',10)
    text(c,320,y+55,'Artwork: 3.61 x 2.11 inches',10)
    text(c,320,y+38,'Bleed: 0.055 inches per edge',10)
c.showPage(); c.save()

# Large trimmed views for fast visual review.
preview=Image.new('RGB',(1680,1200),'#e4e2dd')
d=ImageDraw.Draw(preview)
for i, filename in enumerate(['quinntyne-front','rodney-front','shared-back']):
    im=Image.open(HERE / (filename+'.png')).convert('RGB')
    b=round(.055*300)
    im=im.crop((b,b,im.width-b,im.height-b))
    im.thumbnail((756,432))
    x,y=[(48,85),(876,85),(48,650)][i]
    preview.paste(im,(x,y))
    d.text((x,y-27),['QUINNTYNE / FRONT','RODNEY / FRONT','SHARED / BACK'][i],fill=INK)
d.text((876,680),'SecondLook business cards',fill=INK)
d.text((876,715),'Finished size: 3.5 x 2 inches',fill=INK)
d.text((876,750),'Artwork includes bleed and safe margins.',fill=INK)
preview.save(HERE / 'preview.png')

for file in HERE.glob('*.pdf'):
    doc=pymupdf.open(file)
    assert len(doc)==1
    if file.name != 'proof-with-guides.pdf':
        assert abs(doc[0].rect.width-W)<.01
        assert abs(doc[0].rect.height-H)<.01
    print(file.name, 'OK', len(doc[0].get_text()), 'text characters')
