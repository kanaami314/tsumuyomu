import type { CSSProperties } from 'react'
import Icon from './Icon'

interface Props {
  value: number
  max?: number
  className?: string
}

// 刺さった度は、しおりの数で表す。塗られたしおりは、1 つずつ順に現れる(--n)
export default function Bookmarks({ value, max = 5, className }: Props) {
  return (
    <div className={className} role="img" aria-label={`刺さった度 ${value} / ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <Icon
          key={i}
          name={i < value ? 'bookmark-filled' : 'bookmark'}
          className={i < value ? 'f' : undefined}
          style={{ '--n': i } as CSSProperties}
        />
      ))}
    </div>
  )
}
