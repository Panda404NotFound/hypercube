declare module 'hypercube-wasm' {
  // Общие типы
  export type Point3D = [number, number, number];
  export type Point4D = [number, number, number, number];
  
  // Тип для данных частиц
  export interface ParticleData {
    positions: number[];
    sizes: number[];
    colors: number[];
  }
  
  // Класс для 4D точки
  export class Point4DClass {
    x: number;
    y: number;
    z: number;
    w: number;
    
    constructor(x: number, y: number, z: number, w: number);
    distance(other: Point4DClass): number;
    project_to_3d(w_camera: number): number[];
  }
  
  // Класс для гиперкуба
  export class Hypercube {
    constructor(size: number);
    rotate(xy_angle: number, xz_angle: number, xw_angle: number, yz_angle: number, yw_angle: number, zw_angle: number): void;
    get_projected_vertices(w_camera: number): number[];
    get_edges(): Uint32Array;
  }
  
  // Функции для инициализации и работы с физикой
  export function init_physics_world(): number;
  export function step_simulation(world_id: number, dt: number): boolean;
  
  // Функции для работы с частицами
  export function create_particle_system(count: number): number;
  export function update_particle_system(system_id: number, dt: number): boolean;
  export function get_particle_data(system_id: number): Promise<ParticleData>;
  
  // Прочие вспомогательные функции
  export function greet(name: string): string;
  export function calculate_4d_rotation(x: number, y: number, z: number, w: number, angle: number): number[];
  export function measure_performance(callback: () => void): Promise<number>;
} 