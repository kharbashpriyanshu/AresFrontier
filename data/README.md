# NASA Datasets & Preprocessing Directory

> **IMPORTANT**: NEVER commit large raster files, raw HiRISE images, MOLA MEGDR rasters, or binary datasets directly to this git repository. Place raw downloads in `data/raw/` (ignored by git) and preprocessed vector/JSON slices in `data/processed/`.

## Directory Overview
- `data/raw/`: Ignored by Git. Destination for downloaded GeoTIFFs, PDS IMG files, and CSVs.
- `data/processed/`: Scaled down GeoJSON, JSON target lists, and elevation samples referenced by the backend.

## Integrated NASA Data Sources

### 1. MGS MOLA (Mars Orbiter Laser Altimeter)
- **NASA Source**: PDS Geosciences Node / Goddard Space Flight Center
- **Mission**: Mars Global Surveyor (MGS)
- **Data Type**: Digital Elevation Model (DEM) / MEGDR (Mission Experiment Gridded Data Record)
- **Purpose**: Mars elevation profiling, terrain slope calculations, EVA traversal difficulty evaluation.
- **Reference Ellipsoid**: Mars areoid reference radius $R = 3396.19\text{ km}$, equatorial radius $R_{eq} = 3389.5\text{ km}$.
- **Access Method**: USGS Astrogeology AstroWeb Tile Service & USGS WMS/WMTS endpoints.

### 2. MRO HiRISE & CTX (High Resolution Imaging Science Experiment / Context Camera)
- **NASA Source**: University of Arizona / JPL / NASA PDS
- **Mission**: Mars Reconnaissance Orbiter (MRO)
- **Data Type**: Visible high-resolution orbital imagery (up to 25-50 cm/pixel)
- **Purpose**: Detailed terrain exploration, boulder & hazard identification around landing sites (e.g., Jezero Crater, Gale Crater, Olympus Mons).
- **Access Method**: NASA GIBS / OpenPlanetary Tile Services.

### 3. Mars Odyssey THEMIS (Thermal Emission Imaging System)
- **NASA Source**: Arizona State University / JPL
- **Mission**: 2001 Mars Odyssey
- **Data Type**: Thermal infrared day/night mosaics
- **Purpose**: Thermophysical properties, surface rock abundance, thermal inertia context.
- **Access Method**: USGS Astrogeology THEMIS global mosaic tile endpoints.

### 4. Mars Science Laboratory (MSL) & Mars 2020 Observations
- **NASA Source**: NASA PDS Analyst's Notebook / NASA Open Data APIs
- **Missions**: Curiosity Rover (Gale Crater), Perseverance Rover (Jezero Crater)
- **Data Type**: In-situ science target coordinates, APXS / SuperCam mineralogy summaries, rover waypoint tracks.
- **Purpose**: Benchmarking realistic EVA traverses and scientific target scoring.
