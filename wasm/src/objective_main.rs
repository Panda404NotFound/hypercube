use wasm_bindgen::prelude::*;
use std::collections::HashMap;
use serde::{Serialize, Deserialize};
use web_sys::console;
use once_cell::sync::Lazy;
use std::sync::Mutex;
use std::sync::atomic::{AtomicUsize, Ordering};
use glam::{Vec3, Mat4, Quat};

// Типы точек пересечения объектов с плоскостью
#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum IntersectionType {
    Entry,      // Объект входит в плоскость
    Exit,       // Объект выходит из плоскости
    Parallel,   // Объект движется параллельно плоскости
    Contained,  // Объект полностью внутри плоскости
}

// Структура для хранения информации о пересечении
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Intersection {
    pub position: [f32; 3],         // Позиция точки пересечения
    pub normal: [f32; 3],           // Нормаль в точке пересечения
    pub distance: f32,              // Расстояние до точки пересечения
    pub intersection_type: IntersectionType, // Тип пересечения
    pub object_id: usize,           // ID объекта, который пересек плоскость
    pub plane_id: usize,            // ID плоскости, с которой произошло пересечение
    pub time: f32,                  // Временная метка пересечения
}

// Сериализуемое представление матрицы 4x4
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SerializableMat4 {
    pub cols: [[f32; 4]; 4],
}

impl From<Mat4> for SerializableMat4 {
    fn from(mat: Mat4) -> Self {
        let cols = [
            [mat.x_axis.x, mat.x_axis.y, mat.x_axis.z, mat.x_axis.w],
            [mat.y_axis.x, mat.y_axis.y, mat.y_axis.z, mat.y_axis.w],
            [mat.z_axis.x, mat.z_axis.y, mat.z_axis.z, mat.z_axis.w],
            [mat.w_axis.x, mat.w_axis.y, mat.w_axis.z, mat.w_axis.w],
        ];
        SerializableMat4 { cols }
    }
}

impl From<SerializableMat4> for Mat4 {
    fn from(serializable: SerializableMat4) -> Self {
        Mat4::from_cols(
            Vec3::new(serializable.cols[0][0], serializable.cols[0][1], serializable.cols[0][2]).extend(serializable.cols[0][3]),
            Vec3::new(serializable.cols[1][0], serializable.cols[1][1], serializable.cols[1][2]).extend(serializable.cols[1][3]),
            Vec3::new(serializable.cols[2][0], serializable.cols[2][1], serializable.cols[2][2]).extend(serializable.cols[2][3]),
            Vec3::new(serializable.cols[3][0], serializable.cols[3][1], serializable.cols[3][2]).extend(serializable.cols[3][3]),
        )
    }
}

// Lazy-инициализированное глобальное хранилище для мира/кубов
pub static SPACE_CUBES: Lazy<Mutex<HashMap<usize, SpaceCube>>> = 
    Lazy::new(|| Mutex::new(HashMap::new()));
static NEXT_CUBE_ID: AtomicUsize = AtomicUsize::new(0);

// История пересечений объектов с плоскостями
pub static INTERSECTIONS: Lazy<Mutex<Vec<Intersection>>> = 
    Lazy::new(|| Mutex::new(Vec::new()));

// Функция для логирования в консоль
fn log(message: &str) {
    console::log_1(&JsValue::from_str(message));
}

// Структура для хранения данных о кубе пространства
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SpaceCube {
    pub id: usize,
    pub position: [f32; 3],      // Центр куба
    pub dimensions: [f32; 3],    // Размеры куба по x, y, z
    pub rotation: [f32; 3],      // Поворот куба
    pub center_plane: Plane,     // Центральная плоскость (страница)
    pub boundary_planes: [Plane; 6], // Границы куба (6 плоскостей)
    pub is_active: bool,         // Активен ли куб
    pub is_viewing_plane: bool,  // Является ли этот куб просмотровой плоскостью (нашей страницей)
    #[serde(skip)]
    pub transform: Option<Mat4>, // Матрица трансформации для куба (не сериализуемая)
    pub transform_data: Option<SerializableMat4>, // Сериализуемое представление матрицы
}

// Структура для представления плоскости
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Plane {
    pub position: [f32; 3],    // Позиция центра плоскости
    pub normal: [f32; 3],      // Вектор нормали плоскости
    pub dimensions: [f32; 2],  // Размеры плоскости (ширина и высота)
    pub color: [f32; 4],       // Цвет плоскости с прозрачностью
    pub id: usize,             // Уникальный идентификатор плоскости
}

// Глобальный счетчик для ID плоскостей
static NEXT_PLANE_ID: AtomicUsize = AtomicUsize::new(0);

