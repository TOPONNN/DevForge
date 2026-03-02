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

const TALL_GRASS_PROPS: EnvironmentProp[] = [
  { id: 'grass-1', type: 'tall_grass', position: [-24, 0.65, -16], rotationY: 0.1, size: [3.2, 1.3, 2.6], color: '#2B9348' },
  { id: 'grass-2', type: 'tall_grass', position: [-4, 0.65, -24], rotationY: 0.15, size: [3.6, 1.3, 2.4], color: '#2B9348' },
  { id: 'grass-3', type: 'tall_grass', position: [15, 0.65, -18], rotationY: -0.2, size: [2.9, 1.3, 2.2], color: '#2B9348' },
  { id: 'grass-4', type: 'tall_grass', position: [-17, 0.65, 13], rotationY: 0.3, size: [3.3, 1.3, 2.8], color: '#2B9348' },
  { id: 'grass-5', type: 'tall_grass', position: [5, 0.65, 21], rotationY: -0.1, size: [3, 1.3, 2.3], color: '#2B9348' },
  { id: 'grass-6', type: 'tall_grass', position: [24, 0.65, 8], rotationY: 0.22, size: [2.8, 1.3, 2.5], color: '#2B9348' },
  { id: 'grass-7', type: 'tall_grass', position: [-60, 0.65, -45], rotationY: 0.2, size: [3.8, 1.3, 2.8], color: '#238636' },
  { id: 'grass-8', type: 'tall_grass', position: [-52, 0.65, -28], rotationY: -0.25, size: [3.2, 1.3, 2.5], color: '#2B9348' },
  { id: 'grass-9', type: 'tall_grass', position: [-58, 0.65, 12], rotationY: 0.1, size: [3.5, 1.3, 2.8], color: '#2F9E44' },
  { id: 'grass-10', type: 'tall_grass', position: [-46, 0.65, 36], rotationY: 0.35, size: [3.4, 1.3, 2.7], color: '#2B9348' },
  { id: 'grass-11', type: 'tall_grass', position: [-30, 0.65, -55], rotationY: 0.4, size: [3.3, 1.3, 2.4], color: '#2B9348' },
  { id: 'grass-12', type: 'tall_grass', position: [-18, 0.65, 48], rotationY: -0.18, size: [3.2, 1.3, 2.9], color: '#2F9E44' },
  { id: 'grass-13', type: 'tall_grass', position: [20, 0.65, -58], rotationY: 0.12, size: [3.7, 1.3, 2.6], color: '#238636' },
  { id: 'grass-14', type: 'tall_grass', position: [34, 0.65, -42], rotationY: -0.35, size: [3.4, 1.3, 2.7], color: '#2B9348' },
  { id: 'grass-15', type: 'tall_grass', position: [45, 0.65, -20], rotationY: 0.26, size: [3.3, 1.3, 2.6], color: '#2B9348' },
  { id: 'grass-16', type: 'tall_grass', position: [56, 0.65, 10], rotationY: 0.08, size: [3.5, 1.3, 2.5], color: '#2F9E44' },
  { id: 'grass-17', type: 'tall_grass', position: [50, 0.65, 35], rotationY: -0.2, size: [3.6, 1.3, 2.9], color: '#2B9348' },
  { id: 'grass-18', type: 'tall_grass', position: [36, 0.65, 56], rotationY: 0.22, size: [3.8, 1.3, 2.8], color: '#2F9E44' },
  { id: 'grass-19', type: 'tall_grass', position: [8, 0.65, 60], rotationY: -0.12, size: [3.3, 1.3, 2.6], color: '#2B9348' },
  { id: 'grass-20', type: 'tall_grass', position: [-14, 0.65, 58], rotationY: 0.16, size: [3.5, 1.3, 2.7], color: '#2B9348' },
  { id: 'grass-21', type: 'tall_grass', position: [-38, 0.65, 54], rotationY: 0.19, size: [3.7, 1.3, 2.8], color: '#238636' },
  { id: 'grass-22', type: 'tall_grass', position: [-64, 0.65, 30], rotationY: -0.28, size: [3.4, 1.3, 2.5], color: '#2B9348' },
  { id: 'grass-23', type: 'tall_grass', position: [62, 0.65, -40], rotationY: 0.32, size: [3.5, 1.3, 2.7], color: '#2F9E44' },
  { id: 'grass-24', type: 'tall_grass', position: [66, 0.65, 52], rotationY: -0.15, size: [3.9, 1.3, 2.9], color: '#238636' },
];

