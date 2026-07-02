import { cn } from '@/lib/utils'

interface FileBreadcrumbProps {
  breadcrumbs: string[]
  currentPath: string
  onNavigate: (index: number) => void
}

export function FileBreadcrumb({ breadcrumbs, currentPath, onNavigate }: FileBreadcrumbProps) {
  if (breadcrumbs.length === 0) return null

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 text-xs border-b overflow-x-auto shrink-0">
      {breadcrumbs.map((part, index) => {
        const isLast = index === breadcrumbs.length - 1
        return (
          <div key={index} className="flex items-center gap-0.5 whitespace-nowrap">
            {index > 0 && (
              <span className="text-muted-foreground/40 select-none">›</span>
            )}
            <button
              onClick={() => !isLast && onNavigate(index)}
              disabled={isLast}
              className={cn(
                'px-1 py-0.5 rounded transition-colors',
                isLast
                  ? 'text-muted-foreground cursor-default font-medium'
                  : 'text-primary hover:underline cursor-pointer hover:bg-accent/50'
              )}
            >
              {part}
            </button>
          </div>
        )
      })}
    </div>
  )
}
