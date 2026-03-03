export type EnvironmentPropType =
  | 'tall_grass'
  | 'tree'
  | 'rock'
  | 'berry_bush'
  | 'center_wall'
  | 'fence'
  | 'building'
  | 'road';

export interface EnvironmentProp {
  id: string;
  type: EnvironmentPropType;
  position: [number, number, number];
  rotationY: number;
  size: [number, number, number];
  color: string;
}

export const ENVIRONMENT_PROPS: EnvironmentProp[] = [];