impl SpaceCube {
    // Создать новый куб пространства с заданными параметрами
    pub fn new(position: [f32; 3], dimensions: [f32; 3]) -> Self {
        let plane_id = NEXT_PLANE_ID.fetch_add(1, Ordering::SeqCst);
        
        // Создаем центральную плоскость (ориентирована по Z)
        let center_plane = Plane {
            position,  // Центр плоскости в центре куба
            normal: [0.0, 0.0, 1.0], // Нормаль направлена вдоль оси Z
            dimensions: [dimensions[0] * 0.9, dimensions[1] * 0.9], // Немного меньше размеров куба
            color: [0.4, 0.6, 1.0, 0.3], // Полупрозрачный голубой
            id: plane_id,
        };
        
        // Создаем 6 плоскостей, образующих границы куба
        let half_width = dimensions[0] / 2.0;
        let half_height = dimensions[1] / 2.0;
        let half_depth = dimensions[2] / 2.0;
        
        let boundary_planes = [
            // Передняя плоскость (Z+)
            Plane {
                position: [position[0], position[1], position[2] + half_depth],
                normal: [0.0, 0.0, 1.0],
                dimensions: [dimensions[0], dimensions[1]],
                color: [0.2, 0.3, 0.9, 0.1],
                id: NEXT_PLANE_ID.fetch_add(1, Ordering::SeqCst),
            },
            // Задняя плоскость (Z-)
            Plane {
                position: [position[0], position[1], position[2] - half_depth],
                normal: [0.0, 0.0, -1.0],
                dimensions: [dimensions[0], dimensions[1]],
                color: [0.2, 0.3, 0.9, 0.1],
                id: NEXT_PLANE_ID.fetch_add(1, Ordering::SeqCst),
            },
            // Правая плоскость (X+)
            Plane {
                position: [position[0] + half_width, position[1], position[2]],
                normal: [1.0, 0.0, 0.0],
                dimensions: [dimensions[2], dimensions[1]],
                color: [0.2, 0.3, 0.9, 0.1],
                id: NEXT_PLANE_ID.fetch_add(1, Ordering::SeqCst),
            },
            // Левая плоскость (X-)
            Plane {
                position: [position[0] - half_width, position[1], position[2]],
                normal: [-1.0, 0.0, 0.0],
                dimensions: [dimensions[2], dimensions[1]],
                color: [0.2, 0.3, 0.9, 0.1],
                id: NEXT_PLANE_ID.fetch_add(1, Ordering::SeqCst),
            },
            // Верхняя плоскость (Y+)
            Plane {
                position: [position[0], position[1] + half_height, position[2]],
                normal: [0.0, 1.0, 0.0],
                dimensions: [dimensions[0], dimensions[2]],
                color: [0.2, 0.3, 0.9, 0.1],
                id: NEXT_PLANE_ID.fetch_add(1, Ordering::SeqCst),
            },
            // Нижняя плоскость (Y-)
            Plane {
                position: [position[0], position[1] - half_height, position[2]],
                normal: [0.0, -1.0, 0.0],
                dimensions: [dimensions[0], dimensions[2]],
                color: [0.2, 0.3, 0.9, 0.1],
                id: NEXT_PLANE_ID.fetch_add(1, Ordering::SeqCst),
            },
        ];
        
        // Создаем ID для нового куба
        let id = NEXT_CUBE_ID.fetch_add(1, Ordering::SeqCst);
        
        // Создаем матрицу трансформации
        let transform = Mat4::from_translation(Vec3::new(position[0], position[1], position[2]));
        let transform_data = Some(SerializableMat4::from(transform));
        
        SpaceCube {
            id,
            position,
            dimensions,
            rotation: [0.0, 0.0, 0.0],
            center_plane,
            boundary_planes,
            is_active: true,
            is_viewing_plane: false, // По умолчанию не является просмотровой плоскостью
            transform: Some(transform),
            transform_data,
        }
    }
    
    // Создать новый куб с основной просмотровой плоскостью (наша страница)
    pub fn new_viewing_plane(width: f32, height: f32, depth: f32) -> Self {
        // Создаем куб с центром в [0,0,0] и заданными размерами
        let mut cube = Self::new([0.0, 0.0, 0.0], [width, height, depth]);
        
        // Отмечаем как просмотровую плоскость
        cube.is_viewing_plane = true;
        
        // Делаем центральную плоскость более заметной
        cube.center_plane.color = [0.5, 0.7, 1.0, 0.5]; // Более яркий и менее прозрачный цвет
        
        // Возвращаем куб
        cube
    }
    
