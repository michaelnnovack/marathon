import { createApi } from 'unsplash-js'

// Create Unsplash API instance
export const unsplash = createApi({
  accessKey: process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY || 'demo',
})

export interface UnsplashImage {
  id: string
  urls: {
    raw: string
    full: string
    regular: string
    small: string
    thumb: string
  }
  alt_description: string | null
  user: {
    name: string
    username: string
  }
  links: {
    html: string
  }
}

// Simple in-memory cache for images
const imageCache = new Map<string, UnsplashImage[]>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Search for running/marathon related images
export async function getRunningImages(query: string = 'marathon running', count: number = 10) {
  const cacheKey = `${query}-${count}`
  
  // Check cache first
  if (imageCache.has(cacheKey)) {
    const cached = imageCache.get(cacheKey)!
    return cached
  }

  try {
    const result = await unsplash.search.getPhotos({
      query,
      page: 1,
      perPage: count,
      orientation: 'landscape',
    })
    
    if (result.errors) {
      console.warn('Unsplash API errors:', result.errors)
      return []
    }
    
    const images = result.response?.results || []
    
    // Cache the results
    if (images.length > 0) {
      imageCache.set(cacheKey, images)
      // Auto-clear cache after duration
      setTimeout(() => {
        imageCache.delete(cacheKey)
      }, CACHE_DURATION)
    }
    
    return images
  } catch (error) {
    console.error('Error fetching Unsplash images:', error)
    return []
  }
}

// Get specific collections for different contexts
export const imageCollections = {
  hero: () => getRunningImages('marathon finish line runner victory', 3),
  dashboard: () => getRunningImages('running shoes trail path', 2), 
  training: () => getRunningImages('athlete training workout', 4),
  upload: () => getRunningImages('GPS watch running data', 2),
  setup: () => getRunningImages('runner preparation stretching', 2),
  plan: () => getRunningImages('training schedule calendar', 2),
  motivation: () => getRunningImages('marathon runner motivation', 6),
}

// Fallback images when Unsplash is not available - using placeholder.com service
export const fallbackImages = {
  hero: 'https://via.placeholder.com/1200x400/4f46e5/ffffff?text=Marathon+Training',
  dashboard: 'https://via.placeholder.com/800x300/10b981/ffffff?text=Dashboard', 
  training: 'https://via.placeholder.com/600x300/f59e0b/ffffff?text=Training',
  upload: 'https://via.placeholder.com/400x200/ef4444/ffffff?text=Upload',
  setup: 'https://via.placeholder.com/400x200/8b5cf6/ffffff?text=Setup',
  plan: 'https://via.placeholder.com/400x200/06b6d4/ffffff?text=Plan',
}