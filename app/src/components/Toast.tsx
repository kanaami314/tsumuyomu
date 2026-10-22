import { useEffect } from 'react'

interface Props {
  message: string
  onDone: () => void
}

// 記録したあとの、短いお知らせ。しばらくすると、消える
export default function Toast({ message, onDone }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2400)
    return () => clearTimeout(timer)
  }, [message, onDone])

  return (
    <div className="toast" role="status">
      {message}
    </div>
  )
}
