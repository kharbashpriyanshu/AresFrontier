import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_deck():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Theme colors
    BG_COLOR = RGBColor(11, 15, 23)        # #0B0F17 Deep Space Navy
    CARD_BG = RGBColor(18, 26, 42)         # #121A2A Surface Card
    CARD_BORDER = RGBColor(30, 48, 77)     # #1E304D Sleek Border
    TEXT_WHITE = RGBColor(248, 250, 252)   # #F8FAFC Crisp White
    TEXT_MUTED = RGBColor(148, 163, 184)   # #94A3B8 Cool Slate
    TEXT_CYAN = RGBColor(0, 229, 255)      # #00E5FF Telemetry Cyan
    TEXT_ORANGE = RGBColor(255, 87, 34)    # #FF5722 Mars Orange
    GREEN_ACCENT = RGBColor(16, 185, 129)  # #10B981 Invariant Pass

    def add_slide_background(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
        bg.fill.solid()
        bg.fill.fore_color.rgb = BG_COLOR
        bg.line.fill.background()
        return bg

    def add_header(slide, tag, title, subtitle):
        # Header Box
        header_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.733), Inches(1.1))
        tf = header_box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        # Tag
        p_tag = tf.paragraphs[0]
        p_tag.text = tag.upper()
        p_tag.font.name = "Segoe UI"
        p_tag.font.size = Pt(9.5)
        p_tag.font.bold = True
        p_tag.font.color.rgb = TEXT_ORANGE
        p_tag.space_after = Pt(2)

        # Title
        p_title = tf.add_paragraph()
        p_title.text = title
        p_title.font.name = "Segoe UI"
        p_title.font.size = Pt(22)
        p_title.font.bold = True
        p_title.font.color.rgb = TEXT_WHITE
        p_title.space_after = Pt(2)

        # Subtitle
        p_sub = tf.add_paragraph()
        p_sub.text = subtitle
        p_sub.font.name = "Segoe UI"
        p_sub.font.size = Pt(11)
        p_sub.font.color.rgb = TEXT_CYAN

        # Thin divider line
        line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.55), Inches(11.733), Inches(0.02))
        line.fill.solid()
        line.fill.fore_color.rgb = CARD_BORDER
        line.line.fill.background()

    def add_footer(slide, current_idx, total=12):
        footer_box = slide.shapes.add_textbox(Inches(0.8), Inches(7.05), Inches(11.733), Inches(0.3))
        tf = footer_box.text_frame
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.text = f"🪐 ARES FRONTIER  |  PLANETARY MISSION DIGITAL TWIN  |  NASA SPACE APPS CHALLENGE 2026        [SLIDE {current_idx:02d} / {total:02d}]"
        p.font.name = "Consolas"
        p.font.size = Pt(8.5)
        p.font.color.rgb = TEXT_MUTED

    def add_card(slide, left, top, width, height, title, items):
        # Card Background
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = CARD_BORDER
        card.line.width = Pt(1.2)

        tb = slide.shapes.add_textbox(left + Inches(0.2), top + Inches(0.18), width - Inches(0.4), height - Inches(0.36))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p_t = tf.paragraphs[0]
        p_t.text = title.upper()
        p_t.font.name = "Segoe UI"
        p_t.font.size = Pt(12)
        p_t.font.bold = True
        p_t.font.color.rgb = TEXT_ORANGE
        p_t.space_after = Pt(8)

        for heading, body in items:
            p_item = tf.add_paragraph()
            p_item.space_after = Pt(6)
            
            run_head = p_item.add_run()
            run_head.text = f"• {heading}: " if heading else "• "
            run_head.font.name = "Segoe UI"
            run_head.font.size = Pt(10)
            run_head.font.bold = True
            run_head.font.color.rgb = TEXT_CYAN

            run_body = p_item.add_run()
            run_body.text = body
            run_body.font.name = "Segoe UI"
            run_body.font.size = Pt(9.5)
            run_body.font.color.rgb = TEXT_WHITE

    def add_image_panel(slide, left, top, width, height, img_path, caption, badge="DEMO TELEMETRY"):
        if os.path.exists(img_path):
            # Frame background
            frame = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
            frame.fill.solid()
            frame.fill.fore_color.rgb = CARD_BG
            frame.line.color.rgb = CARD_BORDER
            frame.line.width = Pt(1.5)

            # Image inside
            img_top = top + Inches(0.08)
            img_left = left + Inches(0.08)
            img_w = width - Inches(0.16)
            img_h = height - Inches(0.48)
            slide.shapes.add_picture(img_path, img_left, img_top, img_w, img_h)

            # Badge pill
            badge_box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left + Inches(0.15), top + Inches(0.15), Inches(1.8), Inches(0.28))
            badge_box.fill.solid()
            badge_box.fill.fore_color.rgb = RGBColor(15, 23, 42)
            badge_box.line.color.rgb = TEXT_CYAN
            badge_box.line.width = Pt(1)
            b_tf = badge_box.text_frame
            b_tf.margin_top = Inches(0.03)
            b_p = b_tf.paragraphs[0]
            b_p.text = badge
            b_p.font.name = "Consolas"
            b_p.font.size = Pt(8)
            b_p.font.bold = True
            b_p.font.color.rgb = TEXT_CYAN
            b_p.alignment = PP_ALIGN.CENTER

            # Caption bar
            cap_tb = slide.shapes.add_textbox(left + Inches(0.1), top + height - Inches(0.38), width - Inches(0.2), Inches(0.3))
            c_tf = cap_tb.text_frame
            c_tf.margin_left = c_tf.margin_top = c_tf.margin_right = c_tf.margin_bottom = 0
            c_p = c_tf.paragraphs[0]
            c_p.text = f"📷 {caption}"
            c_p.font.name = "Segoe UI"
            c_p.font.size = Pt(9)
            c_p.font.color.rgb = TEXT_MUTED
            c_p.alignment = PP_ALIGN.CENTER

    # ==========================================
    # SLIDE 1: TITLE SLIDE (HERO)
    # ==========================================
    s1 = prs.slides.add_slide(blank_layout)
    add_slide_background(s1)

    # Hero Image Backdrop
    hero_img = "frontend/public/mars-hero-bg.jpg"
    if os.path.exists(hero_img):
        pic = s1.shapes.add_picture(hero_img, 0, 0, prs.slide_width, prs.slide_height)
        # Add dark scrim overlay
        scrim = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
        scrim.fill.solid()
        scrim.fill.fore_color.rgb = RGBColor(7, 10, 18)
        # Transparent scrim effect (simulate by heavy contrast box)

    # Central Presentation Hero Box
    box_w = Inches(11.0)
    box_h = Inches(5.8)
    box_l = Inches(1.166)
    box_t = Inches(0.85)

    hero_card = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, box_l, box_t, box_w, box_h)
    hero_card.fill.solid()
    hero_card.fill.fore_color.rgb = RGBColor(12, 17, 28)
    hero_card.line.color.rgb = CARD_BORDER
    hero_card.line.width = Pt(1.5)

    tb = s1.shapes.add_textbox(box_l + Inches(0.8), box_t + Inches(0.6), box_w - Inches(1.6), box_h - Inches(1.2))
    tf = tb.text_frame
    tf.word_wrap = True

    p0 = tf.paragraphs[0]
    p0.text = "NASA SPACE APPS CHALLENGE 2026 // PLANETARY DIGITAL TWIN"
    p0.font.name = "Consolas"
    p0.font.size = Pt(11)
    p0.font.bold = True
    p0.font.color.rgb = TEXT_ORANGE
    p0.space_after = Pt(12)

    p1 = tf.add_paragraph()
    p1.text = "🪐 ARES FRONTIER"
    p1.font.name = "Segoe UI"
    p1.font.size = Pt(40)
    p1.font.bold = True
    p1.font.color.rgb = TEXT_WHITE
    p1.space_after = Pt(8)

    p2 = tf.add_paragraph()
    p2.text = "Planetary Mission Intelligence Under Uncertainty & Multi-Agent Teleoperations"
    p2.font.name = "Segoe UI"
    p2.font.size = Pt(16)
    p2.font.color.rgb = TEXT_CYAN
    p2.space_after = Pt(20)

    p3 = tf.add_paragraph()
    p3.text = "A reproducible, physics-grounded mission operations console uniting high-resolution MOLA laser altimetry, USGS Viking MDIM 2.1 visible basemaps, metabolic biophysics, Pareto route optimization, multi-agent autonomous coordination, and cryptographic SHA-256 mission audit ledgers."
    p3.font.name = "Segoe UI"
    p3.font.size = Pt(11)
    p3.font.color.rgb = TEXT_MUTED
    p3.space_after = Pt(28)

    # Badges row
    p4 = tf.add_paragraph()
    p4.text = "🚀 5 Integrated NASA Missions    •    📈 128 px/deg MOLA Elevation Grid    •    🛡️ 8 Canonical Safety Invariants    •    ✅ 256/256 Passing Tests"
    p4.font.name = "Consolas"
    p4.font.size = Pt(10)
    p4.font.bold = True
    p4.font.color.rgb = GREEN_ACCENT

    add_footer(s1, 1)

    # ==========================================
    # SLIDE 2: THE REAL-WORLD MARS CHALLENGE
    # ==========================================
    s2 = prs.slides.add_slide(blank_layout)
    add_slide_background(s2)
    add_header(s2, "Operational Problem & Motivation", "The Planetary Mission Dilemma", "Human Extravehicular Activity (EVA) on Mars operates under extreme physiological and terrain risk.")

    card_w = Inches(5.6)
    card_h = Inches(5.1)
    add_card(s2, Inches(0.8), Inches(1.8), card_w, card_h, "Critical Mission Hazards & Constraints", [
        ("Hostile & Steep Topography", "Volcanic scarps, boulder fields, and loose regolith slopes (>15°) cause wheel slippage, structural tipping, and spacesuit abrasive failures."),
        ("Rigid Life-Support Margins", "Spacesuit Portable Life Support System (PLSS) reserves are strictly finite. NASA flight rules dictate a mandatory 30-minute safety return margin at all times."),
        ("Scattered Geological Targets", "Prime astrobiological targets (river delta foresets, phyllosilicate clay beds, olivine cumulates) are dispersed across vast, rugged expanses."),
        ("Fragmented Planetary Data", "Mission commanders currently juggle disconnected orbital altimetry, satellite mosaics, thermal inertia maps, and rover logs without unified telemetry."),
        ("The Ares Frontier Solution", "Synthesizes multi-source NASA data into a real-time digital twin that continuously evaluates terrain traversal physics, metabolic curves, and safety invariants.")
    ])

    add_image_panel(s2, Inches(6.8), Inches(1.8), Inches(5.733), Inches(5.1),
                    "docs/acceptance-screenshots/01_mission_planning.png",
                    "Ares Frontier unified traverse planning console at Jezero Crater", "OPERATIONAL DEMO")
    add_footer(s2, 2)

    # ==========================================
    # SLIDE 3: SYSTEM ARCHITECTURE & DATA PIPELINE
    # ==========================================
    s3 = prs.slides.add_slide(blank_layout)
    add_slide_background(s3)
    add_header(s3, "System Engineering & Planetary GIS", "Full-Stack Planetary Digital Twin Architecture", "Production-grade microservices combining React 18 GIS, Node.js 24 engine, and NASA orbital data.")

    add_card(s3, Inches(0.8), Inches(1.8), card_w, card_h, "Architectural Building Blocks", [
        ("Frontend GIS Console", "React 18, Vite 6, Tailwind CSS, Leaflet GIS engine, and Lucide telemetry icons. Responsive across dual-monitor mission control and tactical tablets."),
        ("NASA Orbital Basemaps", "USGS Astrogeology Viking MDIM 2.1 global visible mosaic (232 m/px) alongside Mars Odyssey THEMIS daytime infrared mosaics (100 m/px)."),
        ("Backend Mission Engine", "Node.js 24, Express, TypeScript 5.7, Helmet security middleware, and in-memory persistent stores with full fallback redundancy."),
        ("Laser Altimetry Pipeline", "MGS MOLA MEGDR digital elevation models sampled at 128 px/deg across global Martian coordinates [-85°, +85°] latitude."),
        ("Deterministic Telemetry Stream", "Synchronized telemetry pub/sub connecting environmental sensors, rover agents, and life-support calculations without external cloud dependencies.")
    ])

    add_image_panel(s3, Inches(6.8), Inches(1.8), Inches(5.733), Inches(5.1),
                    "docs/functional-recovery/backend-500-recovery/02_map_loaded.png",
                    "USGS Viking MDIM 2.1 global planetary basemap loaded on localhost:5173", "GIS SYSTEM")
    add_footer(s3, 3)

    # ==========================================
    # SLIDE 4: TOPOGRAPHIC HAZARD ENGINE & MOLA ELEVATION
    # ==========================================
    s4 = prs.slides.add_slide(blank_layout)
    add_slide_background(s4)
    add_header(s4, "Planetary Geodesy & Terrain Analytics", "Topographic Hazard & Laser Altimetry Engine", "Spherical geodesy, continuous slope derivation, and real-time elevation profiling.")

    add_card(s4, Inches(0.8), Inches(1.8), card_w, card_h, "Topographic Physics & Analysis", [
        ("Spherical Geodesy Model", "Calculates great-circle traversal vectors and Haversine distances relative to the Mars mean volumetric areoid datum (R = 3,396.19 km)."),
        ("Multi-Frequency Profiling", "High-frequency elevation cross-section generator computing net elevation delta, cumulative ascent, descent, and terrain roughness."),
        ("Slope Hazard Classification", "Classifies gradients into 3 discrete operational tiers: Normal (<12°), High Hazard (12°-18°), and Critical Scarp (>18° - automatic reroute triggered)."),
        ("Structural Hazard Detection", "Spatial bounding boxes identify documented geomorphic hazards including Jezero Delta Front Scarps, Belva Megabreccia, and Neretva Vallis Breaches."),
        ("Bidirectional Map Sync", "Interactive hover reticle synchronizes points on the elevation profile chart directly with spatial lat/long pins on the planetary surface.")
    ])

    add_image_panel(s4, Inches(6.8), Inches(1.8), Inches(5.733), Inches(5.1),
                    "docs/functional-recovery/batch-2/map-mola-jezero.png",
                    "MGS MOLA color-shaded laser altimetry elevation overlay across Jezero Crater", "TOPOGRAPHY DEMO")
    add_footer(s4, 4)

    # ==========================================
    # SLIDE 5: AUTONOMOUS ROUTE OPTIMIZATION & METABOLIC PHYSICS
    # ==========================================
    s5 = prs.slides.add_slide(blank_layout)
    add_slide_background(s5)
    add_header(s5, "Mission Pathfinding & Human Physiology", "Autonomous Traverse Optimization & Metabolic Physics", "Multi-objective Pareto routing coupled with Mars-adapted metabolic exertion models.")

    add_card(s5, Inches(0.8), Inches(1.8), card_w, card_h, "Pathfinding & Metabolic Algorithms", [
        ("Adapted Tobler Metabolic Curve", "Walking velocity modeled under Martian surface gravity (0.38g) and spacesuit inertia:\n  V(slope) = 3.2 · exp(-3.2 · |tan(slope) + 0.04|) [km/h]"),
        ("4 Candidate Pareto Traverses", "Generates and compares 4 distinct route candidates: Direct Shortest, Low-Hazard Valley Corridor, Multi-Target Science Survey, and Optimal Science-Margin."),
        ("Life-Support Consumables", "Simulates oxygen consumption rate (nominal 0.95 L/min dynamically scaled by metabolic wattage on uphill inclines) and suit battery draw."),
        ("30-Minute Flight Rule Buffer", "Autonomous invariant evaluator enforces that return time to safe haven plus 30 minutes must never exceed remaining PLSS oxygen capacity."),
        ("Autonomous Waypoint Sequencing", "Calculates heading angles, segment distances, and pacing cadences for each leg of the extravehicular sortie.")
    ])

    add_image_panel(s5, Inches(6.8), Inches(1.8), Inches(5.733), Inches(5.1),
                    "docs/functional-recovery/batch-1/map-route-planning.png",
                    "Multi-leg traverse route planning with live elevation cross-section & pacing", "ROUTE PLANNER")
    add_footer(s5, 5)

    # ==========================================
    # SLIDE 6: SCIENCE TARGET CATALOG & ASTROBIOLOGICAL VALUE
    # ==========================================
    s6 = prs.slides.add_slide(blank_layout)
    add_slide_background(s6)
    add_header(s6, "Planetary Geology & Astrobiology", "In-Situ Science Target Catalog & Scoring", "Targeted sampling protocols calibrated against Mars 2020 Perseverance and MSL Curiosity discoveries.")

    add_card(s6, Inches(0.8), Inches(1.8), card_w, card_h, "Astrobiology & Scoring Engine", [
        ("Science Along the Way", "Tactical waypoint addition allows astronauts and rovers to detour to high-priority mineral outcrops with zero replanning friction."),
        ("Calibrated Geological Targets", "Catalog features verified targets: Máaz Crater Floor Basalts, South Séítah Olivine Cumulates, and Kodiak Butte ancient delta remnants."),
        ("CRISM Mineralogy Integration", "Spectral parameter maps identify carbonate-bearing rocks, hydrated silica, and clay minerals critical for past biosignature preservation."),
        ("Unified Mission Scoring (UMS)", "Tri-factor evaluation metric:\n  • Safety Score (45%): Incline and return margin penalties\n  • Science Yield (35%): Diversity of geological units sampled\n  • Accessibility (20%): Traversal difficulty & metabolic load"),
        ("Transparent Provenance", "Every score is explicitly tagged with calculation lineage (rule-based deterministic vs model-evaluated) ensuring zero black-box confusion.")
    ])

    add_image_panel(s6, Inches(6.8), Inches(1.8), Inches(5.733), Inches(5.1),
                    "docs/functional-recovery/batch-6/04_science_target_integrity.png",
                    "Astrobiological science target catalog with geological unit tags & sample protocols", "SCIENCE WORKSPACE")
    add_footer(s6, 6)

    # ==========================================
    # SLIDE 7: MULTI-AGENT FIELD OPERATIONS & TELEOPERATIONS
    # ==========================================
    s7 = prs.slides.add_slide(blank_layout)
    add_slide_background(s7)
    add_header(s7, "Autonomous Fleet Coordination", "Multi-Agent Planetary Operations Console", "Autonomous teleoperations coordinating human astronauts, surface rovers, and orbital relays.")

    add_card(s7, Inches(0.8), Inches(1.8), card_w, card_h, "5 Coordinated Fleet Agents", [
        ("ASTRONAUT-01 (Human Lead)", "Primary explorer tracked with real-time PLSS consumables, metabolic heart rate, suit pressure, and priority corridor assignment."),
        ("ROVER-01 (Scout Rover)", "High-speed reconnaissance rover with forward-facing laser rangefinders and Hazcam hazard evaluation sensors."),
        ("ROVER-02 (Heavy Science Rover)", "Equipped with Deep UV Raman Spectrometer, Planetary Instrument for X-ray Lithochemistry (PIXL), and automated core drill."),
        ("ROVER-03 & ORBITER-01 (Comms)", "Relay Rover with a 12 km UHF mast linked to Mars Reconnaissance Orbiter (MRO) providing 2048 kbps data passes every 112 minutes."),
        ("9-Stage Autonomous Closed Loop", "OBSERVE → ASSESS → SELECT TASK → PLAN PATH → CHECK BATTERY → CHECK COMMS → CHECK HAZARDS → EXECUTE → REPORT.")
    ])

    add_image_panel(s7, Inches(6.8), Inches(1.8), Inches(5.733), Inches(5.1),
                    "docs/functional-recovery/batch-3/06_eva_console_overview.png",
                    "EVA Session Console displaying live telemetry, biometrics, and multi-agent states", "FLEET OPERATIONS")
    add_footer(s7, 7)

    # ==========================================
    # SLIDE 8: EXPLAINABLE AI COPILOT & HUMAN AUTHORIZATION
    # ==========================================
    s8 = prs.slides.add_slide(blank_layout)
    add_slide_background(s8)
    add_header(s8, "Mission Decision Intelligence & Governance", "Explainable AI Copilot & Flight Director Gates", "Actionable recommendations, quantitative trade-offs, and cryptographic auditability.")

    add_card(s8, Inches(0.8), Inches(1.8), card_w, card_h, "Autonomous Decision Support", [
        ("Autonomous Hazard Encounter", "When Scout Rover encounters an unpredicted steep scarp (>18°), the mission loop pauses movement and invokes the Route Copilot."),
        ("Quantitative Trade-Off Synthesis", "Generates concrete alternative options comparing:\n  • Δ Distance: +320 meters\n  • Δ Safety: +28% risk mitigation\n  • Δ Duration: +8.4 minutes (well within battery reserve)"),
        ("Explainable Reasoning Summary", "Plain-English engineering justification outlining why the valley detour avoids loose scree while preserving science access."),
        ("Human-in-the-Loop Gate", "Autonomous AI is strictly advisory. Execution of detours requires explicit Flight Director confirmation and authorization key sign-off."),
        ("Cryptographic Mission Audit", "Every route generation, override, and authorization is stamped into an immutable SHA-256 hash chain for post-mission auditability.")
    ])

    add_image_panel(s8, Inches(6.8), Inches(1.8), Inches(5.733), Inches(5.1),
                    "docs/acceptance-screenshots/05_copilot_response.png",
                    "Mission Copilot explainable decision evidence, trade-offs & confirmation gate", "AI COPILOT")
    add_footer(s8, 8)

    # ==========================================
    # SLIDE 9: PLANETARY DIGITAL TWIN: REPLAY & WHAT-IF
    # ==========================================
    s9 = prs.slides.add_slide(blank_layout)
    add_slide_background(s9)
    add_header(s9, "Post-Mission Forensics & Counterfactual Simulation", "Digital Twin Replay & What-If Branching", "Deterministic timeline playback and counterfactual branch comparisons.")

    add_card(s9, Inches(0.8), Inches(1.8), card_w, card_h, "Digital Twin Capabilities", [
        ("Deterministic State Reconstruction", "Replays historical sorties tick-by-tick from cryptographic event logs with zero loss of state fidelity."),
        ("Time-Scrubber Controls", "Includes play/pause, step-forward/step-backward, and scrub speeds from 0.5x up to 10x real-time operational tempo."),
        ("Read-Only Isolation", "Historical replay engine is strictly decoupled from live telemetry, ensuring forensic examination cannot corrupt ongoing missions."),
        ("What-If Decision Branching", "Clones mission state at any historic timestamp to simulate counterfactual actions (e.g., 'IGNORE HAZARD' vs 'AUTHORIZE VALLEY DETOUR')."),
        ("8-Dimension Delta Matrix", "Quantitatively compares branches across Distance, Duration, Battery SoC, Science Yield, Comms Link, Composite Safety, Hazards, and Outcome.")
    ])

    add_image_panel(s9, Inches(6.8), Inches(1.8), Inches(5.733), Inches(5.1),
                    "docs/functional-recovery/batch-6/07_replay_decision_lineage.png",
                    "Deterministic mission replay timeline with cryptographic SHA-256 event lineage", "DIGITAL TWIN")
    add_footer(s9, 9)

    # ==========================================
    # SLIDE 10: 3D SURFACE VIEW & REAL-TIME SOL WEATHER
    # ==========================================
    s10 = prs.slides.add_slide(blank_layout)
    add_slide_background(s10)
    add_header(s10, "Tactical Immersion & Environmental HUD", "3D Surface Flyover & Planetary Weather HUD", "Interactive 2.5D/3D mesh rendering combined with MEDA/REMS atmospheric modeling.")

    add_card(s10, Inches(0.8), Inches(1.8), card_w, card_h, "Visualization & Atmosphere Models", [
        ("3D Mars Terrain Perspective", "Interactive 3D/2.5D surface visualization with configurable vertical elevation exaggeration (1.0x - 3.0x) for tactical situational awareness."),
        ("First-Person & Rover Cam POV", "Simulates astronaut visor head-up display (HUD) and rover forward Hazcam views along the calculated traversal vectors."),
        ("Diurnal Sol Weather Simulation", "Models Martian atmospheric temperature cycles (-78°C nighttime lows to -12°C mid-sol peaks) based on NASA MEDA and REMS sensor datasets."),
        ("Dust Storm & Optical Depth (τ)", "Simulates atmospheric opacity changes during regional dust storms, dynamically degrading rover solar cell efficiency and optical sensors."),
        ("RF Relay Horizon Occlusion", "Topographical ray tracing computes radio line-of-sight to the orbital relay, highlighting RF dead zones caused by crater rims.")
    ])

    add_image_panel(s10, Inches(6.8), Inches(1.8), Inches(5.733), Inches(5.1),
                    "docs/acceptance-screenshots/06_3d_mars_view.png",
                    "3D interactive Mars surface visualization and tactical terrain inspection", "3D VISUALIZER")
    add_footer(s10, 10)

    # ==========================================
    # SLIDE 11: CANONICAL SAFETY INVARIANTS & VERIFICATION
    # ==========================================
    s11 = prs.slides.add_slide(blank_layout)
    add_slide_background(s11)
    add_header(s11, "Validation & Rigorous Flight Safety", "Automated Testing & 8 Canonical Safety Invariants", "Continuous invariant checking ensuring compliance with NASA human spaceflight standards.")

    add_card(s11, Inches(0.8), Inches(1.8), card_w, card_h, "Safety Framework & Test Suite", [
        ("S1: Slope Limit Invariant", "Traversals through terrain exceeding 20° are mathematically prohibited to prevent unrecoverable rover rollover and suit puncture."),
        ("S2: Metabolic PLSS Margin", "Astronaut oxygen reserve must sustain round-trip return plus mandatory 30-minute reserve margin under maximum metabolic wattage."),
        ("S3: Line-of-Sight RF Window", "Autonomous field agents must never operate for >45 minutes outside direct line-of-sight UHF link with surface relay or orbiter pass."),
        ("S4: Battery State-of-Charge (SoC)", "Rover battery reserves must maintain a non-negotiable 20% floor for emergency heater operation during Martian night."),
        ("256 / 256 Passing Tests", "100% test pass rate across Vitest suites covering spherical geodesy, metabolic kinetics, sensor fusion, and cryptographic ledger integrity.")
    ])

    add_image_panel(s11, Inches(6.8), Inches(1.8), Inches(5.733), Inches(5.1),
                    "docs/functional-recovery/backend-500-recovery/05_judging_demo.png",
                    "Automated judging demo verification suite with 1-click test scenarios", "VERIFICATION")
    add_footer(s11, 11)

    # ==========================================
    # SLIDE 12: LIVE DEMO & SPACE TECH ROADMAP
    # ==========================================
    s12 = prs.slides.add_slide(blank_layout)
    add_slide_background(s12)
    add_header(s12, "Evaluation Guide & Future Horizons", "Live Evaluation & Next-Generation Horizons", "Hosted on localhost:5173 with immediate evaluation portals and future mission scaling.")

    add_card(s12, Inches(0.8), Inches(1.8), card_w, card_h, "Evaluation Summary & Roadmap", [
        ("Hosted & Ready on Localhost", "• Frontend Console: http://localhost:5173\n• Backend Mission API: http://localhost:5000\n• 1-Click Judging Demo: http://localhost:5173/demo"),
        ("Flagship MARSWALK-001 Scenario", "Pre-configured Jezero Crater traversal from Octavia E. Butler landing site through Máaz basalts, South Séítah, and Kodiak Butte remnant."),
        ("Space Tech Innovation Impact", "Demonstrates the first open-source, deterministic digital twin combining orbital GIS, human biophysics, and explainable multi-agent teleoperations."),
        ("Future Roadmap: ML Rock Segmentation", "Integrating onboard computer vision models for automated hazardous boulder detection from rover forward navigation cameras."),
        ("Artemis & Moon-to-Mars Scaling", "Extensible architecture ready to ingest Lunar Reconnaissance Orbiter (LRO) LOLA altimetry for Artemis South Pole lunar EVA planning.")
    ])

    add_image_panel(s12, Inches(6.8), Inches(1.8), Inches(5.733), Inches(5.1),
                    "docs/functional-recovery/batch-9/07_analytics_integration.png",
                    "Comprehensive mission analytics dashboard synthesizing science, safety & efficiency", "MISSION SUMMARY")
    add_footer(s12, 12)

    output_path = "d:/Downloads/nnnn/ARES_FRONTIER_SPACE_TECH_PRESENTATION.pptx"
    prs.save(output_path)
    print(f"Presentation successfully created at: {output_path}")

if __name__ == "__main__":
    create_deck()
