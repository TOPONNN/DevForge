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

const ROAD_PROPS: EnvironmentProp[] = [
  { id: 'road-n-1', type: 'road', position: [0, 0.1, -8], rotationY: 0.22, size: [6.8, 0.2, 9], color: '#9FA3A8' },
  { id: 'road-n-2', type: 'road', position: [4, 0.1, -18], rotationY: -0.14, size: [7.2, 0.2, 9.4], color: '#9FA3A8' },
  { id: 'road-n-3', type: 'road', position: [8, 0.1, -29], rotationY: 0.1, size: [6.8, 0.2, 9.6], color: '#9FA3A8' },
  { id: 'road-n-4', type: 'road', position: [11, 0.1, -41], rotationY: -0.06, size: [6.5, 0.2, 9.2], color: '#9FA3A8' },

  { id: 'road-e-1', type: 'road', position: [8, 0.1, 0], rotationY: Math.PI * 0.5 + 0.2, size: [6.8, 0.2, 9.2], color: '#9FA3A8' },
  { id: 'road-e-2', type: 'road', position: [19, 0.1, -3], rotationY: Math.PI * 0.5 - 0.12, size: [7.2, 0.2, 9.4], color: '#9FA3A8' },
  { id: 'road-e-3', type: 'road', position: [31, 0.1, -6], rotationY: Math.PI * 0.5 + 0.08, size: [7, 0.2, 9.2], color: '#9FA3A8' },
  { id: 'road-e-4', type: 'road', position: [43, 0.1, -8], rotationY: Math.PI * 0.5 - 0.04, size: [6.5, 0.2, 9], color: '#9FA3A8' },

  { id: 'road-s-1', type: 'road', position: [0, 0.1, 8], rotationY: -0.18, size: [6.8, 0.2, 9], color: '#9FA3A8' },
  { id: 'road-s-2', type: 'road', position: [-3, 0.1, 19], rotationY: 0.16, size: [7.1, 0.2, 9.2], color: '#9FA3A8' },
  { id: 'road-s-3', type: 'road', position: [-7, 0.1, 30], rotationY: -0.08, size: [6.9, 0.2, 9.4], color: '#9FA3A8' },
  { id: 'road-s-4', type: 'road', position: [-10, 0.1, 41], rotationY: 0.05, size: [6.6, 0.2, 9.2], color: '#9FA3A8' },

  { id: 'road-w-1', type: 'road', position: [-8, 0.1, 1], rotationY: Math.PI * 0.5 - 0.24, size: [6.8, 0.2, 9.2], color: '#9FA3A8' },
  { id: 'road-w-2', type: 'road', position: [-19, 0.1, 5], rotationY: Math.PI * 0.5 + 0.14, size: [7.2, 0.2, 9.4], color: '#9FA3A8' },
  { id: 'road-w-3', type: 'road', position: [-31, 0.1, 10], rotationY: Math.PI * 0.5 - 0.1, size: [7, 0.2, 9.4], color: '#9FA3A8' },
  { id: 'road-w-4', type: 'road', position: [-43, 0.1, 15], rotationY: Math.PI * 0.5 + 0.05, size: [6.5, 0.2, 9], color: '#9FA3A8' },
];

const BUILDING_PROPS: EnvironmentProp[] = [
  { id: 'gazebo-nw', type: 'building', position: [-27, 2.2, -24], rotationY: 0.3, size: [8.6, 4.4, 7.4], color: '#F2C572' },
  { id: 'gazebo-ne', type: 'building', position: [28, 2.3, -22], rotationY: -0.2, size: [8.8, 4.6, 7.6], color: '#F3B76A' },
  { id: 'gazebo-sw', type: 'building', position: [-24, 2.2, 27], rotationY: 0.1, size: [8.4, 4.4, 7.2], color: '#EFC27A' },
  { id: 'gazebo-se', type: 'building', position: [26, 2.3, 26], rotationY: -0.28, size: [9, 4.6, 7.8], color: '#F7CA82' },
];

