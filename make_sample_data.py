import sys as _sys, os as _os
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
import ahim_reference as AR_REF, ahim_sheets as AS
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.comments import Comment
from openpyxl.utils import get_column_letter as L
import datetime as dt

F='Arial'
NAVY='203646'; GREY='5D6E79'; INFILL='FFF8DC'; FFILL='EEF2F4'
thin=Side(style='thin',color='C9D3D9'); B=Border(left=thin,right=thin,top=thin,bottom=thin)
def font(**k): k.setdefault('name',F); k.setdefault('size',10); return Font(**k)
def fill(c): return PatternFill('solid',start_color=c,end_color=c)
OKF,ALF,DGF=fill('D7EEDF'),fill('FBEBC0'),fill('F4CFC9')

wb=Workbook()
G=wb.active; G.title='Guide'
AR=wb.create_sheet('Asset_Register'); RC=wb.create_sheet('Records'); LS=wb.create_sheet('Lists')

# ---------------- LISTS ----------------
lists={
 'A':('Areas',['Acid plant','Calciner','Substation','Power plant','Mobile fleet','Utilities']),
 'B':('Asset classes',['Rotating - pump','Rotating - fan / blower','Rotating - gearbox / drive','Rotating - agitator','Rotary kiln','Fired equipment','Boiler','Pressure vessel','Tank','Piping','Structure','Electrical - transformer','Electrical - switchgear / MCC','Diesel generator','Light vehicle','Heavy equipment']),
 'C':('Sources (input)',['Vibration & visual route','IR survey','Substation inspection','Statutory inspection','Ultrasonic report','Oil analysis','DG checklist','LV/HV inspection checklist','LV/HV prestart checklist','Ad hoc / operator report']),
 'D':('Techniques',['Vibration','Lubrication / oil','Ultrasonics (airborne)','Ultrasonic thickness','Infrared','Visual','Statutory','Tank & vessel','Piping','Structural','Electrical','DG checks','Fleet inspection','Prestart']),
 'E':('Record stages',['No action','Raised','WO raised','Scheduled','Awaiting verification','Closed']),
 'F':('Status',['OK','Alert','Danger']),
 'G':('Limit direction',['Higher is worse','Lower is worse']),
 'H':('Asset state',['Active','Standby','Out of service','Decommissioned']),
 'I':('Operating mode',['Duty','Standby','Mobile']),
 'J':('Yes / No',['Y','N']),
}
for c,(h,items) in lists.items():
    LS[f'{c}1']=h; LS[f'{c}1'].font=font(bold=True,color='FFFFFF'); LS[f'{c}1'].fill=fill(NAVY)
    for i,v in enumerate(items): LS[f'{c}{i+2}']=v; LS[f'{c}{i+2}'].font=font()
    LS.column_dimensions[c].width=max(16,max(len(x) for x in items+[h])+2)
def ptab(r,hdr,rows,note=None):
    for j,h in enumerate(hdr):
        c=LS.cell(r,12+j,h); c.font=font(bold=True,color='FFFFFF'); c.fill=fill(NAVY)
    for i,row in enumerate(rows):
        for j,v in enumerate(row):
            c=LS.cell(r+1+i,12+j,v); c.font=font(color='0000FF' if j>0 else '000000'); c.border=B
            if j>0: c.fill=fill(INFILL)
    if note: LS.cell(r+1+len(rows),12,note).font=font(italic=True,color=GREY,size=9)
ptab(1,['ACI factor','Weight'],[['Safety & environment',0.30],['Production impact',0.30],['Redundancy',0.15],['Repair cost / MTTR',0.15],['Failure history',0.10]],'Weights must total 1.00. Agree with Engineering Manager.')
ptab(9,['Priority','Minimum score','Response time (days)'],[['P1',70,7],['P2',45,30],['P3',0,60]])
ptab(14,['Severity','Factor'],[['Danger',1.0],['Alert',0.6]],'Priority score = ACI x severity factor. Any Danger is always P1.')
ptab(19,['Criticality class','Minimum ACI'],[['A',70],['B',45],['C',0]])
ptab(23,['Statutory rule','Days'],[['Expiry alert window',60]],'Certificate expiring within this window = Alert; expired = Danger')
ptab(27,['Condition score (for AHI)','Score'],[['OK',100],['Alert',60],['Danger',20],['Unknown',50]],'Unknown = not inspected within the required interval')
LS.column_dimensions['L'].width=28; LS.column_dimensions['M'].width=15; LS.column_dimensions['N'].width=20
LS.cell(52,12,'Blue text on cream = settings you can change. Every formula in the workbook reads from these cells.').font=font(italic=True,color=GREY,size=9)

def rng(c): n=len(lists[c][1]); return f'=Lists!${c}$2:${c}${n+1}'

# ---------------- ASSET REGISTER ----------------
TECH=lists['D'][1]
reg_cols=[('Pronto asset no.',14,'in'),('Site tag',13,'in'),('Description',28,'in'),('Area',13,'in'),('System / location',20,'in'),('Asset class',22,'in'),
 ('Manufacturer',14,'in'),('Model',12,'in'),('Serial no.',12,'in'),('Operating mode',11,'in'),('Asset state',11,'in'),
 ('Safety & env. (1-5)',9,'in'),('Production (1-5)',9,'in'),('Redundancy (1-5)',9,'in'),('Repair cost / MTTR (1-5)',9,'in'),('Failure history (1-5)',9,'in'),
 ('ACI (0-100)',8,'f'),('Class',7,'f'),('Current status',10,'f'),('Open records',8,'f')]
reg_cols+= [(t,6.5,'in') for t in TECH]
reg_cols+= [('Statutory cert. required',9,'in'),('Certificate expiry',12,'in'),('Days to expiry',9,'f'),('Statutory status',10,'f'),('Responsible',14,'in'),('Remarks',30,'in')]
reg_cols+= [(h,w,'in') for h,w in AS.REG_EXTRA]  # cols 41-45
RN=1000; RR=3000  # register rows, record rows
def header(ws,cols,title,sub):
    ws['A1']=title; ws['A1'].font=font(bold=True,size=14,color=NAVY)
    ws['A2']=sub; ws['A2'].font=font(size=9,color=GREY)
    for j,(h,w,k) in enumerate(cols,1):
        c=ws.cell(4,j,h); c.font=font(bold=True,color='FFFFFF' if k=='in' else '1D2A32',size=9)
        c.fill=fill(NAVY if k=='in' else 'C9D3D9'); c.alignment=Alignment(wrap_text=True,vertical='center',horizontal='center'); c.border=B
        ws.column_dimensions[L(j)].width=w
    ws.row_dimensions[4].height=48
header(AR,reg_cols,'AHIM Master Asset Register','Dark headers = enter data. Grey headers = automatic (do not type). Blue italic rows are SAMPLES: replace with the Pronto asset list. Pronto asset no. is the unique key used everywhere.')
tc0=21  # first technique column (U)
# technique group label
AR.cell(3,tc0,'Applicable techniques (enter Y)').font=font(bold=True,size=9,color=NAVY)
for j in range(tc0,tc0+len(TECH)):
    AR.cell(4,j).alignment=Alignment(text_rotation=90,horizontal='center',vertical='bottom')
AR.row_dimensions[4].height=110
AR.cell(3,12,'Criticality factors: 1 = low impact, 5 = severe').font=font(bold=True,size=9,color=NAVY)

