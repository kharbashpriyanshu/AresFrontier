import { PlanetaryAgent, RoverAgent, OrbiterAgent, AstronautAgent } from "./agentTypes.js";
import { ProvenanceService } from "../planetary/provenanceService.js";

/**
 * Planetary Multi-Agent Registry
 * Stores and initializes calibrated simulation agents for Mars surface field operations.
 */
export class AgentRegistry {
  private static agents: Map<string, PlanetaryAgent> = new Map();
  private static initialized: boolean = false;

  public static initializeDefaultAgents(): void {
    if (this.initialized) return;

    // 1. Crew Astronaut
    const astronaut: AstronautAgent = {
      id: "agent-astronaut-01",
      name: "Astronaut Alex Vance (Commander)",
      callsign: "ASTRONAUT-01",
      type: "ASTRONAUT",
      status: "EXECUTING",
      position: { latitude: 18.4447, longitude: 77.4508 }, // Octavia E. Butler Landing Site
      capabilities: ["PRESSURE_SUIT", "EMERGENCY_SUPPORT", "TERRAIN_RECON"],
      structuredCapabilities: {
        mobility: { maxSlopeDeg: 20.0, speedKph: 3.2, maxRangeKm: 8.0, roughnessTolerance: 0.65 },
        scientificInstruments: ["Handheld XRF Gun", "Geological Hammer", "High-Resolution Hazcam"],
        hasDrill: false,
        hasSpectrometer: true,
        hasLidar: false,
        sampleTubeCapacity: 4,
        sampleTubesRemaining: 4,
        communicationRelay: { isRelay: false, relayRangeKm: 1.0, relayBandwidthKbps: 256 },
        resourceCapacityWh: 1200,
        enduranceMinutes: 240,
      },
      suitType: "xEMU_PLANETARY",
      suitOxygenReserveMinutes: 240,
      maxContinuousEVAMinutes: 360,
      metabolicEnergyWatts: 280,
      safeStandbyLocation: { latitude: 18.4447, longitude: 77.4508 },
      telemetry: {
        batteryPercent: 92,
        batteryStatus: "GREEN",
        speedKph: 2.8,
        headingDeg: 285,
        internalTempC: 20.5,
        signalStrengthPercent: 95,
        lineOfSightToRelay: true,
        energyConsumptionRateWhPerKm: 120,
        suitOxygenPercent: 88,
        heartRateBpm: 110,
        lastHeartbeat: new Date().toISOString(),
      },
      lastUpdated: new Date().toISOString(),
      provenance: ProvenanceService.createDerivedProvenance(
        "Astronaut Telemetry Model",
        ["Apollo Lunar EVA Telemetry", "xEMU Metabolic Standard"],
        "Deterministic Biomechanical Simulation"
      ),
    };

    // 2. ROVER-01 (SCOUT)
    const scoutRover: RoverAgent = {
      id: "agent-rover-01",
      name: "Ares Scout Rover (Reconnaissance)",
      callsign: "ROVER-01 SCOUT",
      type: "ROVER",
      profileRole: "SCOUT",
      status: "EXECUTING",
      position: { latitude: 18.4485, longitude: 77.432 }, // 1.2 km ahead on Jezero delta approach
      capabilities: ["TERRAIN_RECON", "HIGH_SPEED_DRIVE", "EMERGENCY_SUPPORT"],
      structuredCapabilities: {
        mobility: { maxSlopeDeg: 20.0, speedKph: 4.8, maxRangeKm: 25.0, roughnessTolerance: 0.88 },
        scientificInstruments: ["Terrain Laser Scanner", "Forward Hazard Hazcams", "Slip Odometry"],
        hasDrill: false,
        hasSpectrometer: false,
        hasLidar: true,
        sampleTubeCapacity: 0,
        sampleTubesRemaining: 0,
        communicationRelay: { isRelay: false, relayRangeKm: 6.0, relayBandwidthKbps: 512 },
        resourceCapacityWh: 2400,
        enduranceMinutes: 480,
      },
      maxRangeKm: 25,
      speedKph: 4.8,
      communicationRangeKm: 6.0,
      scientificPayloads: ["Terrain Laser Scanner", "Forward Hazard Hazcams", "Slip Odometry"],
      mobilityRating: 0.88,
      hazardTolerance: 20.0, // Tolerates up to 20° slope before mandatory pause
      batteryCapacityWh: 2400,
      currentBatteryWh: 2040,
      telemetry: {
        batteryPercent: 85,
        batteryStatus: "GREEN",
        speedKph: 4.2,
        headingDeg: 275,
        internalTempC: -15,
        signalStrengthPercent: 90,
        lineOfSightToRelay: true,
        activeRelayId: "agent-rover-03",
        energyConsumptionRateWhPerKm: 95,
        lastHeartbeat: new Date().toISOString(),
      },
      currentTask: {
        id: "task-scout-recon-01",
        agentId: "agent-rover-01",
        taskType: "VERIFY_ROUTE",
        priority: "HIGH",
        name: "Delta Front Scarp Traverse Reconnaissance",
        target: {
          coordinate: { latitude: 18.455, longitude: 77.41 },
          description: "Inspect slope stability along Kodiak Butte northern corridor",
        },
        estimatedDurationMin: 45,
        requiredBatteryPercent: 18,
        requiredCommunication: true,
        riskLevel: "MODERATE",
        status: "IN_PROGRESS",
      },
      lastUpdated: new Date().toISOString(),
      provenance: ProvenanceService.createDerivedProvenance(
        "Scout Autonomous Vehicle Model",
        ["Mars 2020 AutoNav Telemetry", "JPL Rocker-Bogie Dynamics"],
        "Deterministic Surface Traverse Simulation"
      ),
    };

    // 3. ROVER-02 (SCIENCE)
    const scienceRover: RoverAgent = {
      id: "agent-rover-02",
      name: "Ares Mineralogy & Sample Rover",
      callsign: "ROVER-02 SCIENCE",
      type: "ROVER",
      profileRole: "SCIENCE",
      status: "PLANNING",
      position: { latitude: 18.445, longitude: 77.44 },
      capabilities: ["SPECTROMETER", "SAMPLE_DRILL"],
      structuredCapabilities: {
        mobility: { maxSlopeDeg: 14.0, speedKph: 2.5, maxRangeKm: 15.0, roughnessTolerance: 0.72 },
        scientificInstruments: ["Deep UV Raman Spectrometer (SHERLOC)", "X-Ray Fluorescence (PIXL)", "Abrasion Rotary Core Drill"],
        hasDrill: true,
        hasSpectrometer: true,
        hasLidar: false,
        sampleTubeCapacity: 15,
        sampleTubesRemaining: 12,
        communicationRelay: { isRelay: false, relayRangeKm: 5.0, relayBandwidthKbps: 1024 },
        resourceCapacityWh: 3200,
        enduranceMinutes: 360,
      },
      maxRangeKm: 15,
      speedKph: 2.2,
      communicationRangeKm: 5.0,
      scientificPayloads: ["Deep UV Raman Spectrometer", "Abrasion Rotary Core Drill", "Micro-Imaging Camera"],
      mobilityRating: 0.72,
      hazardTolerance: 14.0,
      batteryCapacityWh: 3200,
      currentBatteryWh: 2880,
      telemetry: {
        batteryPercent: 90,
        batteryStatus: "GREEN",
        speedKph: 1.8,
        headingDeg: 260,
        internalTempC: -10,
        signalStrengthPercent: 92,
        lineOfSightToRelay: true,
        activeRelayId: "agent-rover-03",
        energyConsumptionRateWhPerKm: 160,
        lastHeartbeat: new Date().toISOString(),
      },
      lastUpdated: new Date().toISOString(),
      provenance: ProvenanceService.createDerivedProvenance(
        "Science Rover Model",
        ["Perseverance Science Payload Specs", "CheMin / PIXL Documentation"],
        "Deterministic Instrument Simulation"
      ),
    };

    // 4. ROVER-03 (RELAY)
    const relayRover: RoverAgent = {
      id: "agent-rover-03",
      name: "Ares Telemetry & Tactical Relay",
      callsign: "ROVER-03 RELAY",
      type: "ROVER",
      profileRole: "RELAY",
      status: "EXECUTING",
      position: { latitude: 18.446, longitude: 77.445 }, // Elevated knoll providing unobstructed line of sight
      capabilities: ["COMM_RELAY", "EMERGENCY_SUPPORT"],
      structuredCapabilities: {
        mobility: { maxSlopeDeg: 15.0, speedKph: 3.5, maxRangeKm: 18.0, roughnessTolerance: 0.78 },
        scientificInstruments: ["Electra UHF Relay Mast", "Emergency Radio Beacon", "Mastcam"],
        hasDrill: false,
        hasSpectrometer: false,
        hasLidar: false,
        sampleTubeCapacity: 0,
        sampleTubesRemaining: 0,
        communicationRelay: { isRelay: true, relayRangeKm: 12.0, relayBandwidthKbps: 4096 },
        resourceCapacityWh: 4000,
        enduranceMinutes: 720,
      },
      maxRangeKm: 18,
      speedKph: 3.2,
      communicationRangeKm: 12.0, // High-gain mast antenna
      scientificPayloads: ["Ultra-High Frequency (UHF) Electra Relay Mast", "Emergency Radio Beacon"],
      mobilityRating: 0.78,
      hazardTolerance: 15.0,
      batteryCapacityWh: 4000,
      currentBatteryWh: 3520,
      telemetry: {
        batteryPercent: 88,
        batteryStatus: "GREEN",
        speedKph: 0.0, // Stationary on elevated knoll
        headingDeg: 0,
        internalTempC: -12,
        signalStrengthPercent: 98,
        lineOfSightToRelay: true,
        energyConsumptionRateWhPerKm: 80,
        lastHeartbeat: new Date().toISOString(),
      },
      lastUpdated: new Date().toISOString(),
      provenance: ProvenanceService.createDerivedProvenance(
        "Relay Rover Model",
        ["Electra UHF Transceiver Specs", "Line-of-Sight Waveguide Propagation"],
        "Radio Wave Propagation Model"
      ),
    };

    // 5. ORBITER-01 (RELAY)
    const orbiter: OrbiterAgent = {
      id: "agent-orbiter-01",
      name: "Mars Reconnaissance Relay Orbiter (MRO-Relay)",
      callsign: "ORBITER-01",
      type: "ORBITER",
      status: "EXECUTING",
      position: { latitude: 18.44, longitude: 77.45 },
      capabilities: ["COMM_RELAY", "ORBITAL_IMAGERY"],
      structuredCapabilities: {
        mobility: { maxSlopeDeg: 0, speedKph: 12400, maxRangeKm: 100000, roughnessTolerance: 1.0 },
        scientificInstruments: ["HiRISE 0.25m Stereo Camera", "CRISM Infrared Spectrometer", "SHARAD Sounding Radar"],
        hasDrill: false,
        hasSpectrometer: true,
        hasLidar: true,
        sampleTubeCapacity: 0,
        sampleTubesRemaining: 0,
        communicationRelay: { isRelay: true, relayRangeKm: 850.0, relayBandwidthKbps: 2048 },
        resourceCapacityWh: 15000,
        enduranceMinutes: 60000,
      },
      orbitalAltitudeKm: 320,
      inclinationDeg: 92.8,
      orbitalPeriodMinutes: 112,
      coverageRadiusKm: 850,
      bandwidthKbps: 2048,
      nextPassWindowStart: new Date(Date.now() + 18 * 60 * 1000).toISOString(), // 18 mins away
      nextPassDurationMinutes: 14,
      telemetry: {
        batteryPercent: 96,
        batteryStatus: "GREEN",
        speedKph: 12400,
        headingDeg: 180,
        internalTempC: 15,
        signalStrengthPercent: 100,
        lineOfSightToRelay: true,
        energyConsumptionRateWhPerKm: 0,
        lastHeartbeat: new Date().toISOString(),
      },
      lastUpdated: new Date().toISOString(),
      provenance: ProvenanceService.createDerivedProvenance(
        "MRO Orbital Relay Model",
        ["NASA Deep Space Network Relays", "MRO Sun-Synchronous Orbit Elements"],
        "Two-Body Keplerian Orbit Approximation"
      ),
    };

    this.agents.set(astronaut.id, astronaut);
    this.agents.set(scoutRover.id, scoutRover);
    this.agents.set(scienceRover.id, scienceRover);
    this.agents.set(relayRover.id, relayRover);
    this.agents.set(orbiter.id, orbiter);
    this.initialized = true;
  }

  public static getAllAgents(): PlanetaryAgent[] {
    this.initializeDefaultAgents();
    return Array.from(this.agents.values());
  }

  public static getAgentById(id: string): PlanetaryAgent | undefined {
    this.initializeDefaultAgents();
    return this.agents.get(id);
  }

  public static updateAgent(agent: PlanetaryAgent): void {
    this.initializeDefaultAgents();
    agent.lastUpdated = new Date().toISOString();
    this.agents.set(agent.id, agent);
  }

  public static resetAgents(): void {
    this.agents.clear();
    this.initialized = false;
    this.initializeDefaultAgents();
  }
}
