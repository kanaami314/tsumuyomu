import type { CSSProperties } from 'react'
import {
  IconBookmark,
  IconBookmarkFilled,
  IconBooks,
  IconBrandGoogle,
  IconCircleCheck,
  IconHistory,
  IconHome,
  IconLeaf,
  IconLink,
  IconPlus,
  IconUser,
  IconWorld,
  IconX,
} from '@tabler/icons-react'

// 使うアイコンだけを読み込む(フォントで全部を読み込むと、約 860KB になる)
const ICONS = {
  bookmark: IconBookmark,
  'bookmark-filled': IconBookmarkFilled,
  books: IconBooks,
  google: IconBrandGoogle,
  'circle-check': IconCircleCheck,
  history: IconHistory,
  home: IconHome,
  leaf: IconLeaf,
  link: IconLink,
  plus: IconPlus,
  user: IconUser,
  world: IconWorld,
  x: IconX,
}

export type IconName = keyof typeof ICONS

interface Props {
  name: IconName
  className?: string
  style?: CSSProperties
  /** 意味をもつアイコンには、読み上げ用の名前を付ける。飾りなら、付けない */
  label?: string
}

export default function Icon({ name, className, style, label }: Props) {
  const Component = ICONS[name]
  return (
    <Component
      className={className ? `ico ${className}` : 'ico'}
      style={style}
      size="1em"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  )
}
