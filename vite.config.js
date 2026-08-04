import { defineConfig } from 'vite';

/**
 * 98.css 0.1.21 contains the invalid media query `@media (not(hover))`.
 * Repair it in memory before Vite's CSS pipeline processes the stylesheet.
 */
function repair98CssMediaQuery() {
  const invalidQuery = '@media (not(hover))';
  const validQuery = '@media (hover: none)';

  return {
    name: 'repair-98-css-media-query',
    enforce: 'pre',

    transform(code, id) {
      const filePath = id.replaceAll('\\', '/').split('?')[0];

      if (!filePath.endsWith('/node_modules/98.css/dist/98.css')) {
        return null;
      }

      if (!code.includes(invalidQuery)) {
        return null;
      }

      return {
        code: code.replaceAll(invalidQuery, validQuery),
        map: null,
      };
    },
  };
}

export default defineConfig({
  // Keep generated assets portable to static hosts and subdirectories.
  base: './',

  plugins: [repair98CssMediaQuery()],
});