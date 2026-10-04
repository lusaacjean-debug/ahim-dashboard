import re
"""AHIM reference library: risk matrix, ISO 14224 codes, API 571 damage mechanisms, equipment strategy library
and standards map. Written into the workbook as editable sheets (user edits are kept on re-import).
Intervals are STARTING POINTS: refine with P-F interval, failure history and OEM data (ISO 17359 cl. 5)."""

# ---------------- Risk matrix (ISO 31000 approach, aligned to a mining 5x5 matrix) ----------------
RISK_CONSEQUENCE = [  # level, name, safety, health & radiation, environment, production, financial, regulatory & legal, community & reputation
 (1, 'Insignificant',
  'First aid case',
  'No measurable dose or contamination above normal operating levels; chemical exposure below OEL',
  'Release contained within bund or process area; cleaned up within the shift; no environmental impact',
  'Under 1 h of circuit downtime, or a standby unit lost with no throughput loss',
  'Under USD 10k (repair and lost production)',
  'Internal non-conformance only; no external reporting',
  'No external interest'),
 (2, 'Minor',
  'Medical treatment or restricted work case',
  'Event dose under 1 mSv; skin or PPE contamination removed on site; uranium bioassay below investigation level; brief exposure to acid mist, SO2 or H2O2 with no treatment',
  'Small release outside bund, on site only, cleaned up within 24 h; no breach of discharge or emission limits',
  '1 to 8 h circuit outage, or under 5% of daily U3O8 production lost',
  'USD 10k to 100k',
  'Minor non-compliance with a licence or permit condition, closed out in routine reporting',
  'Local concern handled through normal community engagement'),
 (3, 'Moderate',
  'Lost-time injury, fully reversible',
  'Event dose 1 to 5 mSv or above the site investigation level; internal contamination (bioassay above investigation level); exposure above OEL to acid, SO2/SO3 or H2O2 needing medical assessment',
  'Reportable on-site release of acid, uranium-bearing solution or slurry; short exceedance of an emission or discharge limit; remediation within 1 month',
  '8 to 24 h circuit stop, or 5 to 25% of daily production lost; acid plant trip limiting leach acid supply',
  'USD 100k to 500k',
  'Notifiable incident to the radiation or environmental regulator; inspection or improvement notice likely',
  'Formal community complaint or local media coverage'),
 (4, 'Major',
  'Permanent disability, or several lost-time injuries in one event',
  'Occupational dose limit exceeded (ICRP 103: 20 mSv/y averaged over 5 years, or 50 mSv in one year) or public dose above 1 mSv/y; uranium intake requiring clinical follow-up; occupational illness',
  'Off-site release of acid, uranium-bearing solution, slurry or tailings water to surface or groundwater; off-site SO2 impact; remediation over months',
  '1 to 7 days plant stop, or over 25% of weekly production lost',
  'USD 0.5M to 2.5M',
  'Breach of licence or permit conditions; regulatory directive or fine; loss of control of uranium concentrate requiring nuclear security or safeguards reporting',
  'National media coverage, community protest, or offtaker or investor concern'),
 (5, 'Catastrophic',
  'One or more fatalities',
  'Severe overexposure with deterministic effects, several workers over the dose limit, or public exposure needing protective action; fatality or chronic disease from exposure',
  'Major off-site release (tailings storage, leach circuit or acid storage failure) with long-term contamination of water resources or ecosystems; remediation over years',
  'Over 7 days plant stop, or a month of production target lost',
  'Over USD 2.5M',
  'Licence suspension or revocation, prosecution, or shutdown ordered by a regulator; theft or diversion of uranium concentrate',
  'International coverage; sustained loss of social licence to operate'),
]
RISK_LIKELIHOOD = [  # level, name, description, frequency guide, AHIM mapping
 (1, 'Rare', 'Not expected in the life of the asset', 'Less than once in 20 years', 'Condition OK and inspected within its required interval'),
 (2, 'Unlikely', 'Could occur at some time', 'Once in 5 to 20 years', 'Condition Unknown: not inspected within its required interval'),
 (3, 'Possible', 'Deterioration confirmed; failure could occur', 'Once in 1 to 5 years', 'Open Alert finding, or latest reading in the alert band'),
 (4, 'Likely', 'Failure expected within weeks to months', 'About once a year or more', 'Open Danger finding, latest reading in the danger band, or remaining life 1 year or less'),
 (5, 'Almost certain', 'Failure in progress or imminent', 'Several times a year, or happening now', 'Active loss of containment, through-wall defect, trip or failure in progress'),
]
RISK_RATING = [  # name, min score, response, authority to accept the risk
 ('Extreme', 20, 'Act within 7 days; inform senior management; stop or restrict operation unless controls make it safe', 'General Manager'),
 ('High', 12, 'Act within 30 days; interim controls in place and verified; Engineering Manager informed', 'Engineering Manager'),
 ('Medium', 5, 'Plan within 90 days through normal planning and scheduling', 'Area Superintendent'),
 ('Low', 1, 'Manage by routine maintenance and monitoring', 'Supervisor'),
]

