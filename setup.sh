#!/bin/bash

echo "🔮 HYPERCUBE - Initializing development environment..."

# Проверка требований
echo "📋 Checking system requirements..."

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v18 or later."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version is too old. Please install Node.js v18 or later."
    exit 1
fi
echo "✅ Node.js $(node -v) detected"

# Проверка npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi
echo "✅ npm $(npm -v) detected"

# Проверка Rust
if ! command -v rustc &> /dev/null; then
    echo "❌ Rust is not installed. Please install Rust."
    echo "   You can install Rust using: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi
echo "✅ Rust $(rustc --version | cut -d' ' -f2) detected"

# Проверка cargo
if ! command -v cargo &> /dev/null; then
    echo "❌ Cargo is not installed. Please install Cargo (comes with Rust)."
    exit 1
fi
echo "✅ Cargo detected"

# Проверка wasm-pack
if ! command -v wasm-pack &> /dev/null; then
    echo "⚠️ wasm-pack is not installed. Installing now..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
else
    echo "✅ wasm-pack detected"
fi

# Установка зависимостей
echo "📦 Installing dependencies for all workspaces..."
npm install

# Сборка WASM модулей
echo "🧩 Building WebAssembly modules..."
cd wasm && npm run build:dev
cd ..

echo "🚀 HYPERCUBE setup complete! You can start development with:"
echo "   npm run dev       - Start all components"
echo "   npm run dev:frontend - Start only the frontend"
echo "   npm run dev:backend  - Start only the backend"
echo "   npm run dev:wasm     - Rebuild the WASM modules"
echo ""
echo "🌌 Enjoy creating your hyperdimensional experience!" 