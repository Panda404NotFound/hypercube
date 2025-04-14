use wasm_bindgen::prelude::*;
use web_sys::console;

// Модули
mod utils;
mod physics;
mod hypercube;
mod space_core;
mod space_objects;
mod neon_comets;
mod energy_spheres;
mod polygonal_crystals;

// Реэкспорт публичных функций и типов
pub use space_core::*;
pub use space_objects::*;
pub use neon_comets::*;

#[wasm_bindgen]
pub fn init() {
    // Настраиваем паник-хук для лучшего вывода ошибок
    utils::set_panic_hook();
}

#[wasm_bindgen]
pub fn log_message(message: &str) {
    console::log_1(&JsValue::from_str(message));
}