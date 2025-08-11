'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { getRunningImages, fallbackImages, type UnsplashImage } from '@/lib/unsplash'

interface UnsplashImageProps {
  query?: string
  fallback?: keyof typeof fallbackImages
  width?: number
  height?: number
  className?: string
  alt?: string
  priority?: boolean
  sizes?: string
}

export function UnsplashImage({ 
  query = 'marathon running',
  fallback = 'hero',
  width = 800,
  height = 400,
  className = '',
  alt = 'Running image',
  priority = false,
  sizes = '(max-width: 768px) 100vw, 50vw'
}: UnsplashImageProps) {
  const [image, setImage] = useState<UnsplashImage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout

    // Fast fallback - show fallback after 1 second
    const fallbackTimeout = setTimeout(() => {
      if (mounted) {
        setError(true)
        setLoading(false)
      }
    }, 1000)

    const fetchImage = async () => {
      try {
        // Much shorter timeout to prevent blocking
        const images = await Promise.race([
          getRunningImages(query, 1),
          new Promise<[]>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Timeout')), 2000)
          })
        ])

        if (mounted && images.length > 0) {
          clearTimeout(fallbackTimeout)
          setImage(images[0])
          setLoading(false)
        }
      } catch {
        // Silently fail to fallback - already handled by fallbackTimeout
      }
    }

    // Start fetch but don't block on it
    fetchImage()

    return () => {
      mounted = false
      clearTimeout(fallbackTimeout)
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [query])

  if (loading) {
    return (
      <div 
        className={`bg-gray-200 dark:bg-gray-800 animate-pulse ${className}`}
        style={{ width, height }}
      >
        <div className="w-full h-full flex items-center justify-center text-gray-400">
          Loading...
        </div>
      </div>
    )
  }

  if (error || !image) {
    return (
      <Image
        src={fallbackImages[fallback]}
        alt={alt}
        width={width}
        height={height}
        className={className}
        priority={priority}
        sizes={sizes}
      />
    )
  }

  return (
    <div className="relative group">
      <Image
        src={image.urls.regular}
        alt={image.alt_description || alt}
        width={width}
        height={height}
        className={className}
        priority={priority}
        sizes={sizes}
      />
      
      {/* Attribution overlay */}
      <div className="absolute bottom-0 right-0 bg-black/50 text-white text-xs px-2 py-1 rounded-tl opacity-0 group-hover:opacity-100 transition-opacity">
        <a 
          href={`${image.links.html}?utm_source=marathon-trainer&utm_medium=referral`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          {image.user.name}
        </a>
        {' on '}
        <a 
          href="https://unsplash.com/?utm_source=marathon-trainer&utm_medium=referral"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          Unsplash
        </a>
      </div>
    </div>
  )
}

interface HeroImageProps {
  query?: string
  className?: string
  children?: React.ReactNode
}

export function HeroImage({ 
  query = 'marathon runner finish line victory',
  className = '',
  children
}: HeroImageProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <UnsplashImage
        query={query}
        fallback="hero"
        width={1200}
        height={400}
        className="object-cover w-full h-full"
        alt="Marathon training hero image"
        priority={true}
        sizes="100vw"
      />
      
      {/* Overlay gradient for text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent" />
      
      {children && (
        <div className="absolute inset-0 flex items-center justify-start p-8">
          <div className="text-white max-w-2xl">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

interface CardImageProps {
  query?: string
  className?: string
  small?: boolean
}

export function CardImage({ 
  query = 'running training workout',
  className = '',
  small = false
}: CardImageProps) {
  const dimensions = small ? { width: 300, height: 150 } : { width: 400, height: 200 }
  
  return (
    <UnsplashImage
      query={query}
      fallback="training"
      width={dimensions.width}
      height={dimensions.height}
      className={`object-cover rounded-lg ${className}`}
      alt="Training image"
      sizes={small ? '300px' : '400px'}
    />
  )
}