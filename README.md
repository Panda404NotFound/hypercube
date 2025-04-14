# HYPERCUBE

HYPERCUBE is an immersive 3D decentralized Synth Studio with a revolutionary spatial interface based on hypercube geometry.

## Project Architecture

HYPERCUBE is a monorepo project with a modular architecture consisting of three main components:
- Frontend: Next.js application with Three.js for 3D rendering
- Backend: Express API server
- WebAssembly: Rust modules for high-performance physics and particle simulations

## Important Note on Static Assets

All static assets (images, fonts, etc.) should be placed in the `frontend/public` directory, not in the root-level `public` directory. 
Next.js serves files from `frontend/public` at the root path (`/`). See `frontend/public/README.md` for more details.

## Project Structure

```
hypercube/
├── frontend/                  # Next.js application
│   ├── src/                   # Source code
│   │   ├── app/               # Next.js app router components
│   │   ├── components/        # Reusable React components
│   │   ├── shaders/           # GLSL shader files
│   │   │   ├── hypercube.frag # Fragment shader for hypercube
│   │   │   ├── hypercube.vert # Vertex shader for hypercube
│   │   │   └── cosmicBackground.frag # Fragment shader for cosmic background
│   │   ├── store/             # Zustand state management
│   │   ├── hooks/             # Custom React hooks
│   │   ├── types/             # TypeScript type definitions
│   │   └── utils/             # Utility functions
│   ├── public/                # Static assets (PLACE ALL ASSETS HERE)
│   ├── next.config.js         # Next.js configuration
│   └── tailwind.config.js     # Tailwind CSS configuration
│
├── backend/                   # Express API server
│   ├── src/                   # Source code
│   │   ├── routes/            # API route definitions
│   │   ├── middleware/        # Express middleware
│   │   └── utils/             # Utility functions
│   ├── controllers/           # Request handlers
│   ├── models/                # Data models
│   ├── services/              # Business logic
│   └── config/                # Configuration files
│
├── wasm/                      # Rust WebAssembly modules
│   ├── src/                   # Rust source code
│   │   ├── lib.rs             # Library entry point
│   │   ├── physics.rs         # Physics simulation using Rapier
│   │   ├── particles.rs       # Particle system implementation
│   │   ├── hypercube.rs       # Hypercube geometry calculations
│   │   ├── space_objects.rs   # Space objects definitions and behaviors
│   │   ├── objective_main.rs  # Spatial system core with planes and cubes
│   │   ├── neon_comets.rs     # Neon comet object implementation
│   │   └── utils.rs           # Utility functions
│   ├── pkg/                   # Compiled WebAssembly output
│   └── Cargo.toml             # Rust dependencies and configuration
│
└── package.json               # Root package.json for monorepo management
```

## Technical Stack

### Frontend

| Technology | Version | Description |
|------------|---------|-------------|
| Next.js | 14.2.28 | React framework with server-side rendering and static site generation |
| React | 18.2.0 | UI library for building component-based interfaces |
| TypeScript | 5.4.2 | Typed superset of JavaScript |
| Three.js | 0.162.0 | 3D graphics library for WebGL rendering |
| @react-three/fiber | 8.15.19 | React renderer for Three.js |
| @react-three/drei | 9.97.6 | Useful helpers for React Three Fiber |
| @react-three/postprocessing | 2.16.2 | Post-processing effects for React Three Fiber |
| GLSL/glslify | 7.1.1 | Shader language and modular shader compiler |
| Zustand | 4.5.3 | Small, fast state management solution |
| GSAP | 3.12.5 | Animation library for smooth transitions |
| Tailwind CSS | 3.4.1 | Utility-first CSS framework |
| Framer Motion | 11.0.20 | Animation library for React |

### Backend

| Technology | Version | Description |
|------------|---------|-------------|
| Node.js | >= 22.0.0 | JavaScript runtime |
| Express | 4.19.1 | Web framework for Node.js |
| TypeScript | 5.4.2 | Typed JavaScript |
| Winston | 3.12.0 | Logging library |
| Helmet | 7.1.0 | Security middleware for Express |
| Cors | 2.8.5 | Cross-Origin Resource Sharing middleware |
| Morgan | 1.10.0 | HTTP request logger middleware |
| Dotenv | 16.4.5 | Environment variable loader |

### WebAssembly (Rust)

| Technology | Version | Description |
|------------|---------|-------------|
| Rust | >= 1.84.0 | Systems programming language for WebAssembly compilation |
| wasm-bindgen | 0.2.92 | Facilitates high-level interactions between Rust and JavaScript |
| Rapier3D | 0.18.0 | Physics engine for 3D simulations |
| glam | 0.25.0 | High-performance math library for computer graphics |
| nalgebra | 0.32.4 | Linear algebra library for graphics and physics calculations |
| parry3d | 0.13.5 | Collision detection and proximity queries |
| bevy_math | 0.11.3 | Mathematics utilities from Bevy for 3D operations |
| noise | 0.8.2 | Library for Perlin, Simplex and other noise algorithms |
| rand | 0.8.5 | Random number generation |
| serde | 1.0.197 | Serialization/deserialization framework |
| web-sys | 0.3.64 | Bindings for Web APIs |
| js-sys | 0.3.69 | Bindings for JavaScript's standard library |

## Spatial System Architecture

HYPERCUBE implements a revolutionary spatial interface concept where:

1. **Spatial Coordinate System**: The application exists in a 3D coordinate space where:
   - The user's viewport is a central plane at Z=0
   - Objects can move from negative Z-space (behind the viewport) through the viewport to positive Z-space
   - Interface elements exist as planes in this coordinate system

2. **Viewing Plane**: The main interface that users interact with:
   - Exists at Z=0 in the coordinate system
   - Represented as a 2D plane in 3D space
   - Objects in space can intersect and interact with this plane

3. **Object Interaction**: 
   - 3D objects (neon comets, energy spheres, etc.) can move through the viewing plane
   - When objects pass through the viewing plane, special visual effects are triggered
   - Physics simulations allow for realistic interactions between objects and planes

4. **Space Cubes**: 
   - Define bounded regions of 3D space
   - Contain central planes and boundary planes
   - Allow for point-in-volume and intersection tests

## Development Workflow

The project uses a monorepo approach with workspaces for each component:

- **Frontend**: Next.js development with hot reloading
- **Backend**: Express server with ts-node-dev for auto-restart
- **WebAssembly**: Rust compiled to WebAssembly with wasm-pack

## Key Features

1. **Immersive 3D Interface**: Built with Three.js and React Three Fiber
2. **High-performance Physics**: Implemented with Rust and Rapier3D
3. **Particle Systems**: Custom WebAssembly particle simulation
4. **Spatial Navigation**: Objects moving through defined planes and spaces
5. **Custom Shaders**: GLSL shaders for visual effects (cosmic background, hypercube)
6. **Responsive Design**: Adapts to different devices and screen sizes

## Architecture Design Patterns

- **Component-Based Architecture**: React components with proper separation of concerns
- **State Management**: Zustand for global state 
- **WebAssembly Integration**: High-performance modules integrated with JavaScript
- **Server-Side Rendering**: Next.js for optimal loading performance
- **API Layer**: Express backend with RESTful endpoints
- **Spatial Coordinate System**: Mathematical model of 3D space with defined planes and intersections

## License

MIT