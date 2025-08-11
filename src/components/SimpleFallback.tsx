interface HeroImageProps {
  query?: string
  className?: string
  children?: React.ReactNode
}

export function HeroImage({ 
  className = '',
  children
}: HeroImageProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 object-cover w-full h-full">
        {/* Simple gradient background */}
      </div>
      
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
  className = '',
  small = false
}: CardImageProps) {
  const size = small ? 'w-6 h-6' : 'w-8 h-8'
  
  return (
    <div className={`${size} bg-gradient-to-r from-blue-500 to-purple-500 rounded ${className}`}>
      {/* Simple colored div instead of image */}
    </div>
  )
}