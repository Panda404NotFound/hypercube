/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Add WASM support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      syncWebAssembly: true,
    };

    // Add support for glsl shader files
    config.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      exclude: /node_modules/,
      use: ['raw-loader', 'glslify-loader'],
    });

    // Add alias for WASM modules
    config.resolve.alias = {
      ...config.resolve.alias,
      '@wasm/hypercube_wasm': require.resolve('../wasm/pkg'),
    };

    return config;
  },
  // Configure asset optimization
  images: {
    unoptimized: true,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Allow importing from wasm package
  transpilePackages: ['hypercube-wasm'],
};

module.exports = nextConfig; 