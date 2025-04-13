use wasm_bindgen::prelude::*;
use web_sys::console;

// Модули
mod utils;
mod physics;
mod hypercube;
mod particles;

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