export default function Panel({ path, meta, children, primary = false, index = 0, className = '' }) {
  return (
    <section className={`terminal-panel ${primary ? 'primary-panel' : ''} ${className}`} style={{ '--panel-delay': `${Math.min(index, 4) * 45}ms` }}>
      <header className="panel-header"><h2><span>$ cat </span>{path}</h2>{meta && <div className="panel-meta">{meta}</div>}</header>
      <div className="panel-body">{children}</div>
    </section>
  )
}


