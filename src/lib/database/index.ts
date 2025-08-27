// Stub database to prevent SSR issues
// This file replaces the original to avoid sql.js imports

console.warn('Database functionality is temporarily stubbed to prevent SSR issues')

export async function initializeDatabase() {
  return null as any
}

export async function getDatabase() {
  return null as any
}

export async function saveDatabase() {
  // Do nothing
}

export async function clearDatabase() {
  // Do nothing  
}

export async function exportDatabase() {
  return new Uint8Array()
}

export async function importDatabase() {
  // Do nothing
}

export async function getDatabaseStats() {
  return {
    size: 0,
    tables: [],
    totalRows: 0
  }
}