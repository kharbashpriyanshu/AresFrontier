import { SensorObservation } from "./sensorTypes.js";

export class ObservationStore {
  private static observations: SensorObservation[] = [];
  private static readonly MAX_OBSERVATIONS = 500;

  public static addObservation(obs: SensorObservation): void {
    this.observations.push(obs);
    if (this.observations.length > this.MAX_OBSERVATIONS) {
      this.observations.shift();
    }
  }

  public static addObservations(obsList: SensorObservation[]): void {
    obsList.forEach((o) => this.addObservation(o));
  }

  public static getObservations(limit: number = 50): SensorObservation[] {
    return this.observations.slice(-limit);
  }

  public static getAllObservations(): SensorObservation[] {
    return [...this.observations];
  }

  public static recordObservation(obs: SensorObservation): void {
    this.addObservation(obs);
  }

  public static getObservationsForAgent(agentId: string, limit: number = 20): SensorObservation[] {
    return this.observations.filter((o) => o.agentId === agentId).slice(-limit);
  }

  public static getObservationById(id: string): SensorObservation | undefined {
    return this.observations.find((o) => o.observationId === id);
  }

  public static clear(): void {
    this.observations = [];
  }
}
