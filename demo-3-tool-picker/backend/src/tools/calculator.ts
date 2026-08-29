// A tiny, dependency-free recursive-descent evaluator. Deliberately not
// `eval()`/`Function()` — the "expression" string is model output, so it is
// untrusted input and gets a grammar instead of a code path.
class ExpressionError extends Error {}

function tokenize(expression: string): string[] {
  const tokens = expression.match(/\d+(\.\d+)?|[+\-*/()]/g);
  if (!tokens || tokens.join("") !== expression.replace(/\s+/g, "")) {
    throw new ExpressionError(`couldn't tokenize "${expression}" — only digits, + - * / ( ) . are allowed`);
  }
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private tokens: string[]) {}

  private peek(): string | undefined {
    return this.tokens[this.pos];
  }

  private consume(expected?: string): string {
    const token = this.tokens[this.pos];
    if (token === undefined || (expected && token !== expected)) {
      throw new ExpressionError(`expected "${expected ?? "a token"}" but found "${token ?? "end of expression"}"`);
    }
    this.pos += 1;
    return token;
  }

  parse(): number {
    const value = this.parseSum();
    if (this.pos !== this.tokens.length) {
      throw new ExpressionError(`unexpected trailing token "${this.peek()}"`);
    }
    return value;
  }

  private parseSum(): number {
    let value = this.parseProduct();
    while (this.peek() === "+" || this.peek() === "-") {
      const op = this.consume();
      const rhs = this.parseProduct();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  private parseProduct(): number {
    let value = this.parseUnary();
    while (this.peek() === "*" || this.peek() === "/") {
      const op = this.consume();
      const rhs = this.parseUnary();
      if (op === "/" && rhs === 0) {
        throw new ExpressionError("division by zero");
      }
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  }

  private parseUnary(): number {
    if (this.peek() === "-") {
      this.consume();
      return -this.parseUnary();
    }
    return this.parseAtom();
  }

  private parseAtom(): number {
    if (this.peek() === "(") {
      this.consume("(");
      const value = this.parseSum();
      this.consume(")");
      return value;
    }
    const token = this.consume();
    const value = Number(token);
    if (Number.isNaN(value)) {
      throw new ExpressionError(`"${token}" is not a number`);
    }
    return value;
  }
}

export interface CalculatorArgs {
  expression: string;
}

export interface CalculatorResult {
  expression: string;
  value: number;
  summary: string;
}

export function runCalculator(args: CalculatorArgs): CalculatorResult {
  const tokens = tokenize(args.expression);
  const value = new Parser(tokens).parse();
  return {
    expression: args.expression,
    value,
    summary: `${args.expression} = ${value}`,
  };
}