T=dict(VA='Vibration',OA='Lubrication / oil',US='Ultrasonics (airborne)',UT='Ultrasonic thickness',IR='Infrared',VI='Visual',ST_='Statutory',TV='Tank & vessel',PI='Piping',STR='Structural',EI='Electrical',DG='DG checks',FI='Fleet inspection',PS='Prestart')
assets=[
 # pronto, tag, desc, area, system, class, mfr, model, mode, f[5], techs, stat, expiry, resp
 ('100101','AP-SF-01','Sulphur furnace','Acid plant','Gas generation','Fired equipment','','', 'Duty',[5,5,5,5,2],'IR VI ST_ STR','Y','2027-03-18','Mechanical'),
 ('100102','AP-WHB-01','Waste heat boiler','Acid plant','Gas generation','Boiler','','','Duty',[5,5,5,4,2],'US UT IR VI ST_ TV','Y','2026-10-22','Mechanical'),
 ('100103','AP-BL-01','Main air blower','Acid plant','Gas generation','Rotating - fan / blower','','','Duty',[4,5,5,4,3],'VA OA US IR VI EI','N','','Mechanical'),
 ('100104','AP-CV-01','SO2 converter','Acid plant','Conversion','Pressure vessel','','','Duty',[4,5,5,5,1],'IR VI TV STR','N','','Mechanical'),
 ('100105','AP-P-101','Drying tower acid pump','Acid plant','Drying & absorption','Rotating - pump','','','Duty',[4,4,3,3,4],'VA OA US IR VI EI','N','','Mechanical'),
 ('100106','AP-P-102','Interpass tower acid pump','Acid plant','Drying & absorption','Rotating - pump','','','Duty',[4,5,3,3,2],'VA OA US IR VI EI','N','','Mechanical'),
 ('100107','AP-P-103','Final tower acid pump','Acid plant','Drying & absorption','Rotating - pump','','','Duty',[3,4,3,3,3],'VA OA US IR VI EI','N','','Mechanical'),
 ('100108','AP-P-201','Boiler feed water pump A','Acid plant','Steam system','Rotating - pump','','','Duty',[4,5,2,3,3],'VA OA US IR VI EI','N','','Mechanical'),
 ('100109','AP-P-202','Boiler feed water pump B','Acid plant','Steam system','Rotating - pump','','','Standby',[4,5,2,3,1],'VA OA US IR VI EI','N','','Mechanical'),
 ('100110','AP-P-301','Molten sulphur pump','Acid plant','Sulphur handling','Rotating - pump','','','Duty',[3,4,3,2,2],'VA OA US IR VI','N','','Mechanical'),
 ('100111','AP-AG-01','Sulphur melter agitator','Acid plant','Sulphur handling','Rotating - agitator','','','Duty',[2,2,3,2,2],'VA OA VI','N','','Mechanical'),
 ('100112','AP-CT-01','Cooling tower fan 1','Acid plant','Cooling water','Rotating - gearbox / drive','','','Duty',[2,3,2,2,4],'VA OA VI STR EI','N','','Mechanical'),
 ('100113','AP-TK-01','Product acid storage tank','Acid plant','Product storage','Tank','','','Duty',[5,3,4,4,2],'UT VI ST_ TV STR','Y','2027-04-02','Mechanical'),
 ('100114','AP-PL-01','Acid transfer line','Acid plant','Product storage','Piping','','','Duty',[5,4,5,2,3],'UT VI PI','N','','Mechanical'),
 ('100115','AP-AR-01','Instrument air receiver','Acid plant','Utilities air','Pressure vessel','','','Duty',[4,2,3,2,1],'US VI ST_ TV','Y','2027-03-12','Mechanical'),
 ('100201','CK-1080','Calciner kiln 1080','Calciner','Calcining','Rotary kiln','','','Duty',[4,5,5,5,3],'VA OA IR VI STR','N','','Mechanical'),
 ('100301','SS-TX-01','Transformer TX-01','Substation','Main substation','Electrical - transformer','','','Duty',[4,5,5,5,1],'OA US IR VI EI','N','','Electrical'),
 ('100302','SS-MCC-01','Acid plant MCC','Substation','Main substation','Electrical - switchgear / MCC','','','Duty',[4,5,5,3,2],'US IR VI EI','N','','Electrical'),
 ('100401','PP-GEN-01','Diesel generator Gen 1','Power plant','Power station','Diesel generator','Hyundai','','Duty',[4,5,3,4,4],'VA OA IR VI EI DG','N','','Power plant'),
 ('100402','PP-GEN-02','Diesel generator Gen 2','Power plant','Power station','Diesel generator','Hyundai','','Duty',[4,5,3,4,2],'VA OA IR VI EI DG','N','','Power plant'),
 ('100403','PP-GEN-03','Diesel generator Gen 3','Power plant','Power station','Diesel generator','Hyundai','','Standby',[4,5,3,4,2],'VA OA IR VI EI DG','N','','Power plant'),
 ('100404','PP-GEN-04','Diesel generator Gen 4','Power plant','Power station','Diesel generator','Hyundai','','Duty',[5,5,3,5,4],'VA OA IR VI EI DG','N','','Power plant'),
 ('100501','LV-01','Light vehicle LV-01 (pickup)','Mobile fleet','Light vehicles','Light vehicle','','','Mobile',[3,2,2,1,2],'OA VI FI PS','N','','Fleet workshop'),
 ('100502','LV-02','Light vehicle LV-02 (pickup)','Mobile fleet','Light vehicles','Light vehicle','','','Mobile',[3,2,2,1,1],'OA VI FI PS','N','','Fleet workshop'),
 ('100601','HV-01','Dozer HV-01','Mobile fleet','Heavy equipment','Heavy equipment','','','Mobile',[4,3,3,4,3],'OA VI FI PS','N','','Fleet workshop'),
 ('100602','HV-02','Compactor HV-02','Mobile fleet','Heavy equipment','Heavy equipment','','','Mobile',[4,2,3,3,2],'OA VI FI PS','N','','Fleet workshop'),
 ('100603','HV-03','Front-end loader HV-03','Mobile fleet','Heavy equipment','Heavy equipment','','','Mobile',[4,3,3,4,2],'OA VI FI PS','N','','Fleet workshop'),
]
tkeys=list(T.keys())
SAMPLE=font(italic=True,color='0000FF')
for i,a in enumerate(assets):
    r=5+i
    vals=[a[0],a[1],a[2],a[3],a[4],a[5],a[6],a[7],'',a[8],'Active']+a[9]
    for j,v in enumerate(vals,1): AR.cell(r,j,v)
    for k in a[10].split(): AR.cell(r,tc0+tkeys.index(k),'Y')
    AR.cell(r,35,a[11])
    if a[12]: AR.cell(r,36,dt.datetime.strptime(a[12],'%Y-%m-%d'))
    AR.cell(r,39,a[13])
    _x=AS.merge_extras(a, OLDX.get(a[0],{}) if 'OLDX' in globals() else {})
    for _k,_v in enumerate(_x):
        if _v not in (None,''): AR.cell(r,41+_k,_v)
    if not _x[0] and 'rv' in globals(): rv('Strategy class to confirm', a[0], f"{a[2]}: equipment type not identified from the source data; set Strategy class in Asset_Register")
NA=len(assets)
for r in range(5,RN+1):
    f=lambda col: f'${col}{r}'
    AR.cell(r,17,f'=IF(COUNT($L{r}:$P{r})<5,"",ROUND(($L{r}*Lists!$M$2+$M{r}*Lists!$M$3+$N{r}*Lists!$M$4+$O{r}*Lists!$M$5+$P{r}*Lists!$M$6)/5*100,0))')
    AR.cell(r,18,f'=IF($Q{r}="","",IF($Q{r}>=Lists!$M$20,"A",IF($Q{r}>=Lists!$M$21,"B","C")))')
    AR.cell(r,19,f'=IF($A{r}="","",IF(COUNTIF(Records!$C$5:$C${RR},$A{r})=0,"No data",CHOOSE(_xlfn.MAXIFS(Records!$R$5:$R${RR},Records!$C$5:$C${RR},$A{r},Records!$Y$5:$Y${RR},"<>Closed")+1,"OK","Alert","Danger")))')
    AR.cell(r,20,f'=IF($A{r}="","",COUNTIFS(Records!$C$5:$C${RR},$A{r},Records!$R$5:$R${RR},">0",Records!$Y$5:$Y${RR},"<>Closed"))')
    AR.cell(r,37,f'=IF($AJ{r}="","",$AJ{r}-TODAY())')
    AR.cell(r,38,f'=IF($AJ{r}="","",IF($AK{r}<0,"Danger",IF($AK{r}<=Lists!$M$24,"Alert","OK")))')
    for j in range(1,len(reg_cols)+1):
        c=AR.cell(r,j); c.border=B
        kind=reg_cols[j-1][2]
        if kind=='f': c.fill=fill(FFILL); c.font=font()
        else: c.font=SAMPLE if r<5+NA else font()
        if j>=12 and j!=36 and j<=38 or (tc0<=j<tc0+len(TECH)): c.alignment=Alignment(horizontal='center')
    AR.cell(r,36).number_format='dd-mmm-yy'
