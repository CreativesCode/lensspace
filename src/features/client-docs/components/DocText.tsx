import { parseInline } from '../generators/docBlocks'

// Inline text of the manual: **bold** and «UI label» (drawn as a small chip).
export function DocText({ text, uiClassName }: { text: string; uiClassName: string }) {
  return <>{parseInline(text).map((part, index) => part.kind === 'strong' ? <strong key={index}>{part.text}</strong>
    : part.kind === 'ui' ? <span key={index} className={uiClassName}>{part.text}</span>
      : part.text)}</>
}
