"""
Planetary Science Knowledge Base for Mars
Codifies MEPAG 2020 goals, regional geological provinces, CRISM mineral units,
THEMIS thermal inertia distributions, and SHARAD/SWIM subsurface ice models.
"""

from typing import Dict, Any, List

MEPAG_GOALS = {
    "GOAL_I": {
        "title": "Goal I: Life",
        "description": "Determine if Mars ever supported life or hosts extant life today.",
        "investigations": [
            "Search for biosignatures and organic molecular preservation.",
            "Characterize ancient habitable environments (aqueous chemistry, redox couples, pH).",
            "Assess potential for modern subsurface habitable niches."
        ]
    },
    "GOAL_II": {
        "title": "Goal II: Climate",
        "description": "Understand the processes and history of climate on Mars.",
        "investigations": [
            "Reconstruct volatile reservoirs and polar layered deposit stratigraphy.",
            "Characterize atmospheric escape, photochemical cycles, and dust storm dynamics.",
            "Map seasonal $CO_2$ and $H_2O$ frost exchange."
        ]
    },
    "GOAL_III": {
        "title": "Goal III: Geology",
        "description": "Determine the origin and evolution of Mars as a geological system.",
        "investigations": [
            "Document crustal evolution, impact cratering chronology, and mantle differentiation.",
            "Characterize sedimentary, volcanic, and aqueous geochemical processes over time.",
            "Determine the magnetic, tectonic, and thermal evolution of the lithosphere."
        ]
    },
    "GOAL_IV": {
        "title": "Goal IV: Human Exploration Preparation",
        "description": "Obtain knowledge and test technologies to prepare for human missions.",
        "investigations": [
            "Identify and quantify accessible water-ice ISRU deposits within top 1-3 meters.",
            "Characterize toxic dust properties, perchlorates, and electrostatic risks.",
            "Characterize surface radiation environment and engineering terrain hazards."
        ]
    }
}

