import React from 'react';

function renderInlineMarkdown(text: string): React.ReactNode {
  const tokens: React.ReactNode[] = [];
  const remaining = text;
  let keyIdx = 0;

  // Regex to match **bold**, `code`, or *italic*
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(remaining)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(remaining.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push(
        <strong key={`b-${keyIdx++}`} className="font-bold text-[#0F172A]">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push(
        <code key={`c-${keyIdx++}`} className="px-1.5 py-0.5 rounded-md bg-slate-100 text-emerald-800 font-mono text-[11px] border border-slate-200">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      tokens.push(
        <em key={`i-${keyIdx++}`} className="italic text-slate-700">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < remaining.length) {
    tokens.push(remaining.substring(lastIndex));
  }

  return tokens.length > 0 ? tokens : text;
}

export default function AiMarkdownContent({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let isOrderedList = false;

  const flushList = () => {
    if (listItems.length > 0) {
      const ListTag = isOrderedList ? 'ol' : 'ul';
      elements.push(
        <ListTag
          key={`list-${elements.length}`}
          className={`my-2 space-y-1 ${isOrderedList ? 'list-decimal' : 'list-disc'} pl-5 text-xs sm:text-sm text-[#0F172A]`}
        >
          {listItems}
        </ListTag>
      );
      listItems = [];
      isOrderedList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Empty line
    if (!trimmed) {
      flushList();
      elements.push(<div key={`sp-${i}`} className="h-1.5" />);
      continue;
    }

    // Divider
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      flushList();
      elements.push(<hr key={`hr-${i}`} className="my-3 border-slate-200" />);
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${i}`} className="text-xs sm:text-sm font-extrabold text-[#0F172A] mt-3.5 mb-1 flex items-center gap-1.5">
          <span className="w-1.5 h-3.5 bg-[#37C6A3] rounded-full inline-block shrink-0" />
          <span>{renderInlineMarkdown(trimmed.slice(4))}</span>
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={`h2-${i}`} className="text-sm sm:text-base font-extrabold text-[#0F172A] border-b border-slate-200 pb-1 mt-4 mb-1.5 flex items-center gap-2">
          <span>{renderInlineMarkdown(trimmed.slice(3))}</span>
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={`h1-${i}`} className="text-base sm:text-lg font-black text-[#0F172A] border-b-2 border-[#37C6A3]/40 pb-1.5 mt-4 mb-2">
          {renderInlineMarkdown(trimmed.slice(2))}
        </h1>
      );
      continue;
    }

    // Blockquote (Callouts, Quotes, Quran/Hadith citations)
    if (trimmed.startsWith('>')) {
      flushList();
      elements.push(
        <blockquote key={`bq-${i}`} className="my-2.5 pl-3.5 py-2 border-l-3 border-[#37C6A3] bg-emerald-50/70 rounded-r-xl text-xs sm:text-sm text-slate-800 italic leading-relaxed">
          {renderInlineMarkdown(trimmed.replace(/^>\s*/, ''))}
        </blockquote>
      );
      continue;
    }

    // Bullet List (- or *)
    const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      if (isOrderedList) flushList();
      isOrderedList = false;
      listItems.push(
        <li key={`li-${i}`} className="leading-relaxed">
          {renderInlineMarkdown(bulletMatch[1])}
        </li>
      );
      continue;
    }

    // Numbered List (1. ...)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      if (!isOrderedList && listItems.length > 0) flushList();
      isOrderedList = true;
      listItems.push(
        <li key={`li-num-${i}`} className="leading-relaxed">
          {renderInlineMarkdown(numMatch[2])}
        </li>
      );
      continue;
    }

    // Standard paragraph line
    flushList();
    elements.push(
      <p key={`p-${i}`} className="text-xs sm:text-sm leading-relaxed text-[#0F172A]">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
  }

  flushList();

  return <div className="space-y-1 text-left">{elements}</div>;
}
