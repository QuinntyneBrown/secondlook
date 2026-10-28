"""Render the business plan and one-page pitch. Run: python tools/business-pdfs/build.py"""

from pathlib import Path
from html import escape
import re

from markdown_it import MarkdownIt
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether,
)
from reportlab.graphics import renderPDF
from svglib.svglib import svg2rlg

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/pdf'
OUT.mkdir(parents=True, exist_ok=True)
INK = colors.HexColor('#14181f')
ORANGE = colors.HexColor('#c74c00')
MUTED = colors.HexColor('#52606b')
PALE = colors.HexColor('#f1eee7')
LINE = colors.HexColor('#dedbd3')
WHITE = colors.white
FONTDIR = Path('C:/Windows/Fonts')
for name, filename in [('Arial', 'arial.ttf'), ('Arial-Bold', 'arialbd.ttf'), ('Arial-Italic', 'ariali.ttf'), ('Arial-BoldItalic', 'arialbi.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONTDIR / filename)))
pdfmetrics.registerFontFamily('Arial', normal='Arial', bold='Arial-Bold', italic='Arial-Italic', boldItalic='Arial-BoldItalic')
LOGO = svg2rlg(str(ROOT / 'docs/videos/assets/mark.svg'))
STYLES = {
    'body': ParagraphStyle('Body', fontName='Arial', fontSize=9.6, leading=14, spaceAfter=8, textColor=INK),
    'h1': ParagraphStyle('Title', fontName='Arial-Bold', fontSize=25, leading=30, textColor=INK, spaceAfter=16, keepWithNext=True),
    'h2': ParagraphStyle('Heading', fontName='Arial-Bold', fontSize=15, leading=20, textColor=ORANGE, spaceBefore=14, spaceAfter=8, keepWithNext=True),
    'h3': ParagraphStyle('Subheading', fontName='Arial-Bold', fontSize=11, leading=15, textColor=INK, spaceBefore=11, spaceAfter=6, keepWithNext=True),
    'table': ParagraphStyle('Table', fontName='Arial', fontSize=8.2, leading=11.2, textColor=INK),
    'tablehead': ParagraphStyle('TableHead', fontName='Arial-Bold', fontSize=8.2, leading=11.2, textColor=WHITE),
    'note': ParagraphStyle('Note', fontName='Arial', fontSize=8, leading=11, textColor=MUTED, spaceAfter=6),
}

def clean(text):
    return text.replace('\u2011', '-').replace('\u2013', '-').replace('\u2014', ' - ').replace('\u00d7', ' x ').replace('\u2192', ' to ')

def inline(children):
    out = []
    for token in children or []:
        if token.type in ('text', 'code_inline'): out.append(escape(clean(token.content)))
        elif token.type in ('softbreak', 'hardbreak'): out.append(' ')
        elif token.type == 'strong_open': out.append('<b>')
        elif token.type == 'strong_close': out.append('</b>')
        elif token.type == 'em_open': out.append('<i>')
        elif token.type == 'em_close': out.append('</i>')
        elif token.type == 'link_open':
            href = token.attrGet('href')
            if href.startswith('http'): out.append(f'<a href="{escape(href, quote=True)}" color="#c74c00">')
            else: out.append('<font color="#c74c00">')
        elif token.type == 'link_close':
            # The matching opening token determines external vs local formatting.
            openings = ''.join(out)
            out.append('</a>' if openings.rfind('<a ') > openings.rfind('</a>') else '</font>')
    return ''.join(out)

def logo(canvas, x, y, size=28):
    canvas.saveState()
    canvas.translate(x,y)
    canvas.scale(size / LOGO.width, size / LOGO.height)
    renderPDF.draw(LOGO, canvas, 0, 0)
    canvas.restoreState()

def furniture(canvas, doc):
    canvas.saveState()
    logo(canvas, 44, 747, 25)
    canvas.setFillColor(INK); canvas.setFont('Arial-Bold', 9)
    canvas.drawString(78, 756, 'SecondLook')
    canvas.setFillColor(MUTED); canvas.setFont('Arial', 8)
    canvas.drawRightString(568, 756, 'BUSINESS PLAN  /  28 OCT 2026')
    canvas.setStrokeColor(LINE); canvas.line(44, 738, 568, 738)
    canvas.line(44, 40, 568, 40)
    canvas.drawString(44, 27, 'CAD | Pre-launch management forecast | First three full operating years')
    canvas.drawRightString(568, 27, str(doc.page))
    canvas.restoreState()

def business_plan():
    tokens = MarkdownIt('commonmark').enable('table').parse((ROOT/'docs/business/business-plan.md').read_text(encoding='utf-8'))
    story = []
    i = 0
    while i < len(tokens):
        t = tokens[i]
        if t.type == 'heading_open':
            level = int(t.tag[1]); story.append(Paragraph(inline(tokens[i+1].children), STYLES['h1' if level == 1 else 'h2' if level == 2 else 'h3'])); i += 3; continue
        if t.type == 'paragraph_open':
            text = inline(tokens[i+1].children)
            # Navigation is for the Markdown source; both references are listed at the end of the PDF.
            if 'Financial assumptions and methodology' not in text:
                story.append(Paragraph(text, STYLES['body']))
            i += 3; continue
        if t.type == 'table_open':
            rows=[]; row=[]; header=True
            i+=1
            while tokens[i].type != 'table_close':
                q=tokens[i]
                if q.type=='thead_close': header=False
                if q.type=='tr_open': row=[]
                if q.type=='inline': row.append(Paragraph(inline(q.children),STYLES['tablehead' if header else 'table']))
                if q.type=='tr_close': rows.append(row)
                i+=1
            n=len(rows[0]); widths={2:[310,214],3:[156,154,214],4:[245,93,93,93],5:[224,75,75,75,75]}[n]
            table=Table(rows,colWidths=widths,repeatRows=1,hAlign='LEFT')
            commands=[('BACKGROUND',(0,0),(-1,0),INK),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),('LINEBELOW',(0,0),(-1,0),.6,INK)]
            for r in range(1,len(rows)):
                if r%2: commands.append(('BACKGROUND',(0,r),(-1,r),PALE))
                commands.append(('LINEBELOW',(0,r),(-1,r),.25,LINE))
            table.setStyle(TableStyle(commands))
            group = []
            if story and isinstance(story[-1], Paragraph) and story[-1].style.name in ('Heading', 'Subheading'):
                group.append(story.pop())
            group.append(table)
            story.extend([KeepTogether(group),Spacer(1,10)])
        i+=1
    references = [Paragraph('References and companion model',STYLES['h2'])]
    refs=[
        ('RTFG Financial','https://www.rodneythefinanceguy.ca/'),
        ('RTFG partners and affiliates','https://www.rodneythefinanceguy.ca/financial-services/partners-affiliates'),
        ('Ontario Safety Standards Certificate','https://www.ontario.ca/page/safety-standards-certificate'),
        ('CARFAX Canada used-car buying guide','https://www.carfax.ca/learn/buying/used-car-buying-guide'),
        ('OMVIC advertising guideline','https://www.omvic.ca/selling/dealer-guidelines-and-resources/advertising-guideline/'),
        ('Stripe Canada pricing','https://stripe.com/en-ca/pricing'),
        ('CRA GST/HST rates and place of supply','https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-place-supply.html'),
    ]
    for title,url in refs:
        references.append(Paragraph(f'<b>{escape(title)}</b><br/><a href="{escape(url,quote=True)}" color="#c74c00">{escape(url)}</a>',STYLES['note']))
    references.append(Paragraph('Companion files: docs/business/revenue-projection.md and outputs/secondlook-business-plan-20261028/secondlook-three-year-projection.xlsx. Source: docs/business/business-plan.md. Financial figures are the base case as of 28 October 2026.',STYLES['note']))
    story.append(KeepTogether(references))
    doc=SimpleDocTemplate(str(OUT/'secondlook-business-plan.pdf'),pagesize=(612,792),leftMargin=44,rightMargin=44,topMargin=68,bottomMargin=54,title='SecondLook Business Plan',author='SecondLook',allowSplitting=1)
    doc.build(story,onFirstPage=furniture,onLaterPages=furniture)

def elevator_pitch():
    from reportlab.pdfgen import canvas
    path=OUT/'secondlook-elevator-pitch.pdf'
    canvas=canvas.Canvas(str(path),pagesize=(612,792));canvas.setTitle('SecondLook Elevator Pitch');canvas.setAuthor('SecondLook')
    canvas.setFillColor(colors.HexColor('#f8f6f1'));canvas.rect(0,0,612,792,fill=1,stroke=0)
    logo(canvas,44,706,48)
    canvas.setFillColor(INK);canvas.setFont('Arial-Bold',20);canvas.drawString(106,732,'SecondLook')
    canvas.setFillColor(ORANGE);canvas.setFont('Arial-Bold',9);canvas.drawString(106,713,'A SECOND LOOK BEFORE YOU BUY')
    def para(text,x,top,width,size=10,leading=14,color=INK,bold=False):
        style=ParagraphStyle('PitchBlock',fontName='Arial-Bold' if bold else 'Arial',fontSize=size,leading=leading,textColor=color)
        p=Paragraph(clean(text),style);_,h=p.wrap(width,700);p.drawOn(canvas,x,top-h);return top-h
    y=para('Know the cost<br/>before you commit.',44,681,524,29,33,bold=True)
    source=(ROOT/'docs/business/elevator-pitch.md').read_text(encoding='utf-8')
    spoken=source.split('\n\n')[2]
    y=para(escape(spoken),44,y-18,524,11,16)
    y-=18
    canvas.setFillColor(INK);canvas.roundRect(44,y-60,524,60,9,fill=1,stroke=0)
    for x,title,sub in [(60,'$50','First inspection'),(232,'$25','Additional car / 14-day window'),(412,'+$20','Body shop add-on')]:
        para(title,x,y-10,150,20,23,WHITE,True)
        para(sub,x,y-38,156,8,10,WHITE)
    y-=70
    y=para('Prices before applicable tax.',44,y,524,8,11,MUTED)-15
    y=para('THE GTA LAUNCH',44,y,524,10,13,ORANGE,True)
    y=para("Build the first referral network through Rodney's automotive relationships, then validate provider costs and repeat bookings in a 90-day pilot. Partner volumes and formal SecondLook commitments remain unconfirmed.",44,y-7,524,10,14)
    y-=18
    y=para('THREE-YEAR REVENUE OPPORTUNITY',44,y,524,10,13,ORANGE,True)
    top=y-8
    for x,year,revenue in [(44,'YEAR 1','$46,793'),(222,'YEAR 2','$178,520'),(400,'YEAR 3','$512,224')]:
        para(year,x,top,150,8,11,MUTED,True);para(revenue,x,top-16,165,21,24,INK,True)
    y=top-52
    y=para('Base-case forecasts in CAD, after assumed refunds and before HST. First three full operating years after launch. Revenue is modeled, not actual or contracted.',44,y,524,8,11,MUTED)
    y-=15
    y=para('NEXT STEP',44,y,524,10,13,ORANGE,True)
    y=para('Validate the first referral partners and provider payouts. Proposed staged funding: <b>approximately $110,000</b>, subject to pilot results and a monthly cash plan.',44,y-7,524,10,14)
    y=para('Year 3 operating result: approximately $20,763 before tax, financing and D&amp;A. Founder compensation is below the assumed replacement rate in Years 1-2.',44,y-8,524,8,11,MUTED)
    if y<80: raise ValueError(f'Pitch content overlaps footer: {y}')
    canvas.setStrokeColor(LINE);canvas.line(44,65,568,65)
    para('Remote review is not an Ontario Safety Standards Certificate or a guarantee of passing an in-person inspection.',44,56,524,7.5,10,MUTED)
    para('28 Oct 2026 | Plan and financial assumptions: docs/business/ | RTFG context: rodneythefinanceguy.ca',44,32,524,7.2,9,MUTED)
    canvas.showPage();canvas.save()

business_plan()
elevator_pitch()
print('Created both PDFs in',OUT)