AR.freeze_panes='D5'
AR.auto_filter.ref=f'A4:{L(len(reg_cols))}{RN}'
def dv(ws,formula,ref,prompt=None,typ='list',**k):
    d=DataValidation(type=typ,formula1=formula,allow_blank=True,**k)
    if prompt: d.promptTitle='Input'; d.prompt=prompt; d.showInputMessage=True
    d.error='Choose a value from the list.'; d.showErrorMessage=True
    ws.add_data_validation(d); d.add(ref)
dv(AR,rng('A'),f'D5:D{RN}'); dv(AR,rng('B'),f'F5:F{RN}'); dv(AR,rng('I'),f'J5:J{RN}'); dv(AR,rng('H'),f'K5:K{RN}')
dv(AR,'1',f'L5:P{RN}',typ='whole',operator='between',formula2='5',prompt='Score 1 (low impact) to 5 (severe)')
dv(AR,'"Y"',f'{L(tc0)}5:{L(tc0+len(TECH)-1)}{RN}')
dv(AR,rng('J'),f'AI5:AI{RN}')
dv(AR,'DATE(2000,1,1)',f'AJ5:AJ{RN}',typ='date',operator='greaterThan')
# duplicate key check
AR.conditional_formatting.add(f'A5:A{RN}',FormulaRule(formula=[f'AND($A5<>"",COUNTIF($A$5:$A${RN},$A5)>1)'],fill=DGF))
for col in ['S','AL']:
    AR.conditional_formatting.add(f'{col}5:{col}{RN}',CellIsRule(operator='equal',formula=['"Danger"'],fill=DGF,font=font(bold=True,color='9C1C10')))
    AR.conditional_formatting.add(f'{col}5:{col}{RN}',CellIsRule(operator='equal',formula=['"Alert"'],fill=ALF,font=font(bold=True,color='7A5300')))
    AR.conditional_formatting.add(f'{col}5:{col}{RN}',CellIsRule(operator='equal',formula=['"OK"'],fill=OKF,font=font(color='1F6B40')))
AR.conditional_formatting.add(f'R5:R{RN}',CellIsRule(operator='equal',formula=['"A"'],font=font(bold=True,color=NAVY)))
AR['A4'].comment=Comment('Unique key. Use the asset number exactly as in Pronto so records link to work orders. Duplicates turn red.','AHIM')
AR['S4'].comment=Comment('Worst status among this asset\'s records that are not Closed. "No data" = no record yet.','AHIM')

# ---------------- RECORDS ----------------
rec_cols=[('Record ID',10,'f'),('Date',11,'in'),('Pronto asset no.',13,'in'),('Description',24,'f'),('Area',12,'f'),('Class',6,'f'),('ACI',6,'f'),
 ('Source (input)',22,'in'),('Technique',18,'in'),('Component / parameter / checklist item',30,'in'),('Value',8,'in'),('Unit',8,'in'),
 ('Alert limit',8,'in'),('Danger limit',8,'in'),('Limit direction',13,'in'),('Inspector status',10,'in'),('Status',9,'f'),('Severity',7,'f'),
 ('Finding',36,'in'),('Recommendation',36,'in'),('Priority score',8,'f'),('Priority',8,'f'),('Due date',11,'f'),('Pronto WO no.',11,'in'),
 ('Record stage',15,'in'),('Inspector',14,'in'),('Date closed',11,'in'),('Verified by',14,'in'),('Days open',7,'f'),('Due status',13,'f'),('Remarks',28,'in')]