    // Обновить матрицу трансформации на основе текущей позиции и вращения
    pub fn update_transform(&mut self) {
        let position = Vec3::new(self.position[0], self.position[1], self.position[2]);
        let rotation = Quat::from_euler(
            glam::EulerRot::XYZ,
            self.rotation[0],
            self.rotation[1],
            self.rotation[2]
        );
        
        let transform = Mat4::from_rotation_translation(rotation, position);
        self.transform = Some(transform);
        self.transform_data = Some(SerializableMat4::from(transform));
    }
    
    // Получить матрицу трансформации из сериализуемого представления (если необходимо)
    fn ensure_transform(&mut self) {
        if self.transform.is_none() && self.transform_data.is_some() {
            self.transform = self.transform_data.as_ref().map(|data| Mat4::from(data.clone()));
        }
    }
    
    // Проверка, находится ли точка внутри куба с учетом трансформации
    pub fn contains_point(&self, point: [f32; 3]) -> bool {
        // Клонируем себя чтобы получить изменяемую ссылку для ensure_transform
        let mut cube = self.clone();
        cube.ensure_transform();
        
        // Если есть матрица трансформации, применяем обратное преобразование к точке
        if let Some(transform) = cube.transform {
            let point_vec = Vec3::new(point[0], point[1], point[2]);
            let inv_transform = transform.inverse();
            let local_point = inv_transform.transform_point3(point_vec);
            
            // В локальных координатах проверка на AABB очень проста
            let half_width = self.dimensions[0] / 2.0;
            let half_height = self.dimensions[1] / 2.0;
            let half_depth = self.dimensions[2] / 2.0;
            
            local_point.x >= -half_width && local_point.x <= half_width &&
            local_point.y >= -half_height && local_point.y <= half_height &&
            local_point.z >= -half_depth && local_point.z <= half_depth
        } else {
            // Простая проверка AABB без вращения
            let half_width = self.dimensions[0] / 2.0;
            let half_height = self.dimensions[1] / 2.0;
            let half_depth = self.dimensions[2] / 2.0;
            
            point[0] >= self.position[0] - half_width && point[0] <= self.position[0] + half_width &&
            point[1] >= self.position[1] - half_height && point[1] <= self.position[1] + half_height &&
            point[2] >= self.position[2] - half_depth && point[2] <= self.position[2] + half_depth
        }
    }
    
    // Проверка, пересекает ли отрезок центральную плоскость и получение информации о пересечении
    pub fn intersects_center_plane_with_info(&self, start: [f32; 3], end: [f32; 3], object_id: usize, time: f32) -> Option<Intersection> {
        let plane = &self.center_plane;
        let normal = Vec3::new(plane.normal[0], plane.normal[1], plane.normal[2]);
        
        // Вычисляем вектор направления отрезка
        let start_vec = Vec3::new(start[0], start[1], start[2]);
        let end_vec = Vec3::new(end[0], end[1], end[2]);
        let direction = end_vec - start_vec;
        
        // Скалярное произведение нормали и направления
        let dot = normal.dot(direction);
        
        // Если скалярное произведение близко к нулю, отрезок параллелен плоскости
        if dot.abs() < 1e-6 {
            // Параллельные линии не пересекаются
            return None;
        }
        
        // Определяем тип пересечения по знаку скалярного произведения
        let intersection_type = if dot < 0.0 {
            IntersectionType::Exit
        } else {
            IntersectionType::Entry
        };
        
        // Вычисляем вектор от точки плоскости до начала отрезка
        let plane_pos = Vec3::new(plane.position[0], plane.position[1], plane.position[2]);
        let to_start = start_vec - plane_pos;
        
        // Скалярное произведение нормали и вектора к началу отрезка
        let dot_start = normal.dot(to_start);
        
        // Параметр t для точки пересечения
        let t = -dot_start / dot;
        
        // Если t в диапазоне [0, 1], отрезок пересекает плоскость
        if t >= 0.0 && t <= 1.0 {
            // Вычисляем точку пересечения
            let intersection_point = start_vec + direction * t;
            
            // Проверяем, находится ли точка пересечения в пределах размеров плоскости
            let half_width = plane.dimensions[0] / 2.0;
            let half_height = plane.dimensions[1] / 2.0;
            
            let dx = intersection_point.x - plane.position[0];
            let dy = intersection_point.y - plane.position[1];
            
            if dx.abs() <= half_width && dy.abs() <= half_height {
                // Создаем структуру с информацией о пересечении
                let intersection = Intersection {
                    position: [intersection_point.x, intersection_point.y, intersection_point.z],
                    normal: plane.normal,
                    distance: t * direction.length(),
                    intersection_type,
                    object_id,
                    plane_id: plane.id,
                    time,
                };
                
                // Добавляем пересечение в глобальную историю
                if let Ok(mut intersections) = INTERSECTIONS.lock() {
                    intersections.push(intersection.clone());
                    // Ограничиваем размер истории
                    if intersections.len() > 100 {
                        intersections.remove(0);
                    }
                }
                
                return Some(intersection);
            }
        }
        
        None
    }
    
