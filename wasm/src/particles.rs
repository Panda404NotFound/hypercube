use wasm_bindgen::prelude::*;
use rand::{Rng, rngs::ThreadRng};
use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use serde::{Serialize, Deserialize};

// Глобальное хранилище систем частиц
static mut PARTICLE_SYSTEMS: Option<HashMap<usize, ParticleSystem>> = None;
static NEXT_SYSTEM_ID: AtomicUsize = AtomicUsize::new(0);

// Структура частицы
#[derive(Clone, Debug)]
struct Particle {
    position: [f32; 3],
    velocity: [f32; 3],
    acceleration: [f32; 3],
    lifetime: f32,
    max_lifetime: f32,
    size: f32,
    color: [f32; 4],
}

impl Particle {
    fn new(rng: &mut ThreadRng) -> Self {
        // Случайное положение в сфере
        let theta = rng.gen_range(0.0..std::f32::consts::PI * 2.0);
        let phi = rng.gen_range(0.0..std::f32::consts::PI);
        let r = rng.gen_range(0.0..5.0);
        
        let x = r * phi.sin() * theta.cos();
        let y = r * phi.sin() * theta.sin();
        let z = r * phi.cos();
        
        // Случайная скорость
        let vx = rng.gen_range(-0.1..0.1);
        let vy = rng.gen_range(-0.1..0.1);
        let vz = rng.gen_range(-0.1..0.1);
        
        // Время жизни
        let max_lifetime = rng.gen_range(2.0..10.0);
        
        // Размер частицы
        let size = rng.gen_range(0.05..0.2);
        
        // Цвет частицы (RGBA)
        let r = rng.gen_range(0.0..1.0);
        let g = rng.gen_range(0.0..1.0);
        let b = rng.gen_range(0.5..1.0); // Больше синего для космического эффекта
        let a = rng.gen_range(0.5..1.0);
        
        Self {
            position: [x, y, z],
            velocity: [vx, vy, vz],
            acceleration: [0.0, 0.0, 0.0],
            lifetime: max_lifetime,
            max_lifetime,
            size,
            color: [r, g, b, a],
        }
    }
    
    // Обновление состояния частицы
    fn update(&mut self, dt: f32) {
        // Обновляем скорость
        self.velocity[0] += self.acceleration[0] * dt;
        self.velocity[1] += self.acceleration[1] * dt;
        self.velocity[2] += self.acceleration[2] * dt;
        
        // Обновляем положение
        self.position[0] += self.velocity[0] * dt;
        self.position[1] += self.velocity[1] * dt;
        self.position[2] += self.velocity[2] * dt;
        
        // Уменьшаем время жизни
        self.lifetime -= dt;
    }
    
    // Проверка, жива ли частица
    fn is_alive(&self) -> bool {
        self.lifetime > 0.0
    }
}

// Структура системы частиц
pub struct ParticleSystem {
    particles: Vec<Particle>,
    rng: ThreadRng,
}

impl ParticleSystem {
    fn new(count: usize) -> Self {
        let mut rng = rand::thread_rng();
        let mut particles = Vec::with_capacity(count);
        
        for _ in 0..count {
            particles.push(Particle::new(&mut rng));
        }
        
        Self { particles, rng }
    }
    
    // Обновление всех частиц в системе
    fn update(&mut self, dt: f32) {
        for particle in &mut self.particles {
            particle.update(dt);
            
            // Возрождаем умершие частицы
            if !particle.is_alive() {
                *particle = Particle::new(&mut self.rng);
            }
        }
    }
    
    // Получение данных о частицах для рендеринга
    fn get_particle_data(&self) -> (Vec<f32>, Vec<f32>, Vec<f32>) {
        let mut positions = Vec::with_capacity(self.particles.len() * 3);
        let mut sizes = Vec::with_capacity(self.particles.len());
        let mut colors = Vec::with_capacity(self.particles.len() * 4);
        
        for particle in &self.particles {
            positions.push(particle.position[0]);
            positions.push(particle.position[1]);
            positions.push(particle.position[2]);
            
            sizes.push(particle.size);
            
            colors.push(particle.color[0]);
            colors.push(particle.color[1]);
            colors.push(particle.color[2]);
            colors.push(particle.color[3] * (particle.lifetime / particle.max_lifetime));
        }
        
        (positions, sizes, colors)
    }
}

// Создание новой системы частиц
pub fn create_system(count: usize) -> usize {
    let system = ParticleSystem::new(count);
    let id = NEXT_SYSTEM_ID.fetch_add(1, Ordering::SeqCst);
    
    unsafe {
        let raw_ptr = &raw const PARTICLE_SYSTEMS;
        if (*raw_ptr).is_none() {
            PARTICLE_SYSTEMS = Some(HashMap::new());
        }
        
        if let Some(systems) = &mut *(&raw mut PARTICLE_SYSTEMS) {
            systems.insert(id, system);
        }
    }
    
    id
}

// Обновление системы частиц
#[wasm_bindgen]
pub fn update_particle_system(system_id: usize, dt: f32) -> bool {
    unsafe {
        if let Some(systems) = &mut *(&raw mut PARTICLE_SYSTEMS) {
            if let Some(system) = systems.get_mut(&system_id) {
                system.update(dt);
                return true;
            }
        }
        
        false
    }
}

// Получение данных о частицах
#[wasm_bindgen]
pub fn get_particle_data(system_id: usize) -> Result<JsValue, JsValue> {
    unsafe {
        if let Some(systems) = &*(&raw const PARTICLE_SYSTEMS) {
            if let Some(system) = systems.get(&system_id) {
                let (positions, sizes, colors) = system.get_particle_data();
                
                let data = ParticleData {
                    positions,
                    sizes,
                    colors,
                };
                
                return Ok(serde_wasm_bindgen::to_value(&data)?);
            }
        }
        
        Err(JsValue::from_str("System not found"))
    }
}

// Структура для сериализации данных частиц в JavaScript
#[derive(Serialize, Deserialize)]
struct ParticleData {
    positions: Vec<f32>,
    sizes: Vec<f32>,
    colors: Vec<f32>,
} 