# Consequence floor by service for equipment that holds or moves the fluid (loss of containment):
# the inherent hazard of what is inside sets a minimum consequence, whatever the production criticality.
CONTAINMENT_CLASSES = {'Centrifugal slurry pump', 'Centrifugal process pump', 'Positive displacement pump', 'Atmospheric storage tank',
  'Process vessel (atmospheric, lined)', 'Pressure vessel / boiler', 'Piping (acid / slurry / process)', 'Heat exchanger / condenser',
  'Sump / bund (concrete)', 'Thickener drive', 'Drying / absorption tower, acid cooler and acid piping'}
SERVICE_FLOOR = {  # service: (floor, reason)
 'Uranium product (yellowcake)': (4, 'uranium concentrate: inhalation dose, emissions and nuclear security'),
 'Sulphuric acid': (4, 'sulphuric acid: severe burns and off-site release'),
 'Hydrogen peroxide': (4, 'hydrogen peroxide: oxidiser, decomposition and overpressure'),
 'Uranium precipitate': (3, 'uranium-bearing precipitate: contamination and dose'),
 'Eluate / uranium solution': (3, 'uranium-bearing solution: contamination and environmental release'),
 'Slurry (acid leach)': (3, 'acidic uranium-bearing slurry: environmental release'),
 'Caustic soda': (3, 'caustic: severe burns'),
 'Gypsum slurry': (2, 'gypsum slurry spill'), 'Slurry': (2, 'slurry spill'), 'Reagent': (2, 'reagent spill'), 'Water': (1, 'water'),
}
def consequence_floor(service, strategy):
    fl, why = SERVICE_FLOOR.get(service or '', (1, ''))
    if service == 'Uranium product (yellowcake)': return fl, why          # every asset handling dry product
    return (fl, why) if strategy in CONTAINMENT_CLASSES else (1, '')

# ---------------- ISO 14224 (Annex B) failure modes and failure mechanisms ----------------
ISO_FAILURE_MODES = [
 ('AIR','Abnormal instrument reading'),('BRD','Breakdown'),('ELP','External leakage - process medium'),('ELU','External leakage - utility medium'),
 ('ERO','Erratic output'),('FTS','Fail to start on demand'),('HIO','High output'),('INL','Internal leakage'),('LOO','Low output'),('NOI','Noise'),
 ('OHE','Overheating'),('PDE','Parameter deviation'),('PLU','Plugged / choked'),('SER','Minor in-service problems'),('STD','Structural deficiency'),
 ('UST','Spurious stop'),('VIB','Vibration'),('OTH','Other'),('UNK','Unknown')]
ISO_MECHANISMS = [
 ('1.0','Mechanical failure - general'),('1.1','Leakage'),('1.2','Vibration'),('1.3','Clearance / alignment failure'),('1.4','Deformation'),('1.5','Looseness'),('1.6','Sticking'),
 ('2.0','Material failure - general'),('2.1','Cavitation'),('2.2','Corrosion'),('2.3','Erosion'),('2.4','Wear'),('2.5','Breakage'),('2.6','Fatigue'),('2.7','Overheating'),('2.8','Burst'),
 ('3.0','Instrument failure - general'),('4.0','Electrical failure - general'),('4.1','Short circuiting'),('4.2','Open circuit'),('4.3','No power / voltage'),('4.4','Faulty power / voltage'),('4.5','Earth / isolation fault'),
 ('5.0','External influence - general'),('5.1','Blockage / plugged'),('5.2','Contamination'),('5.3','Miscellaneous external influences'),('6.0','Miscellaneous'),('6.4','Unknown')]
# site failure mode text (CM workbook) -> (ISO 14224 failure mode, ISO mechanism)
SITE_FM_MAP = {
 'Gear wear or breakage':('NOI','2.4'),'Motor failure':('BRD','4.0'),'Bearing failure':('VIB','2.4'),'Shaft misalignment or bending':('VIB','1.3'),
 'VFD fault or failure':('UST','4.4'),'Looseness on structures':('VIB','1.5'),'Excessive vibration':('VIB','1.2'),'Belt slippage or wear':('LOO','2.4'),
 'Conveyor belt misalignment or tearing':('STD','1.3'),'Hydraulic system leaks or pressure loss':('ELU','1.1'),'Pump cavitation or seal failure':('ELP','2.1'),
 'Valve leakage or malfunction':('INL','1.1'),'Grounding issues':('SER','4.5'),'Overloading of equipment':('OHE','2.7'),'Agitator shaft failure':('BRD','2.5'),
 'Fan imbalance or blade damage':('VIB','1.2'),'Screen blinding or damage':('PLU','5.1'),'Filter media blinding or damage':('PLU','5.1'),
 'Lubrication system failure':('OHE','2.7'),'Cracks in welds or joints':('STD','2.6'),'Other':('OTH','6.0')}

