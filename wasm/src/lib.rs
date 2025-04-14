use wasm_bindgen::prelude::*;
use web_sys::console;

// Модули
mod utils;
mod physics;
mod hypercube;
mod particles;
mod space_objects;
mod neon_comets;
mod objective_main;
mod intersections;

// При инициализации модуля
#[wasm_bindgen(start)]
pub fn start() -> Result<(), JsValue> {
    utils::set_panic_hook();
    console::log_1(&"HYPERCUBE WASM модуль инициализирован".into());
    Ok(())
}

// Экспортируемые функции для JS
#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Привет, {}! Это Rust WASM модуль HYPERCUBE.", name)
}

// Тестовая функция для вычислений 4D координат
#[wasm_bindgen]
pub fn calculate_4d_rotation(x: f64, y: f64, z: f64, w: f64, _angle: f64) -> Vec<f64> {
    // Просто заглушка для демонстрации экспорта функций
    // Реальные вычисления будут в модуле hypercube
    vec![x, y, z, w]
}

// Функция для создания физического мира
#[wasm_bindgen]
pub fn init_physics_world() -> usize {
    physics::init_world()
}

// Функция для создания системы частиц
#[wasm_bindgen]
pub fn create_particle_system(count: usize) -> usize {
    particles::create_system(count)
}

// Функции для космических объектов

// Создание системы космических объектов
#[wasm_bindgen]
pub fn create_space_objects(count: usize, _object_type: usize) -> *mut space_objects::SpaceObjectSystem {
    space_objects::create_space_object_system(count)
}

// Обновление системы космических объектов
#[wasm_bindgen]
pub fn update_space_objects(system_id: *mut space_objects::SpaceObjectSystem, dt: f32) -> bool {
    space_objects::update_space_object_system(system_id, dt)
}

// Получение данных о неоновых кометах
#[wasm_bindgen]
pub fn get_neon_comets_data(system_id: *mut space_objects::SpaceObjectSystem) -> JsValue {
    space_objects::get_neon_comet_data(system_id)
}

// Обновление эффектов неоновых комет
#[wasm_bindgen]
pub fn update_comet_effects(delta_time: f32) -> JsValue {
    neon_comets::update_comet_effects(delta_time)
}

// Получение активных эффектов неоновых комет
#[wasm_bindgen]
pub fn get_comet_effects() -> JsValue {
    neon_comets::get_comet_effects()
}

// Re-export the space_objects module functions
pub use space_objects::*;
// Re-export the objective_main module functions
pub use objective_main::*;
// Re-export the intersections module functions
pub use intersections::*;

// Реэкспортируем функции для работы с космическими объектами
#[wasm_bindgen]
pub fn create_space_object_system(count: usize, _object_type_num: usize) -> *mut space_objects::SpaceObjectSystem {
    space_objects::create_space_object_system(count)
}

#[wasm_bindgen]
pub fn update_space_object_system(system_id: *mut space_objects::SpaceObjectSystem, dt: f32) -> bool {
    space_objects::update_space_object_system(system_id, dt)
}

#[wasm_bindgen]
pub fn create_space_object_system_with_fixed_particles(count: usize, object_type_num: usize, particles_per_object: usize) -> *mut space_objects::SpaceObjectSystem {
    space_objects::create_space_object_system_with_fixed_particles(count, object_type_num, particles_per_object)
}

// Реэкспортируем функции для работы с кубическим пространством
#[wasm_bindgen]
pub fn create_space_cube(x: f32, y: f32, z: f32, width: f32, height: f32, depth: f32) -> usize {
    objective_main::create_space_cube(x, y, z, width, height, depth)
}

#[wasm_bindgen]
pub fn get_space_cube_data(cube_id: usize) -> Result<JsValue, JsValue> {
    objective_main::get_space_cube_data(cube_id)
}

#[wasm_bindgen]
pub fn check_point_in_cube(cube_id: usize, x: f32, y: f32, z: f32) -> bool {
    objective_main::check_point_in_cube(cube_id, x, y, z)
}

#[wasm_bindgen]
pub fn check_line_intersection_with_center_plane(
    cube_id: usize,
    start_x: f32, start_y: f32, start_z: f32,
    end_x: f32, end_y: f32, end_z: f32
) -> bool {
    objective_main::check_line_intersection_with_center_plane(
        cube_id, start_x, start_y, start_z, end_x, end_y, end_z
    )
}

#[wasm_bindgen]
pub fn update_space_cube(
    cube_id: usize,
    x: f32, y: f32, z: f32,
    width: f32, height: f32, depth: f32,
    rot_x: f32, rot_y: f32, rot_z: f32
) -> bool {
    objective_main::update_space_cube(
        cube_id, x, y, z, width, height, depth, rot_x, rot_y, rot_z
    )
}

// Новые функции для улучшенной пространственной системы
#[wasm_bindgen]
pub fn get_intersection_info(
    cube_id: usize,
    start_x: f32, start_y: f32, start_z: f32,
    end_x: f32, end_y: f32, end_z: f32,
    object_id: usize
) -> JsValue {
    let start = [start_x, start_y, start_z];
    let end = [end_x, end_y, end_z];
    
    if let Ok(cubes) = objective_main::SPACE_CUBES.lock() {
        if let Some(cube) = cubes.get(&cube_id) {
            // Используем текущее время в секундах для временной метки пересечения
            let time = web_sys::window()
                .and_then(|w| w.performance())
                .map(|p| p.now() / 1000.0)
                .unwrap_or(0.0) as f32;
            
            if let Some(intersection) = cube.intersects_center_plane_with_info(start, end, object_id, time) {
                return serde_wasm_bindgen::to_value(&intersection).unwrap_or(JsValue::NULL);
            }
        }
    }
    
    JsValue::NULL
}

#[wasm_bindgen]
pub fn get_recent_intersections(max_count: usize) -> JsValue {
    if let Ok(intersections) = objective_main::INTERSECTIONS.lock() {
        let count = intersections.len().min(max_count);
        let recent = intersections.iter().rev().take(count).cloned().collect::<Vec<_>>();
        return serde_wasm_bindgen::to_value(&recent).unwrap_or(JsValue::NULL);
    }
    
    JsValue::NULL
}

#[wasm_bindgen]
pub fn rotate_cube(cube_id: usize, rot_x: f32, rot_y: f32, rot_z: f32) -> bool {
    if let Ok(mut cubes) = objective_main::SPACE_CUBES.lock() {
        if let Some(cube) = cubes.get_mut(&cube_id) {
            cube.rotation = [rot_x, rot_y, rot_z];
            cube.update_transform();
            return true;
        }
    }
    
    false
}

#[wasm_bindgen]
pub fn create_viewing_plane(width: f32, height: f32, depth: f32) -> usize {
    objective_main::create_viewing_plane(width, height, depth)
}

#[wasm_bindgen]
pub fn get_viewing_plane_id() -> usize {
    objective_main::get_viewing_plane_id()
}

#[wasm_bindgen]
pub fn calculate_distance_to_viewing_plane(x: f32, y: f32, z: f32) -> f32 {
    let viewing_plane_id = objective_main::get_viewing_plane_id();
    if viewing_plane_id == 0 {
        return 0.0;
    }
    
    if let Ok(cubes) = objective_main::SPACE_CUBES.lock() {
        if let Some(cube) = cubes.get(&viewing_plane_id) {
            return cube.distance_to_center_plane([x, y, z]);
        }
    }
    
    0.0
} 