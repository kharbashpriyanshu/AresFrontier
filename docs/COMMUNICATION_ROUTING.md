# Planetary Communication & Tactical Packet Routing

## 1. Multi-Tier Telecommunications Topology
Communication across the Jezero operations theater operates through a multi-tier tactical mesh:
1. **Tier 1 (Surface Line-of-Sight UHF)**: Direct agent-to-agent radio links over Jezero terrain floor, bounded by topographic obstructions and antenna mast height.
   - `ROVER-03 RELAY` features an elevated 5.0m antenna mast extending line of sight up to 12.0 km.
   - Rover standard masts are 2.0m tall with nominal 6.0 km reach.
2. **Tier 2 (Orbital X-Band Relay)**: Downlink to MRO orbiter during active pass windows (2048 kbps).
3. **Tier 3 (Deep Space Network Earth MCC)**: 12 to 24 minute light-time delay link via orbiter relay.

## 2. Priority Telemetry Buffering
When orbital passes expire, all non-local packets are buffered in `CommunicationQueueService`:
- `CRITICAL`: Hazard warnings, emergency stops, astronaut biometrics. Dispatched first immediately upon pass reacquisition.
- `HIGH`: Real-time telemetry, trajectory changes.
- `MEDIUM`: Pathing status, power profiles.
- `BULK`: In-situ high-resolution Raman spectral cubes and HazCam panoramic point clouds.
