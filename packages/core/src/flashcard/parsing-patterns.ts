// :: separator not inside cloze braces {{c1::text}}
// Negative lookbehind/lookahead ensures :: inside {{...}} is not treated as a separator
export const INLINE_SEPARATOR_RE = /^(.+?)(?<!{[^}]*)::(?![^{]*}})(.+)$/;

// Detects any cloze deletion syntax: {{c1::text}} or {{c1::text::hint}}
export const CLOZE_DETECT = /\{\{c\d+::[^}]*?(?:::[^}]*?)?\}\}/;