rec_cols+= [(h,w,'in') for h,w in AS.REC_EXTRA]  # cols 32-36
header(RC,rec_cols,'AHIM Common Record','One row per reading, checklist defect or certificate check, from ANY source. Dark headers = enter. Grey = automatic. Blue italic rows are SAMPLES showing each source: delete them before go-live.')
d=lambda s: dt.datetime.strptime(s,'%Y-%m-%d')
# ---------- generated 12-month sample history (Oct 2025 - Sep 2026) ----------
TAG2NO={x[1]:x[0] for x in assets}
MON=[(2025,10),(2025,11),(2025,12)]+[(2026,m) for m in range(1,10)]
def mdate(i,day): y,m=MON[i]; return f'{y}-{m:02d}-{day:02d}'
HI,LO='Higher is worse','Lower is worse'
TR=[
 ('AP-BL-01','Vibration & visual route','Vibration','Overall velocity (max point)','mm/s',4.5,7.1,HI,[2.1,2.2,2.0,2.3,2.4,2.6,2.9,3.2,3.5,3.9,4.3,4.6],12,'RCM Specialist'),
 ('AP-P-101','Vibration & visual route','Vibration','Overall velocity (max point)','mm/s',4.5,7.1,HI,[2.6,2.8,3.0,3.3,3.9,4.4,2.4,2.6,2.9,3.4,4.3,9.8],22,'RCM Specialist'),
 ('AP-P-102','Vibration & visual route','Vibration','Overall velocity (max point)','mm/s',4.5,7.1,HI,[2.0,2.1,1.9,2.2,2.0,2.1,2.3,2.2,2.1,2.4,2.3,2.2],22,'RCM Specialist'),
 ('AP-P-103','Vibration & visual route','Vibration','Overall velocity (max point)','mm/s',4.5,7.1,HI,[3.1,3.0,3.2,3.4,3.3,3.6,3.9,4.1,4.6,4.7,4.9,5.2],15,'RCM Specialist'),
 ('AP-P-201','Vibration & visual route','Vibration','Overall velocity (max point)','mm/s',4.5,7.1,HI,[2.5,2.6,2.6,2.8,2.9,3.1,3.4,3.9,4.2,4.7,2.6,2.7],2,'RCM Specialist'),
 ('AP-P-202','Vibration & visual route','Vibration','Overall velocity (max point)','mm/s',4.5,7.1,HI,[1.8,1.9,1.8,2.0,1.9,2.0,2.1,2.0,2.2,2.1,2.0,2.1],5,'RCM Specialist'),
 ('AP-P-301','Vibration & visual route','Vibration','Overall velocity (max point)','mm/s',4.5,7.1,HI,[2.4,2.5,2.3,2.6,2.5,2.7,2.6,2.8,2.7,2.9,2.8,2.7],1,'RCM Specialist'),
 ('AP-AG-01','Vibration & visual route','Vibration','Overall velocity (max point)','mm/s',4.5,7.1,HI,[1.4,1.5,1.4,1.6,1.5,1.6,1.5,1.7,1.6,1.6,1.7,1.6],2,'RCM Specialist'),
 ('AP-CT-01','Vibration & visual route','Vibration','Gearbox overall velocity','mm/s',4.5,7.1,HI,[3.2,3.4,3.5,3.8,4.0,4.2,4.4,4.8,5.4,5.9,6.4,6.8],10,'RCM Specialist'),
 ('AP-SF-01','IR survey','Infrared','Burner-end shell temperature','°C',280,320,HI,[210,215,212,220,230,238,245,248,250,265,278,340],8,'RCM Specialist'),
 ('AP-CV-01','IR survey','Infrared','Bed 3 outlet flange dT above baseline','°C',30,60,HI,[5,6,6,7,8,9,10,12,22,31,38,45],20,'RCM Specialist'),
 ('CK-1080','IR survey','Infrared','Zone 4 shell temperature','°C',280,350,HI,[240,245,250,248,255,262,268,270,272,276,282,310],10,'RCM Specialist'),
 ('SS-TX-01','Substation inspection','Infrared','LV bushing connection dT','°C',4,15,HI,[2,2,3,3,5,6,2,3,3,3,12,14],24,'Electrician'),
 ('SS-MCC-01','IR survey','Infrared','Hottest termination dT','°C',4,15,HI,[2,3,3,2,3,3,3,16,3,3,3,42],24,'RCM Specialist'),
 ('AP-AR-01','Ultrasonic report','Ultrasonics (airborne)','Leak survey level','dBµV',30,40,HI,[12,11,13,12,12,14,13,12,32,12,14,13],1,'RCM Specialist'),
 ('AP-P-201','Oil analysis','Lubrication / oil','Water in bearing oil','ppm',1000,2000,HI,[150,180,160,200,240,300,420,550,700,850,980,1200],5,'RCM Specialist'),
 ('AP-P-101','Oil analysis','Lubrication / oil','Iron (Fe)','ppm',50,100,HI,[12,14,15,18,22,30,8,10,12,16,24,85],22,'RCM Specialist'),
 ('AP-CT-01','Oil analysis','Lubrication / oil','Copper (Cu) in gearbox oil','ppm',30,60,HI,[10,12,12,14,16,18,22,32,34,36,38,40],10,'RCM Specialist'),
 ('HV-03','Oil analysis','Lubrication / oil','Engine oil silicon (Si)','ppm',20,30,HI,[8,9,8,10,9,11,10,12,14,16,18,22],10,'RCM Specialist'),
 ('HV-01','Oil analysis','Lubrication / oil','Engine oil iron (Fe)','ppm',60,100,HI,[20,22,21,25,24,26,28,27,30,29,31,33],10,'RCM Specialist'),
 ('HV-02','Oil analysis','Lubrication / oil','Engine oil iron (Fe)','ppm',60,100,HI,[18,19,20,19,22,21,23,22,24,23,25,24],10,'RCM Specialist'),
 ('PP-GEN-01','DG checklist','DG checks','Turbo outlet exhaust temperature','°C',520,580,HI,[470,475,480,478,485,490,495,500,505,510,515,560],28,'DG operator'),
 ('PP-GEN-02','DG checklist','DG checks','Exhaust temperature spread between cylinders','°C',50,80,HI,[20,22,21,25,24,23,26,25,27,30,32,35],28,'DG operator'),
 ('PP-GEN-03','DG checklist','DG checks','Turbo outlet exhaust temperature','°C',520,580,HI,[455,458,450,460,462,458,465,460,463,466,462,465],28,'DG operator'),
 ('PP-GEN-04','DG checklist','DG checks','Lube oil pressure at rated load','bar',3.5,2.5,LO,[4.2,4.2,4.1,4.1,4.0,4.0,3.9,3.9,3.8,3.7,3.6,3.1],28,'DG operator'),
 ('AP-WHB-01','Ultrasonic report','Ultrasonic thickness','Economiser tube minimum wall','mm',5.0,4.5,LO,[6.20,None,None,6.15,None,None,6.11,None,None,None,6.05,None],28,'UT contractor'),
 ('AP-PL-01','Ultrasonic report','Ultrasonic thickness','Elbow E-07 wall','mm',4.5,4.0,LO,[5.6,None,None,5.4,None,None,5.1,None,None,4.7,None,3.9],18,'UT contractor'),
 ('AP-TK-01','Ultrasonic report','Ultrasonic thickness','Shell course 1 thickness','mm',7.5,6.5,LO,[8.0,None,None,None,None,None,7.4,None,None,None,None,7.2],20,'UT contractor'),
]
FX={
 ('AP-P-101','Overall velocity (max point)',11):('DE bearing outer race defect (BPFO) with harmonics','Replace DE bearing; check alignment and soft foot','245289','WO raised','',''),
 ('AP-P-101','Iron (Fe)',11):('Iron rising sharply, oil darkened','Oil change and filter; resample in 2 weeks','245290','Awaiting verification','',''),
 ('AP-BL-01','Overall velocity (max point)',11):('1x running speed rising: unbalance','Clean impeller; trim balance at next stop','245102','WO raised','',''),
 ('AP-P-103','Overall velocity (max point)',8):('Looseness pattern at pump feet','Check holding-down bolts and soft foot','','Raised','',''),
 ('AP-P-201','Overall velocity (max point)',9):('Looseness at pump base','Retorque base bolts','244402','Closed','2026-08-12','Mechanical Supervisor'),
 ('AP-CT-01','Gearbox overall velocity',7):('Gear-mesh sidebands rising','Borescope gearbox; plan overhaul and order spare','243766','Scheduled','',''),
 ('AP-CT-01','Copper (Cu) in gearbox oil',7):('Copper wear metal rising','Oil change; trend wear metals monthly','243767','Scheduled','',''),
 ('AP-SF-01','Burner-end shell temperature',11):('Burner-end shell hot spot: refractory loss suspected','Refractory inspection at next stop; daily IR until then','245011','Scheduled','',''),
 ('AP-CV-01','Bed 3 outlet flange dT above baseline',9):('Bed 3 outlet flange running hot','Hot-retorque flange bolts; check gasket','244512','Scheduled','',''),
 ('CK-1080','Zone 4 shell temperature',10):('Zone 4 shell hot spot, rising','Check refractory; run shell cooling fan','','Raised','',''),
 ('SS-TX-01','LV bushing connection dT',4):('LV connection running warm','Clean and retorque connection','243120','Closed','2026-04-15','Electrical Supervisor'),
 ('SS-TX-01','LV bushing connection dT',10):('LV bushing connection hot, rising','Clean and retorque at next outage','244871','WO raised','',''),
 ('SS-MCC-01','Hottest termination dT',7):('Feeder F-03 termination loose','Re-terminate lug','243910','Closed','2026-05-29','Electrical Supervisor'),
 ('SS-MCC-01','Hottest termination dT',11):('B-phase breaker termination 42 °C above A and C','Isolate, re-terminate and torque lugs; re-scan','245318','WO raised','',''),
 ('AP-AR-01','Leak survey level',8):('Drain valve passing air','Replace drain valve','243955','Closed','2026-06-20','Mechanical Supervisor'),
 ('AP-P-201','Water in bearing oil',11):('Water contamination in bearing oil','Change oil; fit desiccant breather; check seal','245044','WO raised','',''),
 ('HV-03','Engine oil silicon (Si)',11):('Silicon elevated: dirt entry via air intake suspected','Inspect intake hoses and filter seals; resample','','Raised','',''),
 ('PP-GEN-01','Turbo outlet exhaust temperature',11):('Turbo outlet temperature above alert, rising over 3 days','Check air filter, intercooler and injector balance','','Raised','',''),
 ('PP-GEN-04','Lube oil pressure at rated load',11):('Oil pressure below alert at rated load','Check oil level, filter differential and pump','','Raised','',''),
 ('AP-PL-01','Elbow E-07 wall',11):('Wall below 4.0 mm minimum required','Replace elbow spool; extend UT grid +/-1 m','245207','Scheduled','',''),
 ('AP-TK-01','Shell course 1 thickness',6):('Shell at 74% of nominal 10 mm','Fitness-for-service assessment; UT quarterly','','Raised','',''),
}
DAYFIX={('AP-TK-01',6):2,('AP-P-103',8):15}
recs=[]
for (tag,src,tech,par,unit,al,dg,dr,vals,day,insp) in TR:
    for i,v in enumerate(vals):
        if v is None: continue
        f=FX.get((tag,par,i)); dd=DAYFIX.get((tag,i),day)
        if f: recs.append((mdate(i,dd),TAG2NO[tag],src,tech,par,v,unit,al,dg,dr,'',f[0],f[1],f[2],f[3],insp,f[4],f[5]))
        else: recs.append((mdate(i,dd),TAG2NO[tag],src,tech,par,v,unit,al,dg,dr,'','','','','No action',insp,'',''))
