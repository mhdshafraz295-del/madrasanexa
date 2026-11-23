import React from 'react';

/**
 * Normalizes inline LaTeX arrows, symbols, and math macros that may appear in AI output.
 */
function cleanLatexSyntax(text: string): string {
  return text
    .replace(/\$\s*\\rightarrow\s*\$|\\rightarrow|\$\s*\\to\s*\$|\\to/g, '→')
    .replace(/\$\s*\\leftarrow\s*\$|\\leftarrow/g, '←')
    .replace(/\$\s*\\Rightarrow\s*\$|\\Rightarrow/g, '⇒')
    .replace(/\$\s*\\Leftarrow\s*\$|\\Leftarrow/g, '⇐')
    .replace(/\$\s*\\leftrightarrow\s*\$|\\leftrightarrow/g, '↔')
    .replace(/\$\s*\\pm\s*\$|\\pm/g, '±')
    .replace(/\$\s*\\times\s*\$|\\times/g, '×')
    .replace(/\$\s*\\div\s*\$|\\div/g, '÷')
    .replace(/\$\s*\\checkmark\s*\$|\\checkmark/g, '✓')
    .replace(/\$\s*\\bullet\s*\$|\\bullet/g, '•');
}

/**
 * Parses inline markdown: bold, inline code, italics, links, and LaTeX-cleaned symbols.
 */
