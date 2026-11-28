/** Nombre para comparar: sin distinguir mayúsculas ni espacios sobrantes ("Juan  PÉREZ" = "juan pérez"); las tildes sí cuentan */
export const nameKey = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleUpperCase('es')

/** Documento oficial (DNI, RUC, CI, NIT, RIF…) para comparar: solo letras y números, en mayúsculas ("J-1234.567-8" = "j12345678") */
export const docKey = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, '')