# ---------------- Damage mechanisms for static equipment (API 571 names + site mechanisms) ----------------
DAMAGE_MECHANISMS = [
 ('Sulfuric acid corrosion','API 571','Acid plant towers, coolers, acid tanks and piping; leach and reagent tanks. Velocity, temperature and concentration sensitive.'),
 ('Erosion / erosion-corrosion','API 571','Slurry tanks, launders, slurry piping and pump casings; leach and RIP circuits.'),
 ('Atmospheric corrosion','API 571','External surfaces; accelerated by acid vapour and water retention on roofs.'),
 ('Corrosion under insulation (CUI)','API 571','Insulated tanks and piping, especially cycling temperatures.'),
 ('Flue-gas dew-point corrosion','API 571','Acid plant gas ducts, economisers and converter outlets below acid dew point.'),
 ('Mechanical / vibration fatigue','API 571','Agitator bridges, screen side plates, small-bore connections.'),
 ('Refractory degradation','API 571 / API RP 936','Sulphur furnace, converter, kiln and calciner linings: detected by IR hot spots.'),
 ('Boiler water / condensate corrosion','API 571','Waste heat boiler and economiser water side.'),
 ('Localized (pitting) corrosion','Site','Coating defects, crevices, stagnant zones.'),
 ('Coating breakdown','Site / ISO 12944','External coating failure leading to atmospheric or acid-vapour corrosion.'),
 ('Lining failure','Site','Rubber or FRP lining holidays in acid and leach service.'),
 ('Gasket / bolting degradation','Site / ASME PCC-1','Flanges and manways: loss of preload, chemical attack of gaskets, missing bolts.'),
 ('Concrete acid attack','Site','Foundations, plinths and bunds exposed to acid spillage.'),
 ('Foundation settlement','Site / API 653 Annex B','Tank foundations: tilt, settlement, loss of anchorage.'),
 ('Weld cracking / weld defects','Site','Repaired welds, lack of fusion, fatigue cracks at shell-to-bottom.'),
 ('Wall thinning (general)','Site','Measured loss of thickness where the mechanism is not yet confirmed.')]