const TREE_PROPS: EnvironmentProp[] = [
  { id: 'tree-1', type: 'tree', position: [-42, 1.8, -36], rotationY: 0.1, size: [0.88, 3.6, 0.88], color: '#7F5539' },
  { id: 'tree-2', type: 'tree', position: [-37, 1.8, -31], rotationY: -0.2, size: [0.86, 3.5, 0.86], color: '#7F5539' },
  { id: 'tree-3', type: 'tree', position: [-45, 1.8, -27], rotationY: 0.18, size: [0.9, 3.7, 0.9], color: '#7F5539' },
  { id: 'tree-4', type: 'tree', position: [38, 1.8, -38], rotationY: -0.12, size: [0.88, 3.6, 0.88], color: '#7F5539' },
  { id: 'tree-5', type: 'tree', position: [44, 1.8, -33], rotationY: 0.22, size: [0.9, 3.7, 0.9], color: '#7F5539' },
  { id: 'tree-6', type: 'tree', position: [34, 1.8, -28], rotationY: -0.08, size: [0.85, 3.5, 0.85], color: '#7F5539' },
  { id: 'tree-7', type: 'tree', position: [-39, 1.8, 38], rotationY: 0.2, size: [0.88, 3.6, 0.88], color: '#7F5539' },
  { id: 'tree-8', type: 'tree', position: [-34, 1.8, 33], rotationY: -0.1, size: [0.86, 3.5, 0.86], color: '#7F5539' },
  { id: 'tree-9', type: 'tree', position: [-45, 1.8, 30], rotationY: 0.24, size: [0.9, 3.7, 0.9], color: '#7F5539' },
  { id: 'tree-10', type: 'tree', position: [36, 1.8, 39], rotationY: -0.18, size: [0.88, 3.6, 0.88], color: '#7F5539' },
  { id: 'tree-11', type: 'tree', position: [42, 1.8, 35], rotationY: 0.08, size: [0.9, 3.7, 0.9], color: '#7F5539' },
  { id: 'tree-12', type: 'tree', position: [31, 1.8, 31], rotationY: -0.16, size: [0.85, 3.5, 0.85], color: '#7F5539' },
  { id: 'tree-13', type: 'tree', position: [9, 1.8, -14], rotationY: 0.14, size: [0.84, 3.5, 0.84], color: '#7F5539' },
  { id: 'tree-14', type: 'tree', position: [14, 1.8, -23], rotationY: -0.22, size: [0.88, 3.6, 0.88], color: '#7F5539' },
  { id: 'tree-15', type: 'tree', position: [18, 1.8, -31], rotationY: 0.17, size: [0.9, 3.7, 0.9], color: '#7F5539' },
  { id: 'tree-16', type: 'tree', position: [23, 1.8, -39], rotationY: -0.15, size: [0.86, 3.5, 0.86], color: '#7F5539' },
  { id: 'tree-17', type: 'tree', position: [-10, 1.8, 16], rotationY: 0.2, size: [0.84, 3.5, 0.84], color: '#7F5539' },
  { id: 'tree-18', type: 'tree', position: [-16, 1.8, 24], rotationY: -0.1, size: [0.86, 3.5, 0.86], color: '#7F5539' },
  { id: 'tree-19', type: 'tree', position: [-21, 1.8, 32], rotationY: 0.24, size: [0.9, 3.7, 0.9], color: '#7F5539' },
  { id: 'tree-20', type: 'tree', position: [-26, 1.8, 40], rotationY: -0.18, size: [0.88, 3.6, 0.88], color: '#7F5539' },
  { id: 'tree-21', type: 'tree', position: [-17, 1.8, -16], rotationY: 0.12, size: [0.85, 3.5, 0.85], color: '#7F5539' },
  { id: 'tree-22', type: 'tree', position: [-24, 1.8, -25], rotationY: -0.2, size: [0.88, 3.6, 0.88], color: '#7F5539' },
];

