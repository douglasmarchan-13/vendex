// Matchers de DOM (toBeInTheDocument, toHaveClass…) sobre el `expect` global (globals: true).
// No se importa desde 'vitest': en Windows, con la terminal en "c:\" minúscula, ese import puede resolver
// a otra instancia de Vitest y los matchers no se registran.
import * as matchers from '@testing-library/jest-dom/matchers'

globalThis.expect.extend(matchers)