# ---------------- Equipment strategy library ----------------
# class, failure mode (ISO), mechanism / cause, AHIM technique, task, interval A, B, C (days), alert / danger criterion, reference, tracked in AHIM (Y/N)
S = []
def add(cls, fm, mech, tech, task, a, b, c, crit, ref, tracked='Y'): S.append((cls, fm, mech, tech, task, a, b, c, crit, ref, tracked))
P='Centrifugal slurry pump'
add(P,'VIB','Bearing wear, misalignment, looseness, unbalance','Vibration','Overall velocity and bearing envelope (gE) route, all bearings, 3 axes',30,60,90,'Velocity Alert 4.5 / Danger 7.1 mm/s RMS; gE 2x / 4x baseline','ISO 20816-3, ISO 13373-1')
add(P,'OHE','Bearing lubrication (over / under greasing)','Ultrasonics (airborne)','Ultrasound bearing condition and guided greasing',30,60,90,'+8 dB over baseline Alert, +16 dB Danger','ISO 29821')
add(P,'OHE','Bearing, coupling and motor overheating','Infrared','Thermography of motor, coupling and bearing housings',90,180,365,'Bearing dT > 20 C vs similar Alert, > 40 C Danger','ISO 18434-1')
add(P,'LOO','Wet-end wear (impeller, liner, throatbush)','Visual','CM sensitive inspection: duty point, gland, noise, casing wear',30,60,90,'Performance < 90% of baseline Alert','OEM, ISO 17359')
add(P,'ELP','Gland / mechanical seal leakage','Visual','Operator round: gland leakage and flush water',1,1,7,'Any slurry spray or acid leak = Danger','Site','N')
add(P,'STD','Casing / base erosion-corrosion','Ultrasonic thickness','UT of casing and suction / discharge spools at CMLs',365,730,None,'Below minimum wall = Danger','API 570 practice')
P='Centrifugal process pump'
add(P,'VIB','Bearing wear, misalignment, cavitation','Vibration','Overall velocity and envelope route',30,60,90,'Alert 4.5 / Danger 7.1 mm/s RMS','ISO 20816-3')
add(P,'OHE','Lubricant degradation, water ingress','Lubrication / oil','Oil analysis of bearing housings (oil lubricated)',90,180,365,'ISO 4406 above target, water > 500 ppm Alert','ISO 4406, ASTM D7720')
add(P,'OHE','Motor and coupling overheating','Infrared','Thermography of motor and coupling',90,180,365,'dT limits per ISO 18434-1','ISO 18434-1')
add(P,'ELP','Mechanical seal leakage (acid, H2O2, eluate)','Visual','CM sensitive inspection incl. seal, flange and drain check',30,60,90,'Acid or H2O2 leak = Danger','Site, ASME PCC-1')
P='Positive displacement pump'
add(P,'ELP','Hose / stator / diaphragm wear and leakage','Visual','CM sensitive inspection: hose or stator condition, leaks, pulsation',30,60,90,'Leak or hose bulge = Danger','OEM')
add(P,'NOI','Gearbox wear','Vibration','Gearbox and motor vibration route',60,90,180,'Velocity Alert 4.5 / Danger 7.1 mm/s; gear-mesh sidebands','ISO 20816-3')
add(P,'OHE','Gearbox lubricant degradation','Lubrication / oil','Gearbox oil analysis (Fe, PQ, water, viscosity)',180,365,365,'Lab limits; PQ trend','ISO 4406, ASTM D7720')
P='Agitator'
add(P,'NOI','Gear and bearing wear in gearbox','Vibration','Gearbox and motor vibration (velocity, envelope, gear-mesh)',30,60,90,'Velocity Alert 4.5 / Danger 7.1 mm/s; GMF sidebands rising','ISO 20816-3, ISO 13373-1')
add(P,'OHE','Gearbox lubricant degradation, water ingress','Lubrication / oil','Gearbox oil analysis (Fe, PQ, Cu, water, viscosity, ISO 4406)',90,90,180,'Lab limits; Fe or PQ doubling = Alert','ISO 4406, ASTM D7720')
add(P,'BRD','Shaft, coupling and impeller damage; looseness','Visual','CM sensitive inspection: shaft run-out, coupling, mounting, noise',30,60,90,'Visible run-out or loose mounting = Alert','OEM')
add(P,'STD','Bridge / support corrosion and fatigue','Structural','Structural inspection of agitator bridge and supports',365,365,730,'Section loss > 10% or cracks = Alert','Site, API 571 fatigue')
add(P,'OHE','Motor overheating','Infrared','Thermography of motor and gearbox',90,180,365,'dT limits per ISO 18434-1','ISO 18434-1')
P='Vibrating / linear screen'
add(P,'VIB','Exciter bearing wear, stroke / orbit deviation','Vibration','Exciter bearings, stroke and orbit measurement',30,60,90,'Stroke outside OEM band or bearing gE rising = Alert','OEM, ISO 13373-1')
add(P,'STD','Side-plate and cross-beam fatigue cracking','Structural','Crack inspection (visual + MT/PT at hot spots)',90,180,180,'Any crack = Danger on load-bearing members','Site, API 571 fatigue')
add(P,'OHE','Exciter lubricant degradation','Lubrication / oil','Exciter oil analysis',90,180,180,'Lab limits','ISO 4406')
add(P,'PLU','Deck blinding, panel wear and damage','Visual','CM sensitive inspection of decks, panels and springs',30,60,90,'Holes in panels or broken springs = Alert','OEM')
P='Crusher / sizer / feeder'
add(P,'VIB','Bearing and drive train wear','Vibration','Vibration route on motor, gearbox and shaft bearings',30,60,90,'Alert 4.5 / Danger 7.1 mm/s (rigid); trend for low speed','ISO 20816-3')
add(P,'OHE','Gearbox lubricant degradation','Lubrication / oil','Gearbox oil analysis',90,180,180,'Lab limits','ISO 4406, ASTM D7720')
add(P,'OHE','Brake motor, end shield and coupling overheating','Infrared','Thermography of motors, brakes, couplings',90,180,365,'dT limits per ISO 18434-1','ISO 18434-1')
add(P,'STD','Frame, apron pans and wear-part damage','Visual','CM sensitive inspection: wear parts, frame, fasteners',30,60,90,'Cracks or loose fasteners = Alert','OEM')
P='Mill drive (SAG / ball)'
add(P,'VIB','Pinion, gearbox, motor bearing wear','Vibration','Vibration route on motor, gearbox, pinion bearings',14,30,None,'OEM / ISO 20816-3 limits; GMF sidebands','ISO 20816-3, ISO 13373-1')
add(P,'OHE','Gearbox and trunnion lube degradation','Lubrication / oil','Oil analysis: gearbox, lube system, trunnion',30,60,None,'Lab limits; ISO 4406 target','ISO 4406, ASTM D7720')
add(P,'OHE','Girth gear load distribution, lubrication','Infrared','Girth gear temperature profile across face width',30,60,None,'Face temperature difference > 10 C Alert','OEM, ISO 18434-1')
add(P,'STD','Shell, liner bolts and trunnion','Visual','CM inspection: liner bolt leaks, shell cracks, trunnion seals',30,30,None,'Liner bolt leak = Alert; shell crack = Danger','OEM')
P='Belt / screw conveyor'
add(P,'STD','Belt damage, splice failure, misalignment','Visual','CM sensitive inspection: belt, splices, tracking, idlers, chutes',30,60,90,'Splice damage or tracking off = Alert','Site')
add(P,'OHE','Idler and pulley bearing failure','Infrared','Thermography of idlers and pulley bearings',90,180,365,'Hot idler = Alert','ISO 18434-1')
add(P,'NOI','Drive gearbox wear','Vibration','Drive gearbox and motor vibration',60,90,180,'Alert 4.5 / Danger 7.1 mm/s','ISO 20816-3')
P='Thickener drive'
add(P,'OHE','Drive gearbox lubricant degradation, wear','Lubrication / oil','Drive oil analysis (low speed: oil is the primary technique)',90,180,180,'Lab limits; Fe / PQ trend','ISO 4406, ASTM D7720')
add(P,'PDE','Rake torque high, bogging','Visual','CM inspection: torque trend, rake lift, drive noise',30,60,90,'Torque > 70% rated sustained = Alert','OEM')
add(P,'STD','Bridge and feedwell corrosion','Structural','Structural inspection of bridge, walkway, feedwell',365,365,730,'Section loss or cracks = Alert','Site')
P='Fan / blower'
add(P,'VIB','Unbalance, bearing wear, looseness','Vibration','Vibration route (main acid plant blower: monthly minimum, online preferred)',30,60,90,'ISO 14694 / ISO 20816-3 zones','ISO 14694, ISO 20816-3')
add(P,'OHE','Bearing lubricant degradation','Lubrication / oil','Oil analysis (oil lubricated bearings / lube system)',90,180,365,'Lab limits','ISO 4406')
add(P,'OHE','Motor and bearing overheating','Infrared','Thermography of motor and bearings',90,180,365,'dT limits','ISO 18434-1')
P='Gearbox (stand-alone)'
add(P,'NOI','Gear and bearing wear','Vibration','Vibration route incl. gear-mesh analysis',30,60,90,'GMF sidebands, velocity zones','ISO 20816-3, ISO 13373-1')
add(P,'OHE','Lubricant degradation','Lubrication / oil','Oil analysis',90,180,365,'Lab limits','ISO 4406, ASTM D7720')
P='Hydraulic / lube unit'
add(P,'ELU','Contamination, wear debris, leakage','Lubrication / oil','Oil analysis with particle count',90,180,365,'ISO 4406 above target code = Alert','ISO 4406')
add(P,'ELU','Hose and fitting leakage','Visual','CM inspection: leaks, filter dP, accumulator',30,60,90,'Active leak = Alert','Site')
P='Filter (drum / plate / belt)'
add(P,'PLU','Media blinding, cloth damage','Visual','CM inspection: cloth, cake, sprays, tracking',30,60,90,'Torn cloth = Alert','OEM')
add(P,'NOI','Drive wear','Vibration','Drive gearbox vibration',60,90,180,'Velocity zones','ISO 20816-3')
P='Electric motor and drive'
add(P,'OHE','Connection, winding and bearing overheating','Infrared','Thermography of terminal boxes and frame',90,180,365,'NETA MTS dT: > 4 C Alert, > 15 C Danger','ISO 18434-1, NETA MTS')
add(P,'BRD','Insulation degradation','Electrical','Insulation resistance and polarisation index',365,730,730,'IR < 100 MOhm or PI < 2 = Alert','IEEE 43')
add(P,'VIB','Bearing wear, soft foot','Vibration','Vibration with driven machine',30,60,90,'Velocity zones','ISO 20816-3')
P='Atmospheric storage tank'
add(P,'ELP','Leaks, external corrosion, settlement signs','Visual','Routine in-service external visual walk-down',30,30,30,'Leak = Danger; new corrosion or settlement = Alert','API 653 (routine in-service inspection)')
add(P,'STD','Shell and roof wall thinning','Ultrasonic thickness','UT at CMLs; baseline + 1 year, then lesser of RL/2 and 5 years',365,365,730,'Below t-min = Danger; red band = Alert','API 653, API 571')
add(P,'STD','Formal external inspection by authorised inspector','Tank & vessel','Formal external inspection',1825,1825,1825,'Per inspector report','API 653')
add(P,'STD','Foundation, settlement, anchorage','Structural','Foundation, settlement and verticality survey',365,730,730,'Tilt or settlement outside API 653 Annex B = Danger','API 653 Annex B')
add(P,'ELP','Coating and lining breakdown','Tank & vessel','Coating DFT survey; lining holiday test at internal inspection',365,730,730,'DFT < 200 um = Alert; lining holiday = Alert','ISO 12944, NACE SP0188')
P='Process vessel (atmospheric, lined)'
add(P,'ELP','Leaks, flange and manway gasket failure','Visual','Routine external visual walk-down incl. bolted joints',30,30,60,'Active leak = Danger','API 653 practice, ASME PCC-1')
add(P,'STD','Formal external inspection','Tank & vessel','Formal external visual inspection (statutory)',365,365,730,'Per inspector report','Site statutory, API 510/653 practice')
add(P,'STD','Wall thinning, roof corrosion','Ultrasonic thickness','UT at CMLs (roof and shell)',365,730,730,'Below t-min = Danger','API 571, API 653 practice')
add(P,'STD','Supports, plinths and anchor bolts (acid attack)','Structural','Structural inspection of supports and plinths',365,365,730,'Loss of anchorage = Danger','Site')
P='Pressure vessel / boiler'
add(P,'STD','Statutory inspection and certificate','Statutory','Statutory inspection / hydrotest by competent person',365,365,365,'Certificate expired = Danger','Site regulation, API 510')
add(P,'STD','Wall thinning, boiler tube corrosion','Ultrasonic thickness','UT of shell, heads and tubes (WHB, economiser)',365,365,730,'Below minimum = Danger','API 510, API 571')
add(P,'ELP','Leaks, safety valve condition','Visual','Routine external visual walk-down incl. PSV tags',30,30,60,'Leak or PSV overdue = Danger','API 510, API 576')
P='Piping (acid / slurry / process)'
add(P,'STD','Wall thinning (erosion-corrosion, sulfuric acid corrosion)','Ultrasonic thickness','UT at CMLs, elbows and tees first',180,365,1825,'Below minimum = Danger; RL <= 3 years = Alert','API 570, API 571')
add(P,'ELP','Leaks, supports, external corrosion','Piping','External visual inspection of piping circuit',90,180,365,'Leak = Danger','API 570')
P='Sulphur furnace / refractory-lined equipment'
add(P,'OHE','Refractory loss, hot spots','Infrared','Shell thermography scan',30,30,None,'Shell above design or rising hot spot = Alert; above limit = Danger','API RP 936, ISO 18434-1')
add(P,'STD','Casing, burner and nozzle condition','Visual','CM inspection incl. burner, sight glasses, expansion joints',30,30,None,'Casing hot spot or leak = Alert','Site')
add(P,'STD','Structural supports','Structural','Structural inspection of supports and platforms',365,365,None,'Cracks or section loss = Alert','Site')
P='Converter / gas ducts'
add(P,'OHE','Flange leaks, insulation and refractory damage','Infrared','Thermography of beds, flanges and ducts',30,60,None,'Flange dT > 30 C over baseline Alert','ISO 18434-1')
add(P,'STD','Duct and economiser dew-point corrosion','Ultrasonic thickness','UT of ducts below acid dew point and economiser',365,730,None,'Below minimum = Danger','API 571')
P='Drying / absorption tower, acid cooler and acid piping'
add(P,'STD','Sulfuric acid corrosion (velocity, temperature, concentration)','Ultrasonic thickness','UT of acid lines, cooler shells, tower shell at CMLs',180,365,None,'Below minimum = Danger; ST rate > 1.5 x LT = Alert','API 571 sulfuric acid corrosion')
add(P,'INL','Anodic protection / cooler tube leak','Electrical','Anodic protection potential check and cooler leak detection',7,7,None,'Potential outside OEM band = Alert','OEM')
add(P,'OHE','Brick lining failure, hot spots','Infrared','Tower shell thermography',90,180,None,'Hot spot = Alert','ISO 18434-1')
add(P,'ELP','Acid leaks at flanges and pumps','Visual','Routine walk-down of acid circuit',30,30,None,'Any acid leak = Danger','Site, ASME PCC-1')
P='Switchgear / MCC / transformer'
add(P,'OHE','Loose or corroded connections','Infrared','Thermography under load (> 40% load)',90,180,365,'NETA MTS: > 4 C Alert, > 15 C Danger','NETA MTS, NFPA 70B, ISO 18434-1')
add(P,'BRD','Partial discharge, tracking','Ultrasonics (airborne)','Airborne ultrasound / TEV partial discharge survey',180,365,365,'PD activity detected = Alert','IEC 62478 practice')
add(P,'BRD','Transformer insulation and oil degradation','Lubrication / oil','Transformer oil DGA and quality',365,365,730,'DGA per IEC 60599 / IEEE C57.104','IEC 60599, IEEE C57.104')
P='Rotary dryer / kiln / calciner'
add(P,'OHE','Refractory loss, shell hot spots','Infrared','Shell thermography scan',30,30,None,'Shell above limit = Danger','API RP 936, ISO 18434-1')
add(P,'VIB','Drive train wear','Vibration','Drive vibration route',30,60,None,'Velocity zones','ISO 20816-3')
add(P,'OHE','Girth gear lubrication','Lubrication / oil','Girth gear lubricant check and oil analysis',90,90,None,'Lab limits','OEM')
add(P,'STD','Tyre and roller alignment, shell ovality','Structural','Alignment and ovality survey',365,365,None,'Out of OEM tolerance = Alert','OEM')
P='Diesel generator'
add(P,'OHE','Turbocharger, exhaust and cooling deviation','DG checks','Daily log: exhaust temp per cylinder, turbo in/out, oil pressure, coolant temp',1,1,7,'Exhaust spread > 50 C or turbo outlet above OEM = Alert','OEM')
add(P,'OHE','Engine wear, fuel dilution, coolant ingress','Lubrication / oil','Engine oil analysis every 250 running hours (approx. monthly)',30,30,60,'Lab limits (Fe, Si, Na/K, fuel dilution)','OEM, ASTM D7720')
add(P,'VIB','Alternator and engine mounting','Vibration','Vibration of alternator bearings and engine mounts',30,60,90,'ISO 8528-9 limits','ISO 8528-9')
add(P,'OHE','Exhaust, turbo lagging, electrical connections','Infrared','Thermography of exhaust, turbo lagging and terminals',90,90,180,'Lagging gaps / hot spots = Alert','ISO 18434-1')
P='Baghouse / dust collector'
add(P,'PDE','Bag blinding, broken bags, pulse-jet failure','Visual','Differential pressure log, bag leak detector trend, pulse valve function, hopper discharge',30,30,60,'dP outside OEM band or leak detector alarm = Alert; visible emission = Danger','OEM, site emission licence')
add(P,'ELU','Compressed air and pulse valve leaks','Ultrasonics (airborne)','Ultrasound survey of pulse valves, headers and seals',90,180,365,'Leak detected = Alert','ISO 29821')
add(P,'STD','Housing and hopper corrosion, door seal leaks (product dust)','Tank & vessel','Housing, hopper and door seal inspection (radiological work permit)',365,365,730,'Seal leak or hole = Danger in product area','Site, radiation management plan')
P='Stack / emission point'
add(P,'PDE','Particulate and uranium emissions above licence','Statutory','Stack emission monitoring as required by the licence',90,90,180,'Above licence limit = Danger','Site emission licence')
add(P,'STD','Stack shell corrosion, supports, sampling ports','Structural','Stack structural inspection and UT at base',365,730,730,'Section loss or crack = Alert','Site')
P='Feeder / vibrator (product handling)'
add(P,'VIB','Bearing wear, unbalance, loose mounting','Vibration','Vibration route on drives and vibrator motors',60,90,180,'Velocity zones','ISO 20816-3')
add(P,'BRD','Rotary valve wear, seal leakage of product dust','Visual','CM inspection: rotor clearance, seals, flexible connections',30,60,90,'Product leak = Danger','OEM, radiation management plan')
add(P,'OHE','Motor and bearing overheating','Infrared','Thermography of motors and bearings',90,180,365,'dT limits','ISO 18434-1')
P='Product packaging line'
add(P,'SER','Drum filling, sealing, washing and weighing faults','Visual','CM inspection of filling head, lid press, drum washer, check-weigher and conveyors',30,60,90,'Product spillage or seal failure = Danger','OEM, radiation management plan')
add(P,'AIR','Check-weigher accuracy (product accountancy)','Electrical','Check-weigher calibration with certified weights',90,90,180,'Outside tolerance = Alert','Site product accountancy / safeguards')
add(P,'OHE','Drive and motor overheating','Infrared','Thermography of drives and motors',90,180,365,'dT limits','ISO 18434-1')
P='Heat exchanger / condenser'
add(P,'ELP','Tube or gasket leakage','Visual','CM inspection: leaks, vent, drains',30,60,90,'Leak = Alert; acid or product leak = Danger','Site')
add(P,'PDE','Fouling, loss of performance','Infrared','Inlet and outlet temperature survey (approach temperature)',90,180,365,'Approach rising over 25% from baseline = Alert','OEM, ISO 18434-1')
add(P,'STD','Shell and nozzle wall thinning','Ultrasonic thickness','UT of shell, nozzles and channels',365,730,730,'Below minimum = Danger','API 571, API 510 practice')
P='Sump / bund (concrete)'
add(P,'STD','Concrete acid attack, lining failure, cracks','Structural','Inspection of sump or bund concrete and lining',180,365,365,'Exposed reinforcement or lining breach = Alert; leak path = Danger','Site, ISO 12944 / acid-resistant lining practice')
add(P,'ELP','Overflow and containment loss','Visual','CM inspection: level control, pump-out, overflow route',30,60,90,'Overflow evidence = Alert','Site')
P='Bin / chute / bunker'
add(P,'STD','Liner and wall wear, holes, hang-ups','Visual','CM inspection of liners, wear plates, flow and level devices',90,180,365,'Hole in wall or liner = Alert','Site')
add(P,'STD','Wall thinning at impact zones','Ultrasonic thickness','UT at impact and wear zones',365,730,730,'Below minimum = Danger','Site')
add(P,'STD','Support structure and hopper connections','Structural','Structural inspection of supports and bolting',365,730,730,'Cracks or section loss = Alert','Site')
STRATEGY = S