const TREE_PROPS: EnvironmentProp[] = [
  { id: 'tree-1', type: 'tree', position: [-30, 1.7, -28], rotationY: 0, size: [0.9, 3.4, 0.9], color: '#7F5539' },
  { id: 'tree-2', type: 'tree', position: [-12, 1.8, -30], rotationY: 0, size: [0.8, 3.6, 0.8], color: '#7F5539' },
  { id: 'tree-3', type: 'tree', position: [16, 1.7, -28], rotationY: 0, size: [0.85, 3.5, 0.85], color: '#7F5539' },
  { id: 'tree-4', type: 'tree', position: [30, 1.8, -16], rotationY: 0, size: [0.82, 3.6, 0.82], color: '#7F5539' },
  { id: 'tree-5', type: 'tree', position: [28, 1.8, 14], rotationY: 0, size: [0.88, 3.6, 0.88], color: '#7F5539' },
  { id: 'tree-6', type: 'tree', position: [6, 1.7, 30], rotationY: 0, size: [0.85, 3.4, 0.85], color: '#7F5539' },
  { id: 'tree-7', type: 'tree', position: [-18, 1.8, 30], rotationY: 0, size: [0.86, 3.6, 0.86], color: '#7F5539' },
  { id: 'tree-8', type: 'tree', position: [-30, 1.8, 16], rotationY: 0, size: [0.8, 3.6, 0.8], color: '#7F5539' },
  { id: 'tree-9', type: 'tree', position: [-68, 1.8, -62], rotationY: 0, size: [0.86, 3.7, 0.86], color: '#6F4518' },
  { id: 'tree-10', type: 'tree', position: [-54, 1.8, -66], rotationY: 0, size: [0.9, 3.8, 0.9], color: '#6F4518' },
  { id: 'tree-11', type: 'tree', position: [-40, 1.8, -60], rotationY: 0, size: [0.85, 3.6, 0.85], color: '#7F5539' },
  { id: 'tree-12', type: 'tree', position: [-22, 1.8, -64], rotationY: 0, size: [0.82, 3.5, 0.82], color: '#7F5539' },
  { id: 'tree-13', type: 'tree', position: [-6, 1.8, -58], rotationY: 0, size: [0.88, 3.7, 0.88], color: '#7F5539' },
  { id: 'tree-14', type: 'tree', position: [18, 1.8, -66], rotationY: 0, size: [0.9, 3.8, 0.9], color: '#6F4518' },
  { id: 'tree-15', type: 'tree', position: [34, 1.8, -62], rotationY: 0, size: [0.84, 3.5, 0.84], color: '#7F5539' },
  { id: 'tree-16', type: 'tree', position: [52, 1.8, -58], rotationY: 0, size: [0.86, 3.6, 0.86], color: '#7F5539' },
  { id: 'tree-17', type: 'tree', position: [66, 1.8, -44], rotationY: 0, size: [0.88, 3.7, 0.88], color: '#6F4518' },
  { id: 'tree-18', type: 'tree', position: [70, 1.8, -24], rotationY: 0, size: [0.86, 3.6, 0.86], color: '#7F5539' },
  { id: 'tree-19', type: 'tree', position: [68, 1.8, -6], rotationY: 0, size: [0.84, 3.5, 0.84], color: '#7F5539' },
  { id: 'tree-20', type: 'tree', position: [72, 1.8, 20], rotationY: 0, size: [0.9, 3.8, 0.9], color: '#6F4518' },
  { id: 'tree-21', type: 'tree', position: [64, 1.8, 40], rotationY: 0, size: [0.86, 3.6, 0.86], color: '#7F5539' },
  { id: 'tree-22', type: 'tree', position: [58, 1.8, 62], rotationY: 0, size: [0.85, 3.5, 0.85], color: '#7F5539' },
  { id: 'tree-23', type: 'tree', position: [36, 1.8, 70], rotationY: 0, size: [0.88, 3.7, 0.88], color: '#6F4518' },
  { id: 'tree-24', type: 'tree', position: [14, 1.8, 72], rotationY: 0, size: [0.84, 3.5, 0.84], color: '#7F5539' },
  { id: 'tree-25', type: 'tree', position: [-10, 1.8, 70], rotationY: 0, size: [0.88, 3.7, 0.88], color: '#7F5539' },
  { id: 'tree-26', type: 'tree', position: [-28, 1.8, 66], rotationY: 0, size: [0.9, 3.8, 0.9], color: '#6F4518' },
  { id: 'tree-27', type: 'tree', position: [-46, 1.8, 70], rotationY: 0, size: [0.86, 3.6, 0.86], color: '#7F5539' },
  { id: 'tree-28', type: 'tree', position: [-64, 1.8, 60], rotationY: 0, size: [0.84, 3.5, 0.84], color: '#7F5539' },
  { id: 'tree-29', type: 'tree', position: [-70, 1.8, 40], rotationY: 0, size: [0.88, 3.7, 0.88], color: '#6F4518' },
  { id: 'tree-30', type: 'tree', position: [-72, 1.8, 18], rotationY: 0, size: [0.9, 3.8, 0.9], color: '#6F4518' },
  { id: 'tree-31', type: 'tree', position: [-70, 1.8, -8], rotationY: 0, size: [0.86, 3.6, 0.86], color: '#7F5539' },
  { id: 'tree-32', type: 'tree', position: [-66, 1.8, -30], rotationY: 0, size: [0.85, 3.5, 0.85], color: '#7F5539' },
];