    // Упрощенная проверка пересечения для обратной совместимости
    pub fn intersects_center_plane(&self, start: [f32; 3], end: [f32; 3]) -> bool {
        self.intersects_center_plane_with_info(start, end, 0, 0.0).is_some()
    }
    
    // Рассчитать расстояние от точки до центральной плоскости
    pub fn distance_to_center_plane(&self, point: [f32; 3]) -> f32 {
        let normal = self.center_plane.normal;
        let point_to_plane = [
            point[0] - self.center_plane.position[0],
            point[1] - self.center_plane.position[1],
            point[2] - self.center_plane.position[2],
        ];
        
        // Проекция вектора point_to_plane на нормаль плоскости даст расстояние со знаком
        normal[0] * point_to_plane[0] + normal[1] * point_to_plane[1] + normal[2] * point_to_plane[2]
    }
}

// Сериализуемая структура для передачи данных о кубе в JavaScript
#[derive(Serialize, Deserialize)]
pub struct SpaceCubeData {
    pub id: usize,
    pub position: [f32; 3],
    pub dimensions: [f32; 3],
    pub rotation: [f32; 3],
    pub center_plane_position: [f32; 3],
    pub center_plane_normal: [f32; 3],
    pub center_plane_dimensions: [f32; 2],
    pub center_plane_color: [f32; 4],
    pub boundary_positions: Vec<f32>,
    pub boundary_normals: Vec<f32>,
    pub boundary_dimensions: Vec<f32>,
    pub boundary_colors: Vec<f32>,
}

// WASM-функции для управления пространственными кубами
#[wasm_bindgen]
pub fn create_space_cube(x: f32, y: f32, z: f32, width: f32, height: f32, depth: f32) -> usize {
    log(&format!("Creating space cube at position: [{}, {}, {}], dimensions: [{}, {}, {}]", 
                 x, y, z, width, height, depth));
    
    let cube = SpaceCube::new([x, y, z], [width, height, depth]);
    let id = cube.id;
    
    match SPACE_CUBES.lock() {
        Ok(mut cubes) => {
            cubes.insert(id, cube);
            log(&format!("Created space cube with ID={}", id));
        },
        Err(e) => {
            log(&format!("Error creating space cube: {:?}", e));
            return 0;
        }
    }
    
    id
}

// Создать основную просмотровую плоскость (нашу страницу)
#[wasm_bindgen]
pub fn create_viewing_plane(width: f32, height: f32, depth: f32) -> usize {
    log(&format!("Creating viewing plane with dimensions: [{}, {}, {}]", width, height, depth));
    
    let cube = SpaceCube::new_viewing_plane(width, height, depth);
    let id = cube.id;
    
    match SPACE_CUBES.lock() {
        Ok(mut cubes) => {
            // Если уже есть другая просмотровая плоскость, сбрасываем этот флаг
            for other_cube in cubes.values_mut() {
                if other_cube.is_viewing_plane {
                    other_cube.is_viewing_plane = false;
                }
            }
            
            cubes.insert(id, cube);
            log(&format!("Created viewing plane with ID={}", id));
        },
        Err(e) => {
            log(&format!("Error creating viewing plane: {:?}", e));
            return 0;
        }
    }
    
    id
}

// Получить ID текущей просмотровой плоскости
#[wasm_bindgen]
pub fn get_viewing_plane_id() -> usize {
    match SPACE_CUBES.lock() {
        Ok(cubes) => {
            for (id, cube) in cubes.iter() {
                if cube.is_viewing_plane {
                    return *id;
                }
            }
            return 0; // Если не найдено
        },
        Err(e) => {
            log(&format!("Error getting viewing plane ID: {:?}", e));
            return 0;
        }
    }
}

