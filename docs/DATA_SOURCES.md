# Martian Map — NASA Planetary Data Sources

This catalog documents the official NASA planetary mission data products integrated into the Martian Map platform.

---

## 1. MGS MOLA MEGDR (Mission Experiment Gridded Data Record)
- **Mission**: Mars Global Surveyor (MGS)
- **Instruments**: Mars Orbiter Laser Altimeter (MOLA)
- **NASA URL**: https://pds-geosciences.wustl.edu/missions/mgs/mola.html
- **Data Type**: Digital Elevation Model (DEM) / Planetocentric Topography
- **Purpose**: Provides surface elevation relative to the Mars areoid datum ($R = 3396.19\text{ km}$), used for continuous cross-section elevation profiling, slope determination, and astronaut metabolic walking rates.
- **Integration Method**: USGS Astrogeology AstroWeb WMS (`MOLA_color`) & backend topographic interpolation engine.
- **Update Frequency**: Historical Archive (Completed Mission). Static benchmark calibration grid.
- **License / Attribution**: NASA / GSFC / PDS Geosciences Node (Public Domain).

---

## 2. Viking Orbiter MDIM 2.1 (Mars Digital Image Model)
- **Mission**: Viking Orbiters 1 & 2
- **Instruments**: Visual Imaging Subsystem (VIS)
- **NASA URL**: https://astrogeology.usgs.gov/search/map/Mars/Viking/MDIM21/Mars_Viking_MDIM21_ClrMosaic_global_232m
- **Data Type**: Global visible band image mosaic (~232 m/pixel)
- **Purpose**: Basemap visible context across the Martian globe.
- **Integration Method**: USGS Astrogeology Planetary WMS (`MDIM21`).
- **Update Frequency**: Calibrated Static Mosaic.
- **License / Attribution**: USGS Astrogeology Science Center / NASA (Public Domain).

---

## 3. 2001 Mars Odyssey THEMIS Global Infrared Mosaic
- **Mission**: 2001 Mars Odyssey
- **Instruments**: Thermal Emission Imaging System (THEMIS)
- **NASA URL**: https://themis.asu.edu/
- **Data Type**: Daytime Thermal Infrared (IR) Mosaic (100 m/pixel)
- **Purpose**: Thermophysical characterization, rock abundance, fine-grained dust mantles versus bedrock detection.
- **Integration Method**: USGS Astrogeology Planetary WMS (`THEMIS_IR_day`).
- **Update Frequency**: Static Global Composite.
- **License / Attribution**: NASA / JPL-Caltech / Arizona State University.

---

## 4. MRO HiRISE (High Resolution Imaging Science Experiment)
- **Mission**: Mars Reconnaissance Orbiter (MRO)
- **Instruments**: HiRISE High-Resolution Camera (~25-50 cm/pixel)
- **NASA URL**: https://hirise.lpl.arizona.edu/
- **Data Type**: Targeted High-Resolution Orthorectified Digital Terrain Models (DTMs) & Visible RDRs
- **Purpose**: Detailed boulder hazard identification, landing site qualification, and outcrop layering (e.g. Belva Crater, Kodiak Butte).
- **Integration Method**: Targeted image coordinates and crater feature links.
- **Update Frequency**: Ongoing active orbital mission.
- **License / Attribution**: NASA / JPL-Caltech / University of Arizona.

---

## 5. Mars 2020 & MSL Curiosity Planetary Data System
- **Missions**: Mars 2020 (Perseverance), Mars Science Laboratory (Curiosity)
- **Instruments**: Mastcam-Z, SuperCam, PIXL, SHERLOC, RIMFAX, CheMin, APXS, ChemCam
- **NASA URL**: https://an.rsl.wustl.edu/
- **Data Type**: In-situ rover traverse paths, sample core tube locations, elemental and mineral spectral summaries
- **Purpose**: Ground-truth calibration for scientific target scoring, mineralogy alerts, and realistic EVA traverse distance benchmarks.
- **Integration Method**: Unified JSON benchmark catalog (`backend/src/services/nasa/adapters/benchmarkData.ts`).
- **Update Frequency**: Regular releases to NASA PDS Analyst's Notebook.
- **License / Attribution**: NASA / JPL-Caltech / Washington University in St. Louis.