PROVINCES = [
    {
        "id": "jezero_crater",
        "name": "Jezero Crater",
        "lat_range": (18.0, 19.5),
        "lon_range": (76.5, 78.5),
        "geological_epoch": "Noachian-Hesperian Transition",
        "context": "Jezero Crater Western Delta fan and crater-floor olivine-carbonate cumulate unit.",
        "minerals": [
            {"name": "Mg-smectite clay", "category": "phyllosilicate", "formation": "Long-duration standing water", "relevance": "High biosignature preservation"},
            {"name": "Fe/Mg-carbonate", "category": "carbonate", "formation": "Neutral-to-alkaline aqueous carbonation", "relevance": "Carbon cycle and paleoclimate record"},
            {"name": "Olivine cumulate", "category": "mafic_silicate", "formation": "Igneous lake-floor lava lake or thick differentiated sill", "relevance": "Radiometric age dating"}
        ],
        "thermal_context": "Variable thermal inertia (320 - 550 SI): high-inertia lithified delta scarps vs low-inertia active eolian bedforms (Séítah sand dunes).",
        "scientific_value": "high",
        "explanation": "Prime astrobiological target. River delta deposited into ancient lake basin preserves organic biosignatures and provides sedimentary sequence across the Noachian-Hesperian boundary.",
        "sample_priorities": ["Delta bottomset mudstone", "Séítah olivine cumulate", "Carbonate fracture fill", "Crater rim mega-breccia"],
        "mepag_relevance": ["Goal I: Life (Habitability)", "Goal III: Geology (Sedimentary Record)", "Goal IV: Human Ops"],
        "ice_probability": 0.02,
        "sources": [
            "NASA Mars 2020 Science Team (JGR Planets 2021)",
            "Ehlmann et al. (Nature 2008) - Clay minerals in Jezero crater",
            "Murchie et al. (CRISM Investigation of Jezero, 2009)"
        ]
    },
    {
        "id": "gale_crater",
        "name": "Gale Crater & Mount Sharp",
        "lat_range": (-5.5, -4.0),
        "lon_range": (137.0, 138.8),
        "geological_epoch": "Hesperian",
        "context": "Aeolis Mons (Mount Sharp) layered sedimentary mound with stratified clay-bearing and sulfate-bearing units.",
        "minerals": [
            {"name": "Calcium & magnesium sulfate", "category": "sulfate", "formation": "Saline evaporative playa lakes", "relevance": "Environmental drying record"},
            {"name": "Crystalline hematite", "category": "iron_oxide", "formation": "Groundwater oxidation redox boundary", "relevance": "Redox gradients for microbial metabolism"},
            {"name": "Nontronite/Saponite clays", "category": "phyllosilicate", "formation": "Circum-neutral fluvio-lacustrine lakes", "relevance": "Preservation of organic molecules"}
        ],
        "thermal_context": "High-inertia bedrock pavements (~450 SI) mantled by wind-scoured dust streaks and basaltic sands (~220 SI).",
        "scientific_value": "high",
        "explanation": "Continuous stratigraphic record documenting the planetary transition from a warm, wet, habitable early Mars to an arid, cold, sulfate-rich desert.",
        "sample_priorities": ["Murray formation mudstone", "Vera Rubin hematite crest", "Sulfate-bearing layered strata"],
        "mepag_relevance": ["Goal I: Life", "Goal II: Climate Evolution", "Goal III: Geology"],
        "ice_probability": 0.01,
        "sources": [
            "Grotzinger et al. (Science 2014) - Habitable Fluvio-Lacustrine Environment at Gale",
            "MSL CheMin Instrument PDS Geosciences Archive",
            "Vasavada et al. (JGR 2014) - Overview of Curiosity Traverse"
        ]
    },
    {
        "id": "olympus_mons",
        "name": "Olympus Mons Caldera & Flanks",
        "lat_range": (15.0, 22.0),
        "lon_range": (-138.0, -128.0),
        "geological_epoch": "Amazonian",
        "context": "Solar system's largest shield volcano: basaltic lava flows, collapse caldera complexes, and peripheral aureole scarps.",
        "minerals": [
            {"name": "Tholeiitic basalt", "category": "mafic_silicate", "formation": "Low-viscosity effusive volcanism", "relevance": "Primary planetary mantle composition"},
            {"name": "Clinopyroxene & plagioclase", "category": "mafic_silicate", "formation": "Fractional crystallization", "relevance": "Magma chamber evolution"},
            {"name": "Palagonite rinds", "category": "iron_oxide", "formation": "Atmospheric weathering of glass", "relevance": "Volcanic gas-rock interaction"}
        ],
        "thermal_context": "Extremely low thermal inertia dust mantle (< 100 SI) on volcano upper slopes; exposed basaltic caldera scarps (> 600 SI).",
        "scientific_value": "medium",
        "explanation": "Premier window into Amazonian interior dynamics, long-lived stationary mantle plumes, and planetary geothermal history.",
        "sample_priorities": ["Caldera floor basalt pahoehoe flow", "Scarp collapse megabreccia", "Fumarolic sulfur alteration deposit"],
        "mepag_relevance": ["Goal III: Geology (Volcanology)", "Goal II: Climate (Outgassing)"],
        "ice_probability": 0.05,
        "sources": [
            "Plescia (Icarus 2004) - Morphometric properties of Olympus Mons calderas",
            "Mouginis-Mark et al. (Bull. Volcanol. 2007) - Volcanic history of Olympus Mons"
        ]
    },
    {
        "id": "valles_marineris",
        "name": "Valles Marineris (Melas / Candor Chasma)",
        "lat_range": (-12.0, -4.0),
        "lon_range": (-80.0, -65.0),
        "geological_epoch": "Hesperian",
        "context": "Vast rift canyon system exposing 8 km of crustal stratigraphy, interior layered deposits (ILDs), and landslide scars.",
        "minerals": [
            {"name": "Polyhydrated sulfates", "category": "sulfate", "formation": "Groundwater-fed lake basins or hydrothermal spring mounds", "relevance": "Subsurface hydrology"},
            {"name": "Kieserite & Gypsum", "category": "sulfate", "formation": "Evaporative drawdown", "relevance": "Salinity limits for life"},
            {"name": "Basaltic canyon walls", "category": "mafic_silicate", "formation": "Ancient crustal lava accumulation", "relevance": "Noachian crustal basement"}
        ],
        "thermal_context": "High-contrast thermal inertia: bare canyon bedrock scarps (500-700 SI) vs talus slopes (280 SI).",
        "scientific_value": "high",
        "explanation": "Massive tectonic rift cuts deep into Martian crust, revealing interior layered deposits, potential ancient groundwater aquifers, and recent slope dynamics.",
        "sample_priorities": ["Interior layered sulfate deposit", "Deep crustal canyon wall basalt", "Talus scarp deposit"],
        "mepag_relevance": ["Goal III: Geology (Tectonics)", "Goal I: Life (Deep Biosphere)", "Goal IV: Human Ops"],
        "ice_probability": 0.08,
        "sources": [
            "Lucchitta et al. (JGR 1994) - Geology of Valles Marineris",
            "Mangold et al. (Icarus 2008) - Stratigraphy of interior layered deposits in Candor Chasma"
        ]
    },
    {
        "id": "oxia_planum",
        "name": "Oxia Planum",
        "lat_range": (17.5, 19.0),
        "lon_range": (-25.0, -23.0),
        "geological_epoch": "Noachian",
        "context": "ExoMars landing site: widespread Fe/Mg phyllosilicate plains covered by a volcanic cap unit and delta deposits.",
        "minerals": [
            {"name": "Fe/Mg-rich vermiculite/smectite", "category": "phyllosilicate", "formation": "Pervasive aqueous alteration of basalt", "relevance": "Oldest habitable aqueous period"},
            {"name": "Silica-rich alteration", "category": "phyllosilicate", "formation": "Hydrothermal or pedogenic weathering", "relevance": "Subsurface fluid flow"}
        ],
        "thermal_context": "Moderate thermal inertia (280 - 380 SI) characteristic of clay-rich bedrock with variable sand cover.",
        "scientific_value": "high",
        "explanation": "One of the most extensive exposures of ancient Noachian clay bedrock on Mars, offering pristine taphonomic windows for micro-fossil preservation.",
        "sample_priorities": ["Noachian clay bedrock core", "Capping unit basalt", "Inflow fan sediments"],
        "mepag_relevance": ["Goal I: Life", "Goal III: Geology"],
        "ice_probability": 0.03,
        "sources": [
            "Quantin-Nataf et al. (Astrobiology 2021) - Oxia Planum: The Landing Site for ExoMars 2022",
            "Carter et al. (LPSC 2019) - Phyllosilicates at Oxia Planum"
        ]
    },
    {
        "id": "utopia_planitia",
        "name": "Utopia Planitia",
        "lat_range": (40.0, 50.0),
        "lon_range": (105.0, 120.0),
        "geological_epoch": "Amazonian",
        "context": "Northern plains impact basin containing massive subsurface water-ice deposits and scalloped depression topography.",
        "minerals": [
            {"name": "Dust-mantled basalt", "category": "mafic_silicate", "formation": "Lowland basin floor basalt", "relevance": "Northern plains volcanic stratigraphy"},
            {"name": "Subsurface water-ice sheet", "category": "evaporite", "formation": "Snow accumulation during high-obliquity orbital periods", "relevance": "ISRU water resource and climate archive"}
        ],
        "thermal_context": "Uniform moderate-to-low thermal inertia (~200 SI) indicating thick mantling regolith with icy substrate.",
        "scientific_value": "high",
        "explanation": "Primary mid-latitude water resource location. SHARAD radar observations indicate excess subsurface water-ice sheet up to 170 meters thick beneath 1-10 meters of regolith lag.",
        "sample_priorities": ["Glacial ice core", "Periglacial sublimation lag regolith", "Polygonal ground fracture fill"],
        "mepag_relevance": ["Goal IV: Human Exploration (Water ISRU)", "Goal II: Climate (Glaciation)", "Goal I: Life"],
        "ice_probability": 0.94,
        "sources": [
            "Stuurman et al. (GRL 2016) - SHARAD detection of massive subsurface water ice in Utopia Planitia",
            "Bramson et al. (GRL 2015) - Widespread excess ice in Arcadia Planitia"
        ]
    }
]


def find_matching_province(lat: float, lon: float) -> Dict[str, Any] | None:
    # Normalize longitude to -180 to 180
    norm_lon = ((lon + 180.0) % 360.0) - 180.0

    for prov in PROVINCES:
        min_lat, max_lat = prov["lat_range"]
        min_lon, max_lon = prov["lon_range"]
        if min_lat <= lat <= max_lat:
            # Handle longitude ranges
            if min_lon <= norm_lon <= max_lon:
                return prov
            # Also check if province defined in 0-360 range
            pos_lon = lon % 360.0
            if min_lon <= pos_lon <= max_lon:
                return prov

    return None