X=[
 ('2026-09-16','AP-P-103','Vibration & visual route','Visual','Holding-down bolts','Alert','Two holding-down bolts loose on pump base','Retorque bolts; check soft foot','','Raised','RCM Specialist','',''),
 ('2026-09-24','SS-TX-01','Substation inspection','Visual','Silica gel breather','Alert','More than two-thirds of silica gel discoloured','Replace silica gel','','Raised','Electrician','',''),
 ('2026-09-01','AP-WHB-01','Statutory inspection','Statutory','Pressure vessel certificate','Alert','Certificate expires 22 Oct 2026; inspection not booked','Book statutory inspector; prepare hydro test','244930','Scheduled','RCM Specialist','',''),
 ('2026-09-15','HV-01','LV/HV inspection checklist','Fleet inspection','Undercarriage: track link wear','Alert','Track links approx. 70% worn','Plan undercarriage replacement; order parts','','Raised','Fleet mechanic','',''),
 ('2026-09-29','HV-02','LV/HV prestart checklist','Prestart','Service brake','Danger','Brake ineffective; machine tagged out','Repair brakes before operation; verify by mechanic','245402','WO raised','Operator','',''),
 ('2026-09-29','LV-01','LV/HV prestart checklist','Prestart','Reverse alarm','Alert','Reverse alarm not working','Replace reverse alarm','','Raised','Operator','',''),
 ('2026-08-11','LV-02','LV/HV prestart checklist','Prestart','Seatbelt','Danger','Driver seatbelt not latching; vehicle tagged out','Replace seatbelt buckle','244620','Closed','Operator','2026-08-12','Fleet Supervisor'),
 ('2026-01-10','AP-P-102','Vibration & visual route','Vibration','Alignment condition','Alert','Misalignment signature (2x) at coupling','Laser align pump and motor','242210','Closed','RCM Specialist','2026-01-30','Mechanical Supervisor'),
 ('2026-02-03','AP-BL-01','Oil analysis','Lubrication / oil','Oil contamination','Alert','Particle count ISO 21/19/16, above target','Change oil and filters','242530','Closed','RCM Specialist','2026-02-25','Mechanical Supervisor'),
 ('2026-03-20','AP-P-301','IR survey','Infrared','Motor DE bearing temperature','Alert','Motor DE bearing 25 °C above NDE','Replace motor bearing in planned window','242980','Closed','RCM Specialist','2026-04-10','Electrical Supervisor'),
 ('2026-04-05','CK-1080','Oil analysis','Lubrication / oil','Girth gear lubricant','Alert','Girth gear lubricant degraded, high iron','Clean gear and reapply lubricant','243305','Closed','RCM Specialist','2026-05-20','Mechanical Supervisor'),
 ('2026-05-12','AP-P-202','Ultrasonic report','Ultrasonics (airborne)','NDE bearing lubrication','Alert','NDE bearing under-lubricated (ultrasound +8 dB)','Regrease by ultrasound','243620','Closed','RCM Specialist','2026-06-02','Mechanical Supervisor'),
 ('2026-07-15','AP-AG-01','Oil analysis','Lubrication / oil','Particle count','Alert','High particle count in gearbox oil','Flush oil and replace breather','244150','Closed','RCM Specialist','2026-08-30','Mechanical Supervisor'),
 ('2026-08-03','AP-SF-01','Vibration & visual route','Structural','Burner platform support','Alert','Crack at support bracket weld','Repair weld; MPI after repair','244380','Closed','RCM Specialist','2026-08-28','Mechanical Supervisor'),
 ('2026-08-18','AP-P-102','Oil analysis','Lubrication / oil','Oil oxidation','Alert','Oxidation above limit','Change oil','244690','Closed','RCM Specialist','2026-09-10','Mechanical Supervisor'),
 ('2026-08-20','AP-CV-01','Vibration & visual route','Tank & vessel','Manway gasket','Alert','Manway gasket weeping','Replace gasket at opportunity','244720','Closed','RCM Specialist','2026-09-25','Mechanical Supervisor'),
 ('2026-09-01','AP-P-301','Vibration & visual route','Vibration','Coupling condition','Alert','Coupling element wear indicated','Replace coupling element','244950','Closed','RCM Specialist','2026-09-14','Mechanical Supervisor'),
]
for (dte,tag,src,tech,par,st,fi,rc_,wo,stg,insp,cl,vb) in X:
    recs.append((dte,TAG2NO[tag],src,tech,par,'','','','','',st,fi,rc_,wo,stg,insp,cl,vb))
recs.append(('2026-09-24',TAG2NO['SS-MCC-01'],'Substation inspection','Electrical','Feeder F-12 insulation resistance',12,'MΩ',100,10,LO,'','Insulation resistance low on F-12','Dry out and retest cable; PI test','','Raised','Electrician','',''))
recs.sort(key=lambda r:r[0])

NR=len(recs)
for i,x in enumerate(recs):
    r=5+i
    RC.cell(r,2,d(x[0])); RC.cell(r,3,x[1]); RC.cell(r,8,x[2]); RC.cell(r,9,x[3]); RC.cell(r,10,x[4])
    for col,v in zip([11,12,13,14,15,16],x[5:11]):
        if v!='': RC.cell(r,col,v)
    RC.cell(r,19,x[11]); RC.cell(r,20,x[12] or None); RC.cell(r,24,x[13] or None); RC.cell(r,25,x[14]); RC.cell(r,26,x[15])
    if x[16]: RC.cell(r,27,d(x[16]))
    if x[17]: RC.cell(r,28,x[17])
    if len(x)>18 and x[18]: RC.cell(r,31,x[18])
    for _k,_v in enumerate(x[19:24]):
        if _v not in (None,''): RC.cell(r,32+_k,_v)
REG=f'Asset_Register!$A$5:$A${RN}'
def lk(col,r): return f'=IF($C{r}="","",IFERROR(INDEX(Asset_Register!${col}$5:${col}${RN},MATCH($C{r},{REG},0)),"Not in register"))'
for r in range(5,RR+1):
    RC.cell(r,1,f'=IF($C{r}="","","R"&TEXT(ROW()-4,"00000"))')
    RC.cell(r,4,lk('C',r)); RC.cell(r,5,lk('D',r)); RC.cell(r,6,lk('R',r)); RC.cell(r,7,lk('Q',r))
    RC.cell(r,17,f'=IF($C{r}="","",IF($P{r}<>"",$P{r},IF(AND(ISNUMBER($K{r}),ISNUMBER($M{r}),ISNUMBER($N{r})),IF($O{r}="Lower is worse",IF($K{r}<=$N{r},"Danger",IF($K{r}<=$M{r},"Alert","OK")),IF($K{r}>=$N{r},"Danger",IF($K{r}>=$M{r},"Alert","OK"))),"Not set")))')
    RC.cell(r,18,f'=IF(OR($Q{r}="",$Q{r}="Not set"),"",MATCH($Q{r},Lists!$F$2:$F$4,0)-1)')
    RC.cell(r,21,f'=IF(OR($Q{r}="",$Q{r}="OK",$Q{r}="Not set",NOT(ISNUMBER($G{r}))),"",ROUND($G{r}*IF($Q{r}="Danger",Lists!$M$15,Lists!$M$16),0))')
    RC.cell(r,22,f'=IF($U{r}="","",IF(OR($Q{r}="Danger",$U{r}>=Lists!$M$10),"P1",IF($U{r}>=Lists!$M$11,"P2","P3")))')
    RC.cell(r,23,f'=IF(OR($V{r}="",$B{r}=""),"",$B{r}+INDEX(Lists!$N$10:$N$12,MATCH($V{r},Lists!$L$10:$L$12,0)))')
    RC.cell(r,29,f'=IF(OR($U{r}="",$B{r}=""),"",IF($AA{r}<>"",$AA{r}-$B{r},TODAY()-$B{r}))')
    RC.cell(r,30,f'=IF($W{r}="","",IF($Y{r}="Closed",IF($AA{r}="","Closed",IF($AA{r}<=$W{r},"Closed on time","Closed late")),IF(TODAY()>$W{r},"Overdue","Within time")))')
    for j in range(1,len(rec_cols)+1):
        c=RC.cell(r,j); c.border=B
        if rec_cols[j-1][2]=='f': c.fill=fill(FFILL); c.font=font()
        else: c.font=SAMPLE if r<5+NR else font()
        if j in (19,20,31,10): c.alignment=Alignment(wrap_text=True,vertical='top')
    for j in (2,23,27): RC.cell(r,j).number_format='dd-mmm-yy'
