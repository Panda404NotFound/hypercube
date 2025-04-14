declare module '@wasm/hypercube_wasm' {
  // Initialization
  function initModule(module_or_path?: WebAssembly.Module | string | URL | Request | Record<string, any>): Promise<any>;
  export default initModule;
  
  // Space Objects
  export function create_space_object_system(viewport_size_percent: number, fov_degrees: number): number;
  export function update_space_object_system(system_id: number, dt: number): boolean;
  
  // Neon Comets
  export function spawn_neon_comets(system_id: number, count: number): boolean;
  export function process_neon_comet_spawns(dt: number): number;
  export function get_active_neon_comets_count(system_id: number): number;
  
  // CometDataArray interface - can be accessed either via properties or getter functions
  export interface CometDataArray {
    // WASM binding pointer
    __wbg_ptr?: number;
    
    // Data properties - can be methods or direct properties
    ids: number[] | (() => number[]);
    positions: number[] | (() => number[]);
    scales: number[] | (() => number[]);
    rotations: number[] | (() => number[]);
    opacities: number[] | (() => number[]);
    colors: number[] | (() => number[]);
    tail_lengths: number[] | (() => number[]);
    glow_intensities: number[] | (() => number[]);
  }
  
  export function get_visible_neon_comets(system_id: number): CometDataArray | null;
} 