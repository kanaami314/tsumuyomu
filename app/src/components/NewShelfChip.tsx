import { useState, type FormEvent } from 'react'

interface Props {
  className?: string
  /** 棚を作る。失敗したら false */
  onCreate: (name: string) => Promise<boolean>
}

// 「+ 棚」を押すと、その場で名前を入れて棚を作れる
export default function NewShelfChip({ className = 'chip add', onCreate }: Props) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [failed, setFailed] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setEditing(false)
      return
    }
    if (await onCreate(trimmed)) {
      setName('')
      setFailed(false)
      setEditing(false)
    } else {
      setFailed(true)
    }
  }

  if (!editing) {
    return (
      <button type="button" className={className} onClick={() => setEditing(true)}>
        + 棚
      </button>
    )
  }
  return (
    <form className="new-shelf" onSubmit={submit}>
      <input
        autoFocus
        value={name}
        maxLength={40}
        placeholder="棚の名前"
        aria-label="新しい棚の名前"
        onChange={(e) => setName(e.target.value)}
        onBlur={() => !name.trim() && setEditing(false)}
      />
      {failed && <small role="alert">作れませんでした</small>}
    </form>
  )
}