RC.freeze_panes='D5'
RC.auto_filter.ref=f'A4:{L(len(rec_cols))}{RR}'
dv(RC,'DATE(2000,1,1)',f'B5:B{RR}',typ='date',operator='greaterThan',prompt='Date of inspection or reading')
dv(RC,f'={REG}',f'C5:C{RR}',prompt='Pick the Pronto asset no. from the register')
dv(RC,rng('C'),f'H5:H{RR}'); dv(RC,rng('D'),f'I5:I{RR}'); dv(RC,rng('G'),f'O5:O{RR}')
dv(RC,rng('F'),f'P5:P{RR}',prompt='Required for checklists, visual and statutory. For measured values leave blank (status is calculated) or set to override.')
dv(RC,rng('E'),f'Y5:Y{RR}')
for col in ['Q','P']:
    RC.conditional_formatting.add(f'{col}5:{col}{RR}',CellIsRule(operator='equal',formula=['"Danger"'],fill=DGF,font=font(bold=True,color='9C1C10')))
    RC.conditional_formatting.add(f'{col}5:{col}{RR}',CellIsRule(operator='equal',formula=['"Alert"'],fill=ALF,font=font(bold=True,color='7A5300')))
    RC.conditional_formatting.add(f'{col}5:{col}{RR}',CellIsRule(operator='equal',formula=['"OK"'],fill=OKF,font=font(color='1F6B40')))
RC.conditional_formatting.add(f'Q5:Q{RR}',CellIsRule(operator='equal',formula=['"Not set"'],font=font(italic=True,color='9C1C10')))
RC.conditional_formatting.add(f'V5:V{RR}',CellIsRule(operator='equal',formula=['"P1"'],fill=fill('BE3528'),font=font(bold=True,color='FFFFFF')))
RC.conditional_formatting.add(f'AD5:AD{RR}',CellIsRule(operator='equal',formula=['"Overdue"'],font=font(bold=True,color='BE3528')))
RC.conditional_formatting.add(f'AD5:AD{RR}',CellIsRule(operator='equal',formula=['"Closed late"'],font=font(color='B57C00')))
RC.conditional_formatting.add(f'D5:D{RR}',CellIsRule(operator='equal',formula=['"Not in register"'],fill=DGF))
RC.conditional_formatting.add(f'Y5:Y{RR}',FormulaRule(formula=[f'AND(OR($Q5="Alert",$Q5="Danger"),$Y5="")'],fill=ALF))
RC['P4'].comment=Comment('Checklists / visual / statutory: choose OK, Alert or Danger using the severity rules in the Guide. Measured values: leave blank and status is calculated from the limits; fill only to override (analyst judgement).','AHIM')
RC['Y4'].comment=Comment('OK records: No action. Alert/Danger: Raised -> WO raised -> Scheduled -> Awaiting verification -> Closed. Close only after a re-check confirms the fix.','AHIM')

# ---------------- GUIDE ----------------
G.sheet_view.showGridLines=False
G.column_dimensions['A'].width=2
for c,w in zip('BCDEFG',[26,26,24,26,18,30]): G.column_dimensions[c].width=w
row=[1]
def put(txt,**k):
    c=G.cell(row[0],2,txt); c.font=font(**k); c.alignment=Alignment(wrap_text=False); row[0]+=1; return c
