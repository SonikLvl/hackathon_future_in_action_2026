import type { ScenarioFrame } from "@/features/demo/types";

const PEDESTRIAN_LAT = 50.45;
const PEDESTRIAN_LON = 30.5234;

export const scooterApproachScenario: ScenarioFrame[] = [
  {
    label: "Frame 1",
    description: "Scooter is outside the alert zone.",
    distanceMeters: 40,
    pedestrian: {
      device_id: "pedestrian_1",
      is_pedestrian: true,
      lat: PEDESTRIAN_LAT,
      lon: PEDESTRIAN_LON,
      speed: 1,
      azimuth: 0,
    },
    vehicle: {
      device_id: "scooter_1",
      is_pedestrian: false,
      lat: 50.45036,
      lon: PEDESTRIAN_LON,
      speed: 5,
      azimuth: 180,
    },
  },
  {
    label: "Frame 2",
    description: "Scooter is getting closer.",
    distanceMeters: 27,
    pedestrian: {
      device_id: "pedestrian_1",
      is_pedestrian: true,
      lat: PEDESTRIAN_LAT,
      lon: PEDESTRIAN_LON,
      speed: 1,
      azimuth: 0,
    },
    vehicle: {
      device_id: "scooter_1",
      is_pedestrian: false,
      lat: 50.45024,
      lon: PEDESTRIAN_LON,
      speed: 5,
      azimuth: 180,
    },
  },
  {
    label: "Frame 3",
    description: "Scooter enters the risk zone.",
    distanceMeters: 13,
    pedestrian: {
      device_id: "pedestrian_1",
      is_pedestrian: true,
      lat: PEDESTRIAN_LAT,
      lon: PEDESTRIAN_LON,
      speed: 1,
      azimuth: 0,
    },
    vehicle: {
      device_id: "scooter_1",
      is_pedestrian: false,
      lat: 50.45012,
      lon: PEDESTRIAN_LON,
      speed: 5,
      azimuth: 180,
    },
  },
  {
    label: "Frame 4",
    description: "Scooter is very close. Bracelet should alert.",
    distanceMeters: 6,
    pedestrian: {
      device_id: "pedestrian_1",
      is_pedestrian: true,
      lat: PEDESTRIAN_LAT,
      lon: PEDESTRIAN_LON,
      speed: 1,
      azimuth: 0,
    },
    vehicle: {
      device_id: "scooter_1",
      is_pedestrian: false,
      lat: 50.45005,
      lon: PEDESTRIAN_LON,
      speed: 5,
      azimuth: 180,
    },
  },
];
