export interface TimelineEvent {
  id: string;
  missionTimeMin: number;
  timeLabel: string;
  title: string;
  agentCallsign: string;
  category: "EVA" | "ROVER" | "COMMS" | "HAZARD" | "SCIENCE" | "COMMAND";
  status: "UPCOMING" | "IN_PROGRESS" | "COMPLETED" | "DELAYED" | "CANCELLED";
  description: string;
}

export class MissionTimelineEngine {
  private static events: TimelineEvent[] = [
    {
      id: "tl-01",
      missionTimeMin: 0,
      timeLabel: "00:00",
      title: "EVA Ingress & Systems Check",
      agentCallsign: "ASTRONAUT-01",
      category: "EVA",
      status: "COMPLETED",
      description: "Astronaut airlock depressurization and suit consumable telemetry lock.",
    },
    {
      id: "tl-02",
      missionTimeMin: 18,
      timeLabel: "00:18",
      title: "Scout Rover Autonomous Deployment",
      agentCallsign: "ROVER-01 SCOUT",
      category: "ROVER",
      status: "COMPLETED",
      description: "ROVER-01 departs Octavia E. Butler site 1.5 km ahead along delta approach line.",
    },
    {
      id: "tl-03",
      missionTimeMin: 35,
      timeLabel: "00:35",
      title: "Tactical Relay Elevation Lock",
      agentCallsign: "ROVER-03 RELAY",
      category: "COMMS",
      status: "IN_PROGRESS",
      description: "ROVER-03 establishes elevated UHF relay position on Northern Knoll.",
    },
    {
      id: "tl-04",
      missionTimeMin: 55,
      timeLabel: "00:55",
      title: "Forward Hazard Reconnaissance",
      agentCallsign: "ROVER-01 SCOUT",
      category: "HAZARD",
      status: "UPCOMING",
      description: "Scan Kodiak Butte scarp margin for loose talus and slope instability.",
    },
    {
      id: "tl-05",
      missionTimeMin: 85,
      timeLabel: "01:25",
      title: "Primary Deltaic Outcrop Sample Drill",
      agentCallsign: "ROVER-02 SCIENCE",
      category: "SCIENCE",
      status: "UPCOMING",
      description: "Conduct abrasion and Raman spectroscopy on layered clay sediment.",
    },
    {
      id: "tl-06",
      missionTimeMin: 112,
      timeLabel: "01:52",
      title: "MRO-Relay High Bandwidth Orbital Window",
      agentCallsign: "ORBITER-01",
      category: "COMMS",
      status: "UPCOMING",
      description: "16-minute pass window for transmitting raw spectral cubes to Mission Control.",
    },
    {
      id: "tl-07",
      missionTimeMin: 180,
      timeLabel: "03:00",
      title: "Mandatory Return Ingress Window",
      agentCallsign: "ASTRONAUT-01",
      category: "COMMAND",
      status: "UPCOMING",
      description: "Enforce NASA 30-minute safety return margin at base habitat.",
    },
  ];

  public static getTimeline(): TimelineEvent[] {
    return this.events;
  }

  public static updateEventStatus(eventId: string, status: TimelineEvent["status"]): void {
    const ev = this.events.find((e) => e.id === eventId);
    if (ev) {
      ev.status = status;
    }
  }

  public static advanceSimulationTimeline(elapsedMinutes: number): void {
    this.events.forEach((ev) => {
      if (elapsedMinutes >= ev.missionTimeMin + 30) {
        ev.status = "COMPLETED";
      } else if (elapsedMinutes >= ev.missionTimeMin) {
        ev.status = "IN_PROGRESS";
      } else {
        ev.status = "UPCOMING";
      }
    });
  }

  public static reset(): void {
    this.events[0].status = "COMPLETED";
    this.events[1].status = "COMPLETED";
    this.events[2].status = "IN_PROGRESS";
    for (let i = 3; i < this.events.length; i++) {
      this.events[i].status = "UPCOMING";
    }
  }
}