def para(txt):
    G.merge_cells(start_row=row[0],start_column=2,end_row=row[0],end_column=7)
    c=G.cell(row[0],2,txt); c.font=font(); c.alignment=Alignment(wrap_text=True,vertical='top')
    G.row_dimensions[row[0]].height=15*max(1,len(txt)//120+1); row[0]+=1
def table(hdr,rows):
    for j,h in enumerate(hdr):
        c=G.cell(row[0],2+j,h); c.font=font(bold=True,color='FFFFFF'); c.fill=fill(NAVY); c.alignment=Alignment(wrap_text=True,vertical='center'); c.border=B
    row[0]+=1
    for rw in rows:
        mx=1
        for j,v in enumerate(rw):
            c=G.cell(row[0],2+j,v); c.font=font(); c.alignment=Alignment(wrap_text=True,vertical='top'); c.border=B
            w=G.column_dimensions['BCDEFG'[j]].width; mx=max(mx,len(str(v))//int(w*1.1)+1)
        G.row_dimensions[row[0]].height=13.5*mx+2; row[0]+=1
    row[0]+=1
put('AHIM: Master Asset Register & Common Record',bold=True,size=16,color=NAVY)
put('Asset Health & Integrity Management · Lotus Africa Uranium Plant',size=10,color=GREY); row[0]+=1
put('Purpose',bold=True,size=12,color=NAVY)
para('Every inspection input (vibration and visual routes, IR, substation, statutory, ultrasonic, oil analysis, diesel generator checklists, light vehicle and heavy equipment inspections and prestarts) is entered in ONE format against ONE asset list. The register and records then feed the AHIM dashboard: plant health, criticality, top priorities, open records and machine history.')
row[0]+=1
put('How it works',bold=True,size=12,color=NAVY)
table(['Step','What to do','Who'],[
 ['1. Register the asset','Add it to Asset_Register with its Pronto asset no., area, class, criticality factors and applicable techniques. ACI and class calculate automatically.','RCM Specialist (once per asset)'],
 ['2. Enter the result','Each reading, checklist defect or certificate check becomes one row in Records. Pick the asset from the dropdown; description, area and ACI fill in.','Input owner (analyst, electrician, DG operator, fleet mechanic, contractor)'],
 ['3. Status is set','Measured values: from the Alert/Danger limits. Checklists, visual, statutory: Inspector status using the severity rules below.','Automatic / inspector'],
 ['4. Priority and due date','Alert and Danger rows get a priority score (ACI x severity), P1/P2/P3 and a due date automatically. Any Danger is always P1, whatever the asset criticality.','Automatic'],
 ['5. Action and close','Raise the Pronto WO, enter the WO no., move the stage forward. Close only after a re-check confirms the fix, and record who verified it.','RCM Specialist / planner'],
 ['6. Review','The asset\'s Current status in the register always shows the worst open record. Use filters on Records for overdue items.','RCM Specialist (weekly)'],
])
put('Colour legend',bold=True,size=12,color=NAVY)
table(['Item','Meaning'],[['Dark blue header','Enter data in this column'],['Grey header, grey cells','Automatic formula: do not type over'],['Blue italic text','Sample data: replace or delete before go-live'],['Blue on cream (Lists sheet)','Settings: weights, thresholds, response times'],['Red key cell (register)','Duplicate Pronto asset no.'],['Amber Record stage','Alert/Danger row with no stage yet']])
put('How each input source maps into the record',bold=True,size=12,color=NAVY)
table(['Source (input)','Technique(s)','Record type','How status is set','Typical frequency','Owner'],[
 ['Vibration & visual route','Vibration, Visual','Measured + checklist','Limits (ISO 20816-3: 4.5 / 7.1 mm/s); visual by severity rules','Monthly route','RCM Specialist'],
 ['IR survey','Infrared','Measured','dT limits (NETA: >4 °C Alert, >15 °C Danger) or absolute temperature limits','Monthly','RCM Specialist'],
 ['Substation inspection','Infrared, Visual, Electrical','Measured + checklist','Limits for readings; severity rules for checklist items','Monthly','Electrical'],
 ['Statutory inspection','Statutory','Compliance','Inspector status; register also flags expiry (60 days = Alert, expired = Danger)','Per certificate','RCM Specialist / contractor'],
 ['Ultrasonic report','Ultrasonic thickness, Ultrasonics (airborne)','Measured','Thickness: Lower is worse vs minimum wall. Airborne: dB limits','Quarterly / annual','UT contractor / RCM'],
 ['Oil analysis','Lubrication / oil','Measured','Lab alarm limits per parameter (water, iron, silicon, viscosity...)','Monthly / per service','RCM Specialist'],
 ['DG checklist','DG checks','Measured','Enter only the condition parameters (exhaust and turbo temperatures, oil pressure, coolant temperature, crankcase pressure) with limits','Daily; enter weekly summary or any exceedance','DG operator'],
 ['LV/HV inspection checklist','Fleet inspection','Checklist','Severity rules per component','Per service / monthly','Fleet mechanic'],
 ['LV/HV prestart checklist','Prestart','Exceptions only','Enter only defects found (severity rules); completion rate tracked separately','Every shift','Operator / supervisor'],
])
put('Severity rules for checklists, visual and prestart items',bold=True,size=12,color=NAVY)
table(['Status','Definition','Required response','Examples'],[
 ['OK','Item within standard','None (record only if part of a route)','Guards fitted, no leaks'],
 ['Alert','Defect, but safe to operate','Repair within P2/P3 response time','Minor oil leak, silica gel discoloured, worn seat, reverse alarm faulty'],
 ['Danger','Unsafe or failure imminent','Stop / isolate / tag out; repair before use (P1)','Brakes or steering ineffective, seatbelt or fire suppression faulty, major leak, exposed live parts'],
])
put('Asset numbering convention (site tag)',bold=True,size=12,color=NAVY)
table(['Prefix','Area','Example'],[['AP-','Acid plant','AP-P-101 (pump), AP-TK-01 (tank)'],['CK-','Calciner','CK-1080'],['SS-','Substation','SS-TX-01, SS-MCC-01'],['PP-','Power plant','PP-GEN-04'],['LV- / HV-','Mobile fleet','LV-01 light vehicle, HV-02 compactor']])
para('The Pronto asset no. remains the unique key; the site tag is the name people use in the field. Sample Pronto numbers (1001xx...) are placeholders.')
row[0]+=1
put('Repeat readings rule',bold=True,size=12,color=NAVY)
para('Each new reading is a new row. If a reading repeats an issue already raised in an earlier row, set its Record stage to "No action": it updates the trend and the asset status, but does not create a second open recommendation. An asset returns to OK when its recommendation is Closed and the latest reading is within limits.')
row[0]+=1
put('Dashboard sheets',bold=True,size=12,color=NAVY)
table(['Sheet','Feeds'],[['Events','Machine history, MTBF/MTTR, availability, bad actors (Pronto WO export)'],['Schedule','Inspection schedule compliance'],['CM_Value / Programme_Cost','CM return on investment'],['Decisions','Management decisions required'],['Prestart','Fleet prestart compliance']])
put('Settings (Lists sheet)',bold=True,size=12,color=NAVY)
para('ACI weights, criticality class limits, priority bands and response times (P1 7 days, P2 30, P3 60), severity factors (Danger 1.0, Alert 0.6) and the statutory alert window (60 days) are editable on the Lists sheet. Get them approved by the Engineering Manager before go-live so the numbers are not disputed.')

# ---------------- KPI TARGETS (Lists) ----------------
ptab(34,['KPI target','Value'],[['Asset Health Index',85],['Inspection schedule compliance %',95],['Recommendations closed on time %',85],['Overdue recommendations (max)',2],['CM return on investment (x : 1)',4],['Critical asset CM coverage %',90],['Prestart compliance %',95]],'Targets shown on the Management page. Approve with the Engineering Manager.')

ptab(44,['Inspection interval','Days'],[['A',30],['B',60],['C',90]],'Maximum days between inspections by criticality class. Older = Unknown.')
# ---------------- EXTRA SHEETS ----------------
def simple_sheet(name,title,sub,cols,rows,datecols=(),money=(),tab='9CB6C6'):
    ws=wb.create_sheet(name)
    header(ws,[(c,w,'in') for c,w in cols],title,sub)
    for i,row in enumerate(rows):
        for j,v in enumerate(row,1):
            if v=='' or v is None: continue
            c=ws.cell(5+i,j,dt.datetime.strptime(v,'%Y-%m-%d') if (j in datecols and isinstance(v,str)) else v)
            c.font=SAMPLE; c.border=B
            if j in datecols: c.number_format='dd-mmm-yy' if 'Month' not in cols[j-1][0] else 'mmm-yy'
            if j in money: c.number_format='$#,##0'
    ws.freeze_panes='A5'; ws.sheet_properties.tabColor=tab
    return ws
ev=[
 ('2025-11-14','AP-BL-01','PM','Annual service: coupling, filters, inlet guide vanes',0,'241050',''),
 ('2025-11-30','AP-P-301','Failure','Steam jacket leak, pump stopped',5,'241210',''),
 ('2025-12-01','AP-P-301','Repair','Jacket gasket replaced',0,'241210',''),
 ('2025-12-05','PP-GEN-04','Failure','Fuel injector failure, unit offline',10,'241260','RCA-2025-07'),
 ('2025-12-06','PP-GEN-04','Repair','Injector replaced, load test passed',0,'241260',''),
 ('2025-12-10','AP-P-101','Failure','Mechanical seal leak',8,'241300',''),
 ('2025-12-10','AP-P-101','Repair','Seal replaced',0,'241300',''),
 ('2025-12-15','CK-1080','Failure','Girth gear lubrication spray failure',18,'241350',''),
 ('2025-12-16','CK-1080','Repair','Spray nozzles replaced',0,'241350',''),
 ('2026-01-08','AP-CT-01','Failure','Fan blade pitch slipped, high vibration trip',4,'242100',''),
 ('2026-01-08','AP-CT-01','Repair','Blades re-pitched and balanced',0,'242100',''),
 ('2026-01-12','AP-P-103','Failure','Impeller wear, low discharge pressure',10,'242150',''),
 ('2026-01-13','AP-P-103','Repair','Impeller replaced',0,'242150',''),
 ('2026-01-20','AP-BL-01','Failure','Inlet guide vane actuator seized, blower tripped',6,'242300',''),
 ('2026-01-20','AP-BL-01','Repair','Actuator replaced and calibrated',0,'242300',''),
 ('2026-02-10','HV-01','Failure','Hydraulic hose burst',6,'242400',''),
 ('2026-02-14','AP-WHB-01','Failure','Economiser tube leak, plant stopped',36,'242450','RCA-2026-02'),
 ('2026-02-16','AP-WHB-01','Repair','Two tubes plugged, hydro test passed',0,'242450',''),
 ('2026-02-14','AP-CV-01','PM','Catalyst screening bed 1 during shutdown',0,'242460',''),
 ('2026-02-20','SS-MCC-01','Failure','Feeder F-07 contactor burned, trip',3,'242600',''),
 ('2026-02-20','SS-MCC-01','Repair','Contactor replaced',0,'242600',''),
 ('2026-03-11','PP-GEN-01','Failure','Turbocharger oil feed line leak, unit stopped',20,'242800','RCA-2026-03'),
 ('2026-03-12','PP-GEN-01','Repair','Oil feed line and clamps replaced',0,'242800',''),
 ('2026-04-20','CK-1080','PM','Tyre and roller alignment check',0,'243200',''),
 ('2026-04-22','AP-P-101','Failure','DE bearing failure',14,'243250','RCA-2026-04'),
 ('2026-04-23','AP-P-101','Repair','Bearings replaced; alignment 0.08 mm',0,'243250',''),
 ('2026-05-14','SS-TX-01','PM','Annual electrical maintenance',0,'243500',''),
 ('2026-06-18','PP-GEN-04','Failure','Coolant hose burst, high temperature trip',8,'243900',''),
 ('2026-06-18','PP-GEN-04','Repair','Coolant hoses replaced',0,'243900',''),
 ('2026-07-05','AP-PL-01','Failure','Pinhole leak at elbow E-04, line isolated',12,'244200',''),
 ('2026-07-06','AP-PL-01','Repair','Elbow E-04 replaced',0,'244200',''),
 ('2026-07-22','HV-02','Failure','Alternator failure',5,'244300',''),
]
simple_sheet('Events','AHIM Event History (from Pronto)','One row per failure, repair, PM or shutdown from Pronto work orders. Downtime only on Failure rows. Used for MTBF, MTTR, availability and bad actors.',
 [('Date',11),('Pronto asset no.',14),('Event type',11),('Description',44),('Downtime (h)',10),('Pronto WO no.',12),('RCA reference',13)],
 [(d,TAG2NO[t],ty,ds,dn,wo,rc) for d,t,ty,ds,dn,wo,rc in ev],datecols=(1,))
sch=[]
base={'Vibration':42,'Lubrication / oil':34,'Ultrasonics (airborne)':18,'Ultrasonic thickness':6,'Infrared':24,'Visual':40,'Statutory':1,'Tank & vessel':1,'Piping':2,'Structural':5,'Electrical':20,'DG checks':120,'Fleet inspection':10}
miss=[0,1,0,2,1,0,1,3,1,0,2,1]
for i,(y,m) in enumerate(MON):
    for k,(t,p) in enumerate(base.items()):
        if t=='Ultrasonic thickness' and m not in (1,4,7,8,9,10): continue
        if t=='Statutory' and m not in (3,9,10): continue
        d=(miss[(i+k)%12] if p>5 else (1 if (i+k)%7==0 else 0))
        if (y,m)==(2026,9): d={'Vibration':2,'Ultrasonics (airborne)':3,'Statutory':1,'Structural':2,'Electrical':2,'Piping':0,'DG checks':4,'Fleet inspection':1}.get(t,0)
        sch.append((f'{y}-{m:02d}-01',t,p,p-d))
simple_sheet('Schedule','AHIM Inspection Schedule Compliance','One row per month and technique: inspections planned vs completed (from the CM schedule / Pronto PM routes).',
 [('Month',10),('Technique',22),('Planned',9),('Completed',10)],sch,datecols=(1,))
val=[
 ('2025-11-20','AP-P-202','Vibration','Bearing defect found early; replaced in planned window',22000,2500,'Engineering Manager'),
 ('2026-01-30','AP-P-102','Vibration','Misalignment corrected before seal and bearing damage',18000,2500,'Engineering Manager'),
 ('2026-02-25','AP-BL-01','Lubrication / oil','Contaminated oil changed; blower bearing saved',65000,3000,'Engineering Manager'),
 ('2026-04-10','AP-P-301','Infrared','Overheating motor bearing replaced in planned window',12000,1800,'Engineering Manager'),
 ('2026-05-29','SS-MCC-01','Infrared','Loose termination fixed before arc flash and MCC loss',120000,800,'Engineering Manager'),
 ('2026-06-02','AP-P-202','Ultrasonics (airborne)','Under-lubrication corrected',9000,300,'Engineering Manager'),
 ('2026-06-20','AP-AR-01','Ultrasonics (airborne)','Compressed air leak repaired',6000,400,'Engineering Manager'),
 ('2026-08-28','AP-SF-01','Structural','Cracked structural support repaired',40000,5000,'Engineering Manager'),
 ('2026-09-14','AP-P-301','Vibration','Worn coupling replaced before failure',15000,1200,'Engineering Manager'),
]
simple_sheet('CM_Value','AHIM Condition Monitoring Value (cost avoidance)','Net avoided = avoided failure cost (repair + collateral damage + lost production) minus planned repair cost. Count only when approved.',
 [('Date',11),('Pronto asset no.',14),('Technique',20),('Detection / failure avoided',46),('Avoided failure cost (USD)',14),('Planned repair cost (USD)',14),('Approved by',18)],
 [(d,TAG2NO[t],te,ds,a_,p_,ap) for d,t,te,ds,a_,p_,ap in val],datecols=(1,),money=(5,6))
cost=[]
ctr=[1500,800,0,2400,600,1200,0,3000,900,1800,500,2100]
for i,(y,m) in enumerate(MON): cost.append((f'{y}-{m:02d}-01',4200,1150,ctr[i],300))
simple_sheet('Programme_Cost','AHIM CM Programme Cost','Monthly cost of the condition monitoring and inspection programme (USD).',
 [('Month',10),('Labour',11),('Lab & consumables',14),('Contractors',12),('Equipment',11)],cost,datecols=(1,),money=(2,3,4,5))
dec=[
 ('2026-09-25','Approve a 36-hour planned stop in October','Sulphur furnace refractory (340 °C hot spot) and acid line elbow E-07 (below minimum wall) cannot be repaired online. Both are P1.','Engineering and Production Managers','Open'),
 ('2026-09-02','Book the statutory inspector for the waste heat boiler','Certificate expires 22 Oct 2026. The boiler cannot legally operate after that date.','Engineering Manager','Open'),
 ('2026-08-15','Fund a fitness-for-service assessment on TK-01','Product acid tank shell at 72% of nominal; recommendation open since April with no work order.','Engineering Manager','Open'),
 ('2026-06-01','Order a spare gearbox for cooling tower fan 1','Gear damage confirmed by vibration and oil analysis; open since May.','Maintenance and Supply','Open'),
 ('2026-05-02','Approve ultrasound grease guns for lubrication route','Over- and under-greasing found on several bearings.','Engineering Manager','Approved'),
]
simple_sheet('Decisions','AHIM Management Decisions','Decisions only management can make (stops, budget, statutory bookings). Status: Open, Approved, Rejected or Closed.',
 [('Date raised',11),('Decision required',42),('Reason',60),('Owner',26),('Status',10)],dec,datecols=(1,))
ps=[]
fleet=['LV-01','LV-02','HV-01','HV-02','HV-03']
for i,(y,m) in enumerate(MON):
    for k,t in enumerate(fleet):
        sh=56 if t.startswith('LV') else 44
        sh-= (i*3+k)%5
        dn=sh-((i+2*k)%4) - (2 if (t=='HV-02' and i>=9) else 0)
        ps.append((f'{y}-{m:02d}-01',TAG2NO[t],sh,dn))
simple_sheet('Prestart','AHIM Prestart Compliance','Per month and vehicle/machine: shifts operated vs prestart checklists completed. Defects found go to Records.',
 [('Month',10),('Pronto asset no.',14),('Shifts operated',12),('Prestarts completed',14)],ps,datecols=(1,))

simple_sheet('Commentary','AHIM Monthly Analyst Commentary','One row per month: three short lines for management. Shown at the top of the Management page.',[('Month',10),('What changed',55),('Why',55),('What we are doing',55),('Author',22)],[('2026-09-01','AHI fell 6 points to 74. Four new Danger findings: drying tower pump bearing, MCC termination, acid line elbow below minimum wall, compactor brakes.','Late detection on two bad actors (P-101 repeat bearing failure; E-07 accelerated corrosion) and a backlog of 10 overdue recommendations.','36-hour stop requested for October to repair furnace refractory and E-07. Weekly CM / planner review started to clear the backlog.','RCM Specialist')],datecols=(1,),tab='2E8A57')
for _c in 'BCD':
    for _r in range(5,40): wb['Commentary'][f'{_c}{_r}'].alignment=Alignment(wrap_text=True,vertical='top')
AS.add_register_validation(AR, 41, RN)
AS.add_record_validation(RC, 32, RR)
AS.write_reference(wb, OUT if 'OUT' in globals() else None)
for ws in (AR,RC): ws.sheet_properties.tabColor=NAVY
G.sheet_properties.tabColor='2E8A57'; LS.sheet_properties.tabColor='9CB6C6'
import sys, os
out=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','data','AHIM_Data.xlsx')
wb.save(out)
print('ok',NA,NR)