const ROCK_PROPS: EnvironmentProp[] = [
  { id: 'rock-1', type: 'rock', position: [-13, 0.8, 2], rotationY: 0.3, size: [2.1, 1.4, 1.5], color: '#ADB5BD' },
  { id: 'rock-2', type: 'rock', position: [14, 0.9, -6], rotationY: -0.25, size: [2.4, 1.6, 1.8], color: '#9AA1A9' },
  { id: 'rock-3', type: 'rock', position: [1, 0.75, 12], rotationY: 0.12, size: [1.9, 1.3, 1.4], color: '#B6BDC5' },
  { id: 'rock-4', type: 'rock', position: [-58, 0.8, -14], rotationY: 0.2, size: [2.6, 1.5, 2], color: '#9AA1A9' },
  { id: 'rock-5', type: 'rock', position: [-48, 0.85, 6], rotationY: -0.38, size: [2.2, 1.6, 1.7], color: '#A8AFB8' },
  { id: 'rock-6', type: 'rock', position: [-34, 0.8, 24], rotationY: 0.27, size: [2.4, 1.5, 1.9], color: '#ADB5BD' },
  { id: 'rock-7', type: 'rock', position: [-16, 0.75, 40], rotationY: -0.16, size: [2.1, 1.4, 1.6], color: '#B6BDC5' },
  { id: 'rock-8', type: 'rock', position: [8, 0.9, 50], rotationY: 0.42, size: [2.8, 1.7, 2.1], color: '#9AA1A9' },
  { id: 'rock-9', type: 'rock', position: [30, 0.8, 44], rotationY: -0.31, size: [2.3, 1.5, 1.8], color: '#ADB5BD' },
  { id: 'rock-10', type: 'rock', position: [48, 0.85, 30], rotationY: 0.18, size: [2.5, 1.6, 2], color: '#A8AFB8' },
  { id: 'rock-11', type: 'rock', position: [58, 0.75, 8], rotationY: -0.22, size: [2.2, 1.4, 1.7], color: '#B6BDC5' },
  { id: 'rock-12', type: 'rock', position: [60, 0.8, -20], rotationY: 0.14, size: [2.6, 1.5, 2], color: '#ADB5BD' },
  { id: 'rock-13', type: 'rock', position: [46, 0.85, -40], rotationY: -0.3, size: [2.3, 1.6, 1.9], color: '#9AA1A9' },
  { id: 'rock-14', type: 'rock', position: [24, 0.75, -52], rotationY: 0.33, size: [2.2, 1.4, 1.7], color: '#B6BDC5' },
  { id: 'rock-15', type: 'rock', position: [2, 0.85, -48], rotationY: -0.2, size: [2.4, 1.6, 1.9], color: '#A8AFB8' },
  { id: 'rock-16', type: 'rock', position: [-24, 0.8, -42], rotationY: 0.29, size: [2.5, 1.5, 2], color: '#ADB5BD' },
];

