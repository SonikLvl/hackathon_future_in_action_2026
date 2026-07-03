import type { ScenarioFrame } from "@/features/demo/types";

const PEDESTRIAN_LAT = 50.45;
const PEDESTRIAN_LON = 30.5234;

export const scooterApproachScenario: ScenarioFrame[] = [
  {
    label: "Кадр 1",
    description: "Самокат поза зоною тривоги.",
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
    label: "Кадр 2",
    description: "Самокат наближається.",
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
    label: "Кадр 3",
    description: "Самокат заходить у зону ризику.",
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
    label: "Кадр 4",
    description: "Самокат зовсім близько. Браслет має спрацювати.",
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