# equipment type / asset class -> strategy class (service decides slurry vs process for centrifugal pumps)
TAG_CLASS = {'120-VT-162': 'Mill drive (SAG / ball)'}   # identified from oil analysis records (No.1 mill gearbox)
def strategy_class(asset_class, area_code=None, name='', tag=''):
    if tag in TAG_CLASS: return TAG_CLASS[tag]
    t = (asset_class or '').lower(); n = (name or '').lower()
    if t in ('', 'unclassified'):
        for keys, cls in [(['lube unit', 'lubrication unit'], 'Hydraulic / lube unit'), (['dryer'], 'Rotary dryer / kiln / calciner'), (['pump'], None),
                          (['vibrator', 'feeder'], 'Feeder / vibrator (product handling)'), (['fan', 'blower'], 'Fan / blower'),
                          (['bunker', 'chute', ' bin'], 'Bin / chute / bunker'), (['baghouse', 'bag filter', 'dust collector'], 'Baghouse / dust collector'),
                          (['stack'], 'Stack / emission point'), (['sump'], 'Sump / bund (concrete)'), (['thickener'], 'Thickener drive'),
                          (['gbx', 'gearbox'], 'Mill drive (SAG / ball)' if area_code == 120 else 'Gearbox (stand-alone)'), (['condenser'], 'Heat exchanger / condenser'),
                          (['drum washer', 'drum fill', 'check weigh', 'filling/washing', 'pack-'], 'Product packaging line'),
                          (['separator tank', 'tank', 'vessel'], 'Process vessel (atmospheric, lined)'), (['extractor', 'conveyor'], 'Belt / screw conveyor')]:
            if any(k in ' ' + n for k in keys):
                if cls: return cls
                return 'Centrifugal slurry pump' if (area_code in (110, 120, 210, 220, 310, 410, 420, 520, 610, 620) or 'yellow' in n or 'gypsum' in n) else 'Centrifugal process pump'
        m = re.match(r'^\d{3}-([A-Z]{2})', tag or '')
        if m and m.group(1) in ('PM', 'PJ', 'PC'): return 'Centrifugal slurry pump' if area_code in (110, 120, 210, 220, 310, 410, 420, 520, 610, 620) else 'Centrifugal process pump'
        return ''
    slurry_area = area_code in (110, 120, 210, 220, 310, 610, 620)
    if 'slurry pump' in t: return 'Centrifugal slurry pump'
    if 'centrifugal' in t or t == 'rotating - pump': return 'Centrifugal slurry pump' if slurry_area else 'Centrifugal process pump'
    if any(k in t for k in ['progressive', 'peristaltic', 'diaphragm', 'gear pump']): return 'Positive displacement pump'
    if any(k in t for k in ['hydraulic', 'greasing']): return 'Hydraulic / lube unit'
    if 'agitator' in t: return 'Agitator'
    if 'screen' in t: return 'Vibrating / linear screen'
    if any(k in t for k in ['crusher', 'sizer', 'feeder']): return 'Crusher / sizer / feeder'
    if 'mill' in t: return 'Mill drive (SAG / ball)'
    if 'conveyor' in t: return 'Belt / screw conveyor'
    if 'thickener' in t: return 'Thickener drive'
    if any(k in t for k in ['fan', 'blower']): return 'Fan / blower'
    if 'gearbox' in t: return 'Gearbox (stand-alone)'
    if 'filter' in t: return 'Filter (drum / plate / belt)'
    if 'motor' in t: return 'Electric motor and drive'
    if t == 'tank': return 'Atmospheric storage tank'
    if 'vessel / tank' in t: return 'Process vessel (atmospheric, lined)'
    if 'pressure vessel' in t or 'boiler' in t: return 'Pressure vessel / boiler'
    if 'piping' in t: return 'Piping (acid / slurry / process)'
    if 'fired' in t or 'furnace' in n: return 'Sulphur furnace / refractory-lined equipment'
    if 'kiln' in t or 'dryer' in t or 'calciner' in n: return 'Rotary dryer / kiln / calciner'
    if 'transformer' in t or 'switchgear' in t or 'mcc' in t: return 'Switchgear / MCC / transformer'
    if 'diesel' in t: return 'Diesel generator'
    if 'converter' in n: return 'Converter / gas ducts'
    return ''

