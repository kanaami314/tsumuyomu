interface Props {
  title: string
  note: string
}

export default function Placeholder({ title, note }: Props) {
  return (
    <section className="screen placeholder" aria-label={title}>
      <h1>{title}</h1>
      <p>{note}</p>
    </section>
  )
}