const BERRY_BUSH_PROPS: EnvironmentProp[] = [
  { id: 'berry-1', type: 'berry_bush', position: [-22, 0.55, -2], rotationY: 0, size: [1.4, 1.1, 1.4], color: '#4CAF50' },
  { id: 'berry-2', type: 'berry_bush', position: [21, 0.55, 22], rotationY: 0, size: [1.5, 1.1, 1.5], color: '#4CAF50' },
  { id: 'berry-3', type: 'berry_bush', position: [24, 0.55, -24], rotationY: 0, size: [1.45, 1.1, 1.45], color: '#4CAF50' },
  { id: 'berry-4', type: 'berry_bush', position: [-56, 0.55, -34], rotationY: 0, size: [1.5, 1.1, 1.5], color: '#53B65C' },
  { id: 'berry-5', type: 'berry_bush', position: [-44, 0.55, 18], rotationY: 0, size: [1.4, 1.1, 1.4], color: '#4CAF50' },
  { id: 'berry-6', type: 'berry_bush', position: [-18, 0.55, 54], rotationY: 0, size: [1.45, 1.1, 1.45], color: '#53B65C' },
  { id: 'berry-7', type: 'berry_bush', position: [18, 0.55, 60], rotationY: 0, size: [1.5, 1.1, 1.5], color: '#4CAF50' },
  { id: 'berry-8', type: 'berry_bush', position: [48, 0.55, 46], rotationY: 0, size: [1.45, 1.1, 1.45], color: '#53B65C' },
  { id: 'berry-9', type: 'berry_bush', position: [58, 0.55, 2], rotationY: 0, size: [1.4, 1.1, 1.4], color: '#4CAF50' },
  { id: 'berry-10', type: 'berry_bush', position: [54, 0.55, -42], rotationY: 0, size: [1.5, 1.1, 1.5], color: '#53B65C' },
  { id: 'berry-11', type: 'berry_bush', position: [6, 0.55, -62], rotationY: 0, size: [1.45, 1.1, 1.45], color: '#4CAF50' },
  { id: 'berry-12', type: 'berry_bush', position: [-36, 0.55, -56], rotationY: 0, size: [1.5, 1.1, 1.5], color: '#53B65C' },
];

const centerSet = (prefix: string, x: number, zBack: number): EnvironmentProp[] => [
  { id: `${prefix}-front`, type: 'center_wall', position: [x, 1.7, zBack - 10], rotationY: 0, size: [8, 3.4, 0.4], color: '#FF6B6B' },
  { id: `${prefix}-back`, type: 'center_wall', position: [x, 1.7, zBack], rotationY: 0, size: [8, 3.4, 0.4], color: '#FF6B6B' },
  { id: `${prefix}-left`, type: 'center_wall', position: [x - 7.6, 1.7, zBack - 5], rotationY: 0, size: [0.4, 3.4, 5], color: '#FF8787' },
  { id: `${prefix}-right`, type: 'center_wall', position: [x + 7.6, 1.7, zBack - 5], rotationY: 0, size: [0.4, 3.4, 5], color: '#FF8787' },
];

const CENTER_WALL_PROPS: EnvironmentProp[] = [
  ...centerSet('center-main', 0, 2),
  ...centerSet('center-west', -44, 34),
  ...centerSet('center-east', 46, -30),
];

