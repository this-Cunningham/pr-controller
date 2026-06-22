// Big module: a small arithmetic expression evaluator (recursive descent).
// Supports + - * / , parentheses, unary minus, and integer/float literals.
//
// This is intentionally the largest sandbox module — it hosts the NON-TRIVIAL
// merge-conflict scenario (main and a PR each rewrite `evaluate`/the parser core
// in incompatible ways), so the rebase worker has to make a real judgment call.

// --- Tokenizer ------------------------------------------------------------

const TOKEN_RE = /\s*([0-9]*\.?[0-9]+|[-+*/()])/y;

export function tokenize(input) {
  const src = String(input);
  const tokens = [];
  let pos = 0;
  while (pos < src.length) {
    TOKEN_RE.lastIndex = pos;
    const m = TOKEN_RE.exec(src);
    if (!m) {
      // Skip a run of trailing/embedded whitespace, else it's a bad char.
      if (/\s/.test(src[pos])) {
        pos += 1;
        continue;
      }
      throw new SyntaxError(`unexpected character '${src[pos]}' at ${pos}`);
    }
    const text = m[1];
    pos = TOKEN_RE.lastIndex;
    if (/[0-9.]/.test(text[0])) {
      tokens.push({ type: 'num', value: Number(text) });
    } else {
      tokens.push({ type: 'op', value: text });
    }
  }
  tokens.push({ type: 'eof' });
  return tokens;
}

// --- Parser (recursive descent) ------------------------------------------

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.i = 0;
  }

  peek() {
    return this.tokens[this.i];
  }

  next() {
    return this.tokens[this.i++];
  }

  expect(value) {
    const t = this.next();
    if (t.type !== 'op' || t.value !== value) {
      throw new SyntaxError(`expected '${value}'`);
    }
    return t;
  }

  // Precedence-climbing binary parser (replaces parseExpr/parseTerm).
  static PREC = { '+': 1, '-': 1, '*': 2, '/': 2 };

  parseExpr() {
    return this.parseBinary(1);
  }

  parseBinary(minPrec) {
    let left = this.parseFactor();
    let steps = 0;
    while (this.peek().type === 'op' && Parser.PREC[this.peek().value] >= minPrec) {
      if (++steps > 10000) throw new SyntaxError('expression too long');
      const op = this.next().value;
      const right = this.parseBinary(Parser.PREC[op] + 1);
      left = this.apply(op, left, right);
    }
    return left;
  }

  apply(op, a, b) {
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '*') return a * b;
    return a / b;
  }

  // factor := '-' factor | '(' expr ')' | num
  parseFactor() {
    const t = this.peek();
    if (t.type === 'op' && t.value === '-') {
      this.next();
      return -this.parseFactor();
    }
    if (t.type === 'op' && t.value === '(') {
      this.next();
      const v = this.parseExpr();
      this.expect(')');
      return v;
    }
    if (t.type === 'num') {
      this.next();
      return t.value;
    }
    throw new SyntaxError(`unexpected token ${JSON.stringify(t)}`);
  }
}

// Evaluate an arithmetic expression string to a number.
export function evaluate(input) {
  const parser = new Parser(tokenize(input));
  const value = parser.parseExpr();
  if (parser.peek().type !== 'eof') {
    throw new SyntaxError('trailing input');
  }
  return value;
}