#[wasm_bindgen]
pub fn get_space_cube_data(cube_id: usize) -> Result<JsValue, JsValue> {
    log(&format!("Getting data for space cube ID={}", cube_id));
    
    match SPACE_CUBES.lock() {
        Ok(cubes) => {
            if let Some(cube) = cubes.get(&cube_id) {
                let mut boundary_positions = Vec::with_capacity(18); // 6 плоскостей * 3 координаты
                let mut boundary_normals = Vec::with_capacity(18);
                let mut boundary_dimensions = Vec::with_capacity(12); // 6 плоскостей * 2 размера
                let mut boundary_colors = Vec::with_capacity(24); // 6 плоскостей * 4 компонента цвета
                
                for plane in &cube.boundary_planes {
                    boundary_positions.extend_from_slice(&plane.position);
                    boundary_normals.extend_from_slice(&plane.normal);
                    boundary_dimensions.extend_from_slice(&plane.dimensions);
                    boundary_colors.extend_from_slice(&plane.color);
                }
                
                let data = SpaceCubeData {
                    id: cube.id,
                    position: cube.position,
                    dimensions: cube.dimensions,
                    rotation: cube.rotation,
                    center_plane_position: cube.center_plane.position,
                    center_plane_normal: cube.center_plane.normal,
                    center_plane_dimensions: cube.center_plane.dimensions,
                    center_plane_color: cube.center_plane.color,
                    boundary_positions,
                    boundary_normals,
                    boundary_dimensions,
                    boundary_colors,
                };
                
                return Ok(serde_wasm_bindgen::to_value(&data)?);
            } else {
                return Err(JsValue::from_str(&format!("Space cube with ID={} not found", cube_id)));
            }
        },
        Err(e) => {
            let error_msg = format!("Error getting space cube data: {:?}", e);
            log(&error_msg);
            return Err(JsValue::from_str(&error_msg));
        }
    }
}

#[wasm_bindgen]
pub fn check_point_in_cube(cube_id: usize, x: f32, y: f32, z: f32) -> bool {
    match SPACE_CUBES.lock() {
        Ok(cubes) => {
            if let Some(cube) = cubes.get(&cube_id) {
                return cube.contains_point([x, y, z]);
            }
        },
        Err(e) => {
            log(&format!("Error checking point in cube: {:?}", e));
        }
    }
    false
}

#[wasm_bindgen]
pub fn check_line_intersection_with_center_plane(
    cube_id: usize,
    start_x: f32, start_y: f32, start_z: f32,
    end_x: f32, end_y: f32, end_z: f32
) -> bool {
    match SPACE_CUBES.lock() {
        Ok(cubes) => {
            if let Some(cube) = cubes.get(&cube_id) {
                return cube.intersects_center_plane(
                    [start_x, start_y, start_z],
                    [end_x, end_y, end_z]
                );
            }
        },
        Err(e) => {
            log(&format!("Error checking line intersection: {:?}", e));
        }
    }
    false
}

// Функция для обновления и модификации параметров куба
#[wasm_bindgen]
pub fn update_space_cube(
    cube_id: usize,
    x: f32, y: f32, z: f32,
    width: f32, height: f32, depth: f32,
    rot_x: f32, rot_y: f32, rot_z: f32
) -> bool {
    match SPACE_CUBES.lock() {
        Ok(mut cubes) => {
            if let Some(cube) = cubes.get_mut(&cube_id) {
                cube.position = [x, y, z];
                cube.dimensions = [width, height, depth];
                cube.rotation = [rot_x, rot_y, rot_z];
                
                // Обновляем центральную плоскость
                cube.center_plane.position = cube.position;
                cube.center_plane.dimensions = [width * 0.9, height * 0.9];
                
                // Обновляем граничные плоскости
                let half_width = width / 2.0;
                let half_height = height / 2.0;
                let half_depth = depth / 2.0;
                
                // Обновляем положение 6 плоскостей
                cube.boundary_planes[0].position = [x, y, z + half_depth]; // Передняя (Z+)
                cube.boundary_planes[1].position = [x, y, z - half_depth]; // Задняя (Z-)
                cube.boundary_planes[2].position = [x + half_width, y, z]; // Правая (X+)
                cube.boundary_planes[3].position = [x - half_width, y, z]; // Левая (X-)
                cube.boundary_planes[4].position = [x, y + half_height, z]; // Верхняя (Y+)
                cube.boundary_planes[5].position = [x, y - half_height, z]; // Нижняя (Y-)
                
                // Обновляем размеры плоскостей
                cube.boundary_planes[0].dimensions = [width, height];
                cube.boundary_planes[1].dimensions = [width, height];
                cube.boundary_planes[2].dimensions = [depth, height];
                cube.boundary_planes[3].dimensions = [depth, height];
                cube.boundary_planes[4].dimensions = [width, depth];
                cube.boundary_planes[5].dimensions = [width, depth];
                
                return true;
            }
        },
        Err(e) => {
            log(&format!("Error updating space cube: {:?}", e));
        }
    }
    false
} 