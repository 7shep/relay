import React from 'react'

function renderInline(text, keyPrefix) {
  return text.split(/(\*\*.*?\*\*|`.*?`)/g).map((part, index) => {
    const key = `${keyPrefix}-${index}`
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={key}>{part.slice(1, -1)}</code>
    return <React.Fragment key={key}>{part}</React.Fragment>
  })
}

export default function AssistantMarkdown({ text }) {
  return <div className="assistant-markdown">{text.split('\n').map((line, index) => {
    const key = `line-${index}`
    if (!line) return <span className="assistant-break" key={key} aria-hidden="true" />
    if (line.startsWith('> ')) return <blockquote key={key}>{renderInline(line.slice(2), key)}</blockquote>
    if (/^\d+\. /.test(line)) { const [, number, content] = line.match(/^(\d+)\. (.*)$/); return <div className="assistant-list-item" key={key}><span>{number}.</span><p>{renderInline(content, key)}</p></div> }
    if (line.startsWith('- ')) return <div className="assistant-list-item assistant-bullet" key={key}><span>â€“</span><p>{renderInline(line.slice(2), key)}</p></div>
    if (line.startsWith('**') && line.endsWith('**')) return <p className="assistant-heading" key={key}>{renderInline(line, key)}</p>
    return <p key={key}>{renderInline(line, key)}</p>
  })}</div>
}
