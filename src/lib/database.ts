// Safe database wrapper that prevents SSR issues by disabling database functionality
// This prevents sql.js from being bundled and causing fs module errors

console.warn('Database functionality is temporarily disabled to prevent SSR issues')

// Stub functions that do nothing but don't break the app
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