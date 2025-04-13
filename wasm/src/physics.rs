use wasm_bindgen::prelude::*;
use rapier3d::prelude::*;
use std::collections::HashMap;

// Global storage for physics worlds
static mut PHYSICS_WORLDS: Option<HashMap<usize, PhysicsWorld>> = None;
static mut NEXT_WORLD_ID: usize = 0;

pub struct PhysicsWorld {
    pub rigid_body_set: RigidBodySet,
    pub collider_set: ColliderSet,
    pub gravity: Vector<Real>,
    pub integration_parameters: IntegrationParameters,
    pub physics_pipeline: PhysicsPipeline,
    pub island_manager: IslandManager,
    pub broad_phase: BroadPhase,
    pub narrow_phase: NarrowPhase,
    pub impulse_joint_set: ImpulseJointSet,
    pub multibody_joint_set: MultibodyJointSet,
    pub ccd_solver: CCDSolver,
    pub query_pipeline: QueryPipeline,
    pub hooks: (),
    pub events: ()
}

// Initialize physics world
pub fn init_world() -> usize {
    let gravity = vector![0.0, -9.81, 0.0];
    let integration_parameters = IntegrationParameters::default();
    let physics_pipeline = PhysicsPipeline::new();
    let island_manager = IslandManager::new();
    let broad_phase = BroadPhase::new();
    let narrow_phase = NarrowPhase::new();
    let rigid_body_set = RigidBodySet::new();
    let collider_set = ColliderSet::new();
    let impulse_joint_set = ImpulseJointSet::new();
    let multibody_joint_set = MultibodyJointSet::new();
    let ccd_solver = CCDSolver::new();
    let query_pipeline = QueryPipeline::new();
    let hooks = ();
    let events = ();

    let world = PhysicsWorld {
        rigid_body_set,
        collider_set,
        gravity,
        integration_parameters,
        physics_pipeline,
        island_manager,
        broad_phase,
        narrow_phase,
        impulse_joint_set,
        multibody_joint_set,
        ccd_solver,
        query_pipeline,
        hooks,
        events
    };

    // Save the world in global storage
    unsafe {
        let raw_ptr = &raw const PHYSICS_WORLDS;
        if (*raw_ptr).is_none() {
            PHYSICS_WORLDS = Some(HashMap::new());
        }
        
        let id = NEXT_WORLD_ID;
        NEXT_WORLD_ID += 1;
        
        if let Some(worlds) = &mut *(&raw mut PHYSICS_WORLDS) {
            worlds.insert(id, world);
        }
        
        id
    }
}

// Function for simulation step
#[wasm_bindgen]
pub fn step_simulation(world_id: usize, dt: f32) -> bool {
    unsafe {
        if let Some(worlds) = &mut *(&raw mut PHYSICS_WORLDS) {
            if let Some(world) = worlds.get_mut(&world_id) {
                world.integration_parameters.dt = dt;
                
                // Update query_pipeline before simulation step
                world.query_pipeline.update(&world.rigid_body_set, &world.collider_set);
                
                world.physics_pipeline.step(
                    &world.gravity,
                    &world.integration_parameters,
                    &mut world.island_manager,
                    &mut world.broad_phase,
                    &mut world.narrow_phase,
                    &mut world.rigid_body_set,
                    &mut world.collider_set,
                    &mut world.impulse_joint_set,
                    &mut world.multibody_joint_set,
                    &mut world.ccd_solver,
                    None,
                    &world.hooks,
                    &world.events,
                );

                // Update the query pipeline
                world.query_pipeline.update(
                    &world.rigid_body_set,
                    &world.collider_set,
                );
                
                return true;
            }
        }
        
        false
    }
} 