const ROCK_PROPS: EnvironmentProp[] = [
  { id: 'rock-1', type: 'rock', position: [-30, 0.82, -10], rotationY: 0.25, size: [2.2, 1.5, 1.8], color: '#ADB5BD' },
  { id: 'rock-2', type: 'rock', position: [-14, 0.78, -36], rotationY: -0.2, size: [2, 1.4, 1.6], color: '#A8AFB8' },
  { id: 'rock-3', type: 'rock', position: [19, 0.85, -14], rotationY: 0.18, size: [2.3, 1.6, 1.8], color: '#9AA1A9' },
  { id: 'rock-4', type: 'rock', position: [30, 0.8, -30], rotationY: -0.32, size: [2.4, 1.5, 1.9], color: '#ADB5BD' },
  { id: 'rock-5', type: 'rock', position: [41, 0.82, -18], rotationY: 0.14, size: [2.1, 1.5, 1.7], color: '#B6BDC5' },
  { id: 'rock-6', type: 'rock', position: [-34, 0.84, 8], rotationY: -0.28, size: [2.5, 1.6, 2], color: '#9AA1A9' },
  { id: 'rock-7', type: 'rock', position: [-40, 0.82, 24], rotationY: 0.2, size: [2.2, 1.5, 1.8], color: '#ADB5BD' },
  { id: 'rock-8', type: 'rock', position: [-10, 0.76, 41], rotationY: -0.1, size: [1.9, 1.3, 1.5], color: '#B6BDC5' },
  { id: 'rock-9', type: 'rock', position: [9, 0.84, 33], rotationY: 0.3, size: [2.4, 1.6, 1.9], color: '#A8AFB8' },
  { id: 'rock-10', type: 'rock', position: [25, 0.8, 41], rotationY: -0.22, size: [2.2, 1.5, 1.8], color: '#ADB5BD' },
  { id: 'rock-11', type: 'rock', position: [40, 0.84, 25], rotationY: 0.26, size: [2.5, 1.6, 2], color: '#9AA1A9' },
  { id: 'rock-12', type: 'rock', position: [-2, 0.78, -44], rotationY: -0.16, size: [2, 1.4, 1.6], color: '#B6BDC5' },
  { id: 'rock-13', type: 'rock', position: [45, 0.82, 5], rotationY: 0.12, size: [2.3, 1.5, 1.8], color: '#ADB5BD' },
];

const BERRY_BUSH_PROPS: EnvironmentProp[] = [
  { id: 'berry-1', type: 'berry_bush', position: [-19, 0.55, -10], rotationY: 0.1, size: [1.4, 1.1, 1.4], color: '#4CAF50' },
  { id: 'berry-2', type: 'berry_bush', position: [14, 0.55, -8], rotationY: -0.2, size: [1.45, 1.1, 1.45], color: '#53B65C' },
  { id: 'berry-3', type: 'berry_bush', position: [28, 0.55, -17], rotationY: 0.15, size: [1.5, 1.1, 1.5], color: '#4CAF50' },
  { id: 'berry-4', type: 'berry_bush', position: [-33, 0.55, -22], rotationY: -0.25, size: [1.45, 1.1, 1.45], color: '#53B65C' },
  { id: 'berry-5', type: 'berry_bush', position: [-43, 0.55, -7], rotationY: 0.2, size: [1.4, 1.1, 1.4], color: '#4CAF50' },
  { id: 'berry-6', type: 'berry_bush', position: [6, 0.55, 20], rotationY: -0.12, size: [1.5, 1.1, 1.5], color: '#53B65C' },
  { id: 'berry-7', type: 'berry_bush', position: [-14, 0.55, 28], rotationY: 0.08, size: [1.45, 1.1, 1.45], color: '#4CAF50' },
  { id: 'berry-8', type: 'berry_bush', position: [20, 0.55, 33], rotationY: -0.18, size: [1.5, 1.1, 1.5], color: '#53B65C' },
  { id: 'berry-9', type: 'berry_bush', position: [-28, 0.55, 39], rotationY: 0.22, size: [1.45, 1.1, 1.45], color: '#4CAF50' },
  { id: 'berry-10', type: 'berry_bush', position: [35, 0.55, 19], rotationY: -0.14, size: [1.4, 1.1, 1.4], color: '#53B65C' },
  { id: 'berry-11', type: 'berry_bush', position: [43, 0.55, -31], rotationY: 0.12, size: [1.45, 1.1, 1.45], color: '#4CAF50' },
];