def service_of(area_code, asset_class=''):
    c = area_code or 0
    if c in (110, 120, 210, 220, 310, 610, 620): return 'Slurry (acid leach)' if c in (210, 220, 310, 610) else 'Slurry'
    if c == 750: return 'Sulphuric acid'
    if c == 730: return 'Hydrogen peroxide'
    if c == 740: return 'Caustic soda'
    if 700 <= c < 800: return 'Reagent'
    if 800 <= c < 900: return 'Water'
    if c in (320, 330): return 'Eluate / uranium solution'
    if c == 410: return 'Gypsum slurry'
    if c == 420: return 'Uranium precipitate'
    if 500 <= c < 600: return 'Uranium product (yellowcake)'
    return ''

STANDARDS_MAP = [
 ('ISO 55001:2014','4-10','Asset management system: context, leadership, planning, support, operation, evaluation, improvement','Framework document; Management page; monthly review and commentary; roadmap','Partial: SAMP and management review to formalise'),
 ('ISO 55001:2014','6.2','Asset management objectives and plans','KPI targets in Lists; Management page vs target','In place'),
 ('ISO 55001:2014','7.5','Documented information and data','Asset_Register, common record format, data dictionary, validation','In place'),
 ('ISO 55001:2014','9.1','Monitoring, measurement, analysis and evaluation','AHI, data confidence, strategy compliance, SMRP metrics','In place'),
 ('ISO 55001:2014','10.1','Nonconformity and corrective action','Open recommendations, ageing, overdue, escalation, RCA on bad actors','In place'),
 ('ISO 31000:2018','6.4','Risk assessment (identification, analysis, evaluation)','5x5 risk matrix, Risk page, risk register','In place'),
 ('ISO 14224:2016','8, Annex B','Equipment taxonomy, failure modes and mechanisms','ISO 14224 failure mode and mechanism fields; site mapping','In place: hierarchy to maintainable item level to complete'),
 ('ISO 17359:2018','5-7','Condition monitoring programme: failure mode, technique, interval, alarm','Strategy library with intervals and criteria; strategy compliance','In place'),
 ('ISO 18436 series','-','Competence of CM personnel','Competence matrix in framework document','To implement'),
 ('ISO 20816-3 / ISO 13373','-','Vibration evaluation and analysis','Vibration limits 4.5 / 7.1 mm/s; strategy tasks','In place'),
 ('ISO 18434-1','-','Thermography for condition monitoring','IR tasks and NETA dT limits','In place'),
 ('ISO 29821','-','Ultrasound for condition monitoring','Ultrasound tasks','In place'),
 ('ISO 4406 / ASTM D7720','-','Oil cleanliness and oil analysis alarm limits','Oil analysis tasks and lab limits','In place'),
 ('API 653','6','Tank inspection intervals, remaining life','Thickness monitoring, remaining life, next UT due','Partial: t-min per shell course to calculate'),
 ('API 570 / API 510','6-7','Piping and pressure vessel inspection','Piping and vessel strategy tasks; statutory register','Partial: piping CML programme to set up'),
 ('API 571','-','Damage mechanisms','Damage mechanism field and library','In place'),
 ('API 580 / 581','-','Risk-based inspection','Likelihood from remaining life and damage mechanism','Partial: semi-quantitative RBI to formalise'),
 ('ASME PCC-1','-','Bolted flange joint assembly','Flange leak actions (vessel inspections)','Procedure to adopt'),
 ('SMRP Best Practice Metrics','-','Maintenance and reliability KPIs','Planned vs reactive work, PM completion, backlog','In place (from Pronto WO export)'),
 ('ICRP / IAEA radiation protection','-','ALARA for maintenance on uranium-bearing equipment','Consequence category Health and radiation; framework document','In place in risk matrix'),
]
