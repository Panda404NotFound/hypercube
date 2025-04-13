use wasm_bindgen::prelude::*;

// Функция для улучшения отображения ошибок Rust в консоли
pub fn set_panic_hook() {
    // When the `console_error_panic_hook` feature is enabled, we can call the
    // `set_panic_hook` function to get better error messages if we ever panic.
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

// Функция для измерения производительности
#[wasm_bindgen]
pub fn measure_performance(callback: &js_sys::Function) -> Result<f64, JsValue> {
    let window = web_sys::window().unwrap();
    let performance = window.performance().unwrap();
    
    let start = performance.now();
    let this = JsValue::NULL;
    let _ = callback.call0(&this)?;
    let end = performance.now();
    
    Ok(end - start)
} 