const TALL_GRASS_PROPS: EnvironmentProp[] = [
  { id: 'grass-1', type: 'tall_grass', position: [-36, 0.65, -41], rotationY: 0.2, size: [3.2, 1.3, 2.6], color: '#2B9348' },
  { id: 'grass-2', type: 'tall_grass', position: [-29, 0.65, -35], rotationY: -0.16, size: [3.4, 1.3, 2.7], color: '#2F9E44' },
  { id: 'grass-3', type: 'tall_grass', position: [30, 0.65, -42], rotationY: 0.12, size: [3.3, 1.3, 2.6], color: '#2B9348' },
  { id: 'grass-4', type: 'tall_grass', position: [39, 0.65, -36], rotationY: -0.2, size: [3.5, 1.3, 2.8], color: '#2F9E44' },
  { id: 'grass-5', type: 'tall_grass', position: [-42, 0.65, 34], rotationY: 0.18, size: [3.2, 1.3, 2.5], color: '#238636' },
  { id: 'grass-6', type: 'tall_grass', position: [-33, 0.65, 40], rotationY: -0.14, size: [3.4, 1.3, 2.7], color: '#2B9348' },
  { id: 'grass-7', type: 'tall_grass', position: [34, 0.65, 41], rotationY: 0.22, size: [3.5, 1.3, 2.8], color: '#2F9E44' },
  { id: 'grass-8', type: 'tall_grass', position: [42, 0.65, 34], rotationY: -0.18, size: [3.3, 1.3, 2.6], color: '#238636' },
  { id: 'grass-9', type: 'tall_grass', position: [-6, 0.65, -29], rotationY: 0.1, size: [3.1, 1.3, 2.4], color: '#2B9348' },
  { id: 'grass-10', type: 'tall_grass', position: [12, 0.65, -37], rotationY: -0.24, size: [3.4, 1.3, 2.8], color: '#2F9E44' },
  { id: 'grass-11', type: 'tall_grass', position: [24, 0.65, -45], rotationY: 0.16, size: [3.6, 1.3, 2.9], color: '#2B9348' },
  { id: 'grass-12', type: 'tall_grass', position: [-18, 0.65, 22], rotationY: -0.12, size: [3.2, 1.3, 2.6], color: '#2F9E44' },
  { id: 'grass-13', type: 'tall_grass', position: [-25, 0.65, 31], rotationY: 0.2, size: [3.5, 1.3, 2.8], color: '#2B9348' },
  { id: 'grass-14', type: 'tall_grass', position: [14, 0.65, 26], rotationY: -0.18, size: [3.2, 1.3, 2.5], color: '#2F9E44' },
  { id: 'grass-15', type: 'tall_grass', position: [27, 0.65, 36], rotationY: 0.1, size: [3.4, 1.3, 2.7], color: '#238636' },
  { id: 'grass-16', type: 'tall_grass', position: [43, 0.65, 12], rotationY: -0.08, size: [3.3, 1.3, 2.6], color: '#2B9348' },
  { id: 'grass-17', type: 'tall_grass', position: [-45, 0.65, 16], rotationY: 0.22, size: [3.5, 1.3, 2.9], color: '#2F9E44' },
];

const FENCE_PROPS: EnvironmentProp[] = [
  { id: 'fence-n', type: 'fence', position: [0, 0.65, -49.8], rotationY: 0, size: [100, 1.3, 0.3], color: '#9C6644' },
  { id: 'fence-s', type: 'fence', position: [0, 0.65, 49.8], rotationY: 0, size: [100, 1.3, 0.3], color: '#9C6644' },
  { id: 'fence-w', type: 'fence', position: [-49.8, 0.65, 0], rotationY: 0, size: [0.3, 1.3, 100], color: '#9C6644' },
  { id: 'fence-e', type: 'fence', position: [49.8, 0.65, 0], rotationY: 0, size: [0.3, 1.3, 100], color: '#9C6644' },
];

export const ENVIRONMENT_PROPS: EnvironmentProp[] = [
  ...ROAD_PROPS,
  ...BUILDING_PROPS,
  ...TREE_PROPS,
  ...ROCK_PROPS,
  ...BERRY_BUSH_PROPS,
  ...TALL_GRASS_PROPS,
  ...FENCE_PROPS,
];
