import {
  MarsCoordinate,
  MarsBounds,
  LocationData,
  TerrainData,
  ScienceTarget,
  DataSourceInfo,
} from "../../types/index.js";

/**
 * Interface contract for NASA Planetary Data Providers.
 * Implementations wrap live USGS/NASA PDS/GIBS APIs or cached scientific datasets.
 */
export interface NASADataProvider {
  readonly id: string;
  readonly name: string;

  /**
   * Retrieves geological and terrain summary at a given Mars coordinate.
   */
  getLocationData(coordinate: MarsCoordinate): Promise<LocationData>;

  /**
   * Samples terrain elevation, slope, and roughness for a coordinate or route.
   */
  getTerrainData(coordinate: MarsCoordinate): Promise<TerrainData>;

  /**
   * Retrieves identified planetary science targets within bounding box or region.
   */
  getScienceTargets(bounds?: MarsBounds): Promise<ScienceTarget[]>;

  /**
   * Returns metadata and health status for this data provider.
   */
  getDataSourceInfo(): DataSourceInfo;
}