const BUILDING_PROPS: EnvironmentProp[] = [
  { id: 'building-1', type: 'building', position: [-32, 2.2, -12], rotationY: 0, size: [10, 4.4, 8], color: '#FFD166' },
  { id: 'building-2', type: 'building', position: [34, 2.2, 14], rotationY: 0, size: [9, 4.4, 7], color: '#F4A261' },
  { id: 'building-3', type: 'building', position: [18, 2.4, -38], rotationY: 0, size: [11, 4.8, 8.5], color: '#FFE08A' },
  { id: 'building-4', type: 'building', position: [-48, 2.4, 42], rotationY: 0, size: [10.5, 4.8, 8.2], color: '#FFCB77' },
  { id: 'mart-1', type: 'building', position: [-8, 2.1, 36], rotationY: 0, size: [8.5, 4.2, 7], color: '#8ED0F5' },
  { id: 'mart-2', type: 'building', position: [52, 2.1, 36], rotationY: 0, size: [8.5, 4.2, 7], color: '#8ED0F5' },
  { id: 'house-1', type: 'building', position: [-58, 2, 4], rotationY: 0, size: [7.5, 4, 6.5], color: '#FFC89B' },
  { id: 'house-2', type: 'building', position: [60, 2, -8], rotationY: 0, size: [7.5, 4, 6.5], color: '#FFC89B' },
];

const ROAD_PROPS: EnvironmentProp[] = [
  { id: 'road-1', type: 'road', position: [0, 0.1, -36], rotationY: 0, size: [12, 0.2, 10], color: '#9D9FA6' },
  { id: 'road-2', type: 'road', position: [0, 0.1, -24], rotationY: 0, size: [12, 0.2, 10], color: '#9D9FA6' },
  { id: 'road-3', type: 'road', position: [0, 0.1, -12], rotationY: 0, size: [12, 0.2, 10], color: '#9D9FA6' },
  { id: 'road-4', type: 'road', position: [0, 0.1, 0], rotationY: 0, size: [12, 0.2, 10], color: '#9D9FA6' },
  { id: 'road-5', type: 'road', position: [0, 0.1, 12], rotationY: 0, size: [12, 0.2, 10], color: '#9D9FA6' },
  { id: 'road-6', type: 'road', position: [0, 0.1, 24], rotationY: 0, size: [12, 0.2, 10], color: '#9D9FA6' },
  { id: 'road-7', type: 'road', position: [0, 0.1, 36], rotationY: 0, size: [12, 0.2, 10], color: '#9D9FA6' },
  { id: 'road-8', type: 'road', position: [-24, 0.1, 0], rotationY: 0, size: [14, 0.2, 8], color: '#8D9096' },
  { id: 'road-9', type: 'road', position: [-40, 0.1, 0], rotationY: 0, size: [14, 0.2, 8], color: '#8D9096' },
  { id: 'road-10', type: 'road', position: [24, 0.1, 0], rotationY: 0, size: [14, 0.2, 8], color: '#8D9096' },
  { id: 'road-11', type: 'road', position: [40, 0.1, 0], rotationY: 0, size: [14, 0.2, 8], color: '#8D9096' },
  { id: 'road-12', type: 'road', position: [56, 0.1, 0], rotationY: 0, size: [14, 0.2, 8], color: '#8D9096' },
];

const FENCE_PROPS: EnvironmentProp[] = [
  { id: 'fence-n', type: 'fence', position: [0, 0.65, -79.8], rotationY: 0, size: [160, 1.3, 0.3], color: '#9C6644' },
  { id: 'fence-s', type: 'fence', position: [0, 0.65, 79.8], rotationY: 0, size: [160, 1.3, 0.3], color: '#9C6644' },
  { id: 'fence-w', type: 'fence', position: [-79.8, 0.65, 0], rotationY: 0, size: [0.3, 1.3, 160], color: '#9C6644' },
  { id: 'fence-e', type: 'fence', position: [79.8, 0.65, 0], rotationY: 0, size: [0.3, 1.3, 160], color: '#9C6644' },
];

export const ENVIRONMENT_PROPS: EnvironmentProp[] = [
  ...ROAD_PROPS,
  ...CENTER_WALL_PROPS,
  ...BUILDING_PROPS,
  ...TALL_GRASS_PROPS,
  ...TREE_PROPS,
  ...ROCK_PROPS,
  ...BERRY_BUSH_PROPS,
  ...FENCE_PROPS,
];