function renderInlineMarkdown(rawText: string): React.ReactNode {
  const text = cleanLatexSyntax(rawText);
  const tokens: React.ReactNode[] = [];
  let keyIdx = 0;

  // Regex to match **bold**, `code`, *italic*, _italic_, or [link](url)
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*|_[^_]+_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];

    if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push(
        <strong key={`b-${keyIdx++}`} className="font-bold text-[#0F172A] dark:text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push(
        <code
          key={`c-${keyIdx++}`}
          className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-[#1A1F1C] text-emerald-800 dark:text-emerald-300 font-mono text-[11px] border border-slate-200 dark:border-[#2A332E]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        tokens.push(
          <a
            key={`a-${keyIdx++}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 dark:text-emerald-400 font-medium underline hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        tokens.push(token);
      }
    } else if (
      (token.startsWith('*') && token.endsWith('*')) ||
      (token.startsWith('_') && token.endsWith('_'))
    ) {
      tokens.push(
        <em key={`i-${keyIdx++}`} className="italic text-slate-700 dark:text-gray-300">
          {token.slice(1, -1)}
        </em>
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    tokens.push(text.substring(lastIndex));
  }

  return tokens.length > 0 ? tokens : text;
}

/**
 * Splits a markdown table row into trimmed cell strings.
 */
function splitTableCells(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map((c) => c.trim());
}

/**
 * Checks whether a line is a markdown table separator row (| :--- | :---: | ---: |).
 */
function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('-')) return false;
  const cells = splitTableCells(trimmed);
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-+:?$/.test(c));
}

/**
 * Parses alignment for table columns based on separator strings.
 */
function parseAlignments(separatorLine: string): Array<'left' | 'center' | 'right'> {
  const cells = splitTableCells(separatorLine);
  return cells.map((cell) => {
    const starts = cell.startsWith(':');
    const ends = cell.endsWith(':');
    if (starts && ends) return 'center';
    if (ends) return 'right';
    return 'left';
  });
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
          className={`my-2 space-y-1 ${
            isOrderedList ? 'list-decimal' : 'list-disc'
          } pl-5 text-xs sm:text-sm text-[#0F172A] dark:text-gray-100`}
        >
          {listItems}
        </ListTag>
      );
      listItems = [];
      isOrderedList = false;
    }
  };

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. Empty line
    if (!trimmed) {
      flushList();
      elements.push(<div key={`sp-${i}`} className="h-1.5" />);
      i++;
      continue;
    }

    // 2. Fenced Code Blocks (``` ... ```)
    if (trimmed.startsWith('```')) {
      flushList();
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;

      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }

      // Skip the closing ``` if present
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++;
      }

      elements.push(
        <div
          key={`code-block-${elements.length}`}
          className="my-3 overflow-hidden rounded-xl border border-slate-200 dark:border-[#222925] shadow-xs"
        >
          {lang && (
            <div className="bg-slate-200/80 dark:bg-[#1A1F1C] px-3.5 py-1 text-[11px] font-mono font-bold text-slate-600 dark:text-gray-300 border-b border-slate-200 dark:border-[#222925] flex items-center justify-between">
              <span>{lang}</span>
            </div>
          )}
          <pre className="overflow-x-auto font-mono text-xs p-3.5 bg-slate-100 dark:bg-[#0A0D0C] text-[#0F172A] dark:text-gray-200 leading-relaxed">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    // 3. Markdown Tables (| header | ... | followed by | --- | ... |)
    if (
      (trimmed.startsWith('|') || trimmed.includes('|')) &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      flushList();
      const headers = splitTableCells(trimmed);
      const alignments = parseAlignments(lines[i + 1]);
      i += 2; // skip header and separator row

      const dataRows: string[][] = [];
      while (
        i < lines.length &&
        lines[i].trim().length > 0 &&
        (lines[i].trim().startsWith('|') || lines[i].trim().includes('|')) &&
        !isTableSeparator(lines[i])
      ) {
        const rowCells = splitTableCells(lines[i]);
        dataRows.push(rowCells);
        i++;
      }

      elements.push(
        <div
          key={`table-${elements.length}`}
          className="my-3.5 w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-emerald-900/40 shadow-xs"
        >
          <table className="w-full border-collapse my-0 text-xs sm:text-sm">
            <thead className="bg-slate-100 dark:bg-[#1A1F1C] border-b border-slate-200 dark:border-emerald-900/40">
              <tr>
                {headers.map((h, hIdx) => (
                  <th
                    key={`th-${hIdx}`}
                    style={{ textAlign: alignments[hIdx] || 'left' }}
                    className="px-3.5 py-2.5 font-bold text-[#0F172A] dark:text-white border-r last:border-r-0 border-slate-200 dark:border-emerald-900/30 whitespace-nowrap sm:whitespace-normal"
                  >
                    {renderInlineMarkdown(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1E2521] bg-white dark:bg-[#121614]">
              {dataRows.map((row, rIdx) => (
                <tr
                  key={`tr-${rIdx}`}
                  className="hover:bg-slate-50/80 dark:hover:bg-[#1A1F1C]/70 transition-colors"
                >
                  {headers.map((_, cIdx) => (
                    <td
                      key={`td-${cIdx}`}
                      style={{ textAlign: alignments[cIdx] || 'left' }}
                      className="px-3.5 py-2 text-[#0F172A] dark:text-gray-200 border-r last:border-r-0 border-slate-100 dark:border-emerald-900/20 leading-relaxed"
                    >
                      {renderInlineMarkdown(row[cIdx] || '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // 4. Clean up ASCII dividers (===, ---, ***, ___)
    if (/^[-=*_]{3,}$/.test(trimmed)) {
      flushList();
      elements.push(<hr key={`hr-${i}`} className="my-3 border-slate-200 dark:border-[#222925]" />);
      i++;
      continue;
    }

    // 5. Clean up ASCII wrapped headings (e.g. "=== SECTION A: MCQS ===" or "--- PART B ---")
    const asciiHeadingMatch = trimmed.match(/^[-=]{3,}\s*([^=-].*?)\s*[-=]{3,}$/);
    if (asciiHeadingMatch) {
      flushList();
      elements.push(
        <h3
          key={`h3-ascii-${i}`}
          className="text-xs sm:text-sm font-extrabold text-[#0F172A] dark:text-white mt-3.5 mb-1 flex items-center gap-1.5"
        >
          <span className="w-1.5 h-3.5 bg-[#37C6A3] dark:bg-[#10B981] rounded-full inline-block shrink-0" />
          <span>{renderInlineMarkdown(asciiHeadingMatch[1].trim())}</span>
        </h3>
      );
      i++;
      continue;
    }

    // 6. Level 4 Headings (####)
    if (trimmed.startsWith('#### ')) {
      flushList();
      elements.push(
        <h4
          key={`h4-${i}`}
          className="text-xs font-bold text-slate-800 dark:text-emerald-400 mt-3 mb-1 flex items-center gap-1.5 uppercase tracking-wide"
        >
          <span className="w-1.5 h-1.5 bg-[#37C6A3] dark:bg-[#10B981] rounded-full inline-block shrink-0" />
          <span>{renderInlineMarkdown(trimmed.slice(5))}</span>
        </h4>
      );
      i++;
      continue;
    }

    // 7. Level 3 Headings (###)
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3
          key={`h3-${i}`}
          className="text-xs sm:text-sm font-extrabold text-[#0F172A] dark:text-white mt-3.5 mb-1 flex items-center gap-1.5"
        >
          <span className="w-1.5 h-3.5 bg-[#37C6A3] dark:bg-[#10B981] rounded-full inline-block shrink-0" />
          <span>{renderInlineMarkdown(trimmed.slice(4))}</span>
        </h3>
      );
      i++;
      continue;
    }

    // 8. Level 2 Headings (##)
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2
          key={`h2-${i}`}
          className="text-sm sm:text-base font-extrabold text-[#0F172A] dark:text-white border-b border-slate-200 dark:border-[#222925] pb-1 mt-4 mb-1.5 flex items-center gap-2"
        >
          <span>{renderInlineMarkdown(trimmed.slice(3))}</span>
        </h2>
      );
      i++;
      continue;
    }

    // 9. Level 1 Headings (#)
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h1
          key={`h1-${i}`}
          className="text-base sm:text-lg font-black text-[#0F172A] dark:text-white border-b-2 border-[#37C6A3]/40 dark:border-[#10B981]/40 pb-1.5 mt-4 mb-2"
        >
          {renderInlineMarkdown(trimmed.slice(2))}
        </h1>
      );
      i++;
      continue;
    }

    // 10. Blockquote (Callouts, Quotes, Quran/Hadith citations)
    if (trimmed.startsWith('>')) {
      flushList();
      elements.push(
        <blockquote
          key={`bq-${i}`}
          className="my-2.5 pl-3.5 py-2 border-l-3 border-[#37C6A3] dark:border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-r-xl text-xs sm:text-sm text-slate-800 dark:text-gray-200 italic leading-relaxed"
        >
          {renderInlineMarkdown(trimmed.replace(/^>\s*/, ''))}
        </blockquote>
      );
      i++;
      continue;
    }

    // 11. Bullet List (- or *)
    const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      if (isOrderedList) flushList();
      isOrderedList = false;
      listItems.push(
        <li key={`li-${i}`} className="leading-relaxed">
          {renderInlineMarkdown(bulletMatch[1])}
        </li>
      );
      i++;
      continue;
    }

    // 12. Numbered List (1. ...)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      if (!isOrderedList && listItems.length > 0) flushList();
      isOrderedList = true;
      listItems.push(
        <li key={`li-num-${i}`} className="leading-relaxed">
          {renderInlineMarkdown(numMatch[2])}
        </li>
      );
      i++;
      continue;
    }

    // 13. Standard paragraph line
    flushList();
    elements.push(
      <p key={`p-${i}`} className="text-xs sm:text-sm leading-relaxed text-[#0F172A] dark:text-gray-100">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
    i++;
  }

  flushList();

  return <div className="space-y-1 text-left">{elements}</div>;
}
