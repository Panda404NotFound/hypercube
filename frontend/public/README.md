# Public Directory Structure

This directory contains all static assets for the HYPERCUBE project. For Next.js applications, all files in this directory are served at the root path (`/`).

## Directory Structure

```
frontend/public/
├── background.png         # Main background image
├── synth_logo.png         # .synth logo
├── fonts/                 # Custom fonts
│   ├── Geist-Regular.woff2
│   ├── Geist-Medium.woff2
│   └── Akatab-Regular.woff2
└── images/                # Additional images and icons
```

## Usage

- **Images**: Use the `<Image>` component from Next.js to load images with proper optimization.
- **Fonts**: Font files are loaded via CSS `@font-face` declarations in `globals.css`.
- **Other static assets**: Access directly via URL path, e.g., `/some-file.pdf`.

## Notes for Developers

1. Always place static assets in this directory, not in the project root's `/public` directory.
2. Use relative paths starting with `/` when referencing these files in your code.
3. When adding new font files, update the `@font-face` declarations in `globals.css`. 