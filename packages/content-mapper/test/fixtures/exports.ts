import utilizeSchema from '@utilize/content-mapper/vite';

// Type-checks the documented bundler entry point, including its declarations.
export const plugin = utilizeSchema({ target: 'zod' });
