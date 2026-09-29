/**
 * Mathematical notation converter for C++ expressions
 * Transforms C++ expressions into clean mathematical notation (powers, fractions, roots, etc.)
 */

const SUPERSCRIPT_MAP = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '-': '⁻', '+': '⁺', 'n': 'ⁿ', 'k': 'ᵏ', 'm': 'ᵐ', 'i': 'ⁱ'
};

export function toSuperscript(str) {
    return String(str).split('').map(c => SUPERSCRIPT_MAP[c] || c).join('');
}

export function toMathExpression(str) {
    if (!str) return '';
    let s = String(str).trim();

    // 1. pow(base, exp) -> baseⁿ
    s = s.replace(/pow\s*\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)/g, (_, base, exp) => {
        base = base.trim();
        exp = exp.trim();
        const supExp = toSuperscript(exp);
        const needsParens = /[+\-*/]/.test(base) && !(base.startsWith('(') && base.endsWith(')'));
        const baseFormatted = needsParens ? `(${base})` : base;
        return `${baseFormatted}${supExp}`;
    });

    // 2. Repeated multiplication: x * x -> x², R * R -> R²
    s = s.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\*\s*\1\b/g, '$1²');

    // 3. sqrt(...) -> √( ... )
    s = s.replace(/\bsqrt\s*\(([^()]+)\)/g, '√($1)');

    // 4. abs / fabs -> |...|
    s = s.replace(/\b(?:std::)?(?:abs|fabs)\s*\(([^()]+)\)/g, '|$1|');

    // 5. C++ math logs & trig
    s = s.replace(/\blog10\b/g, 'lg');
    s = s.replace(/\blog\b/g, 'ln');
    s = s.replace(/\batan\b/g, 'arctg');
    s = s.replace(/\btan\b/g, 'tg');

    // 6. Constants
    s = s.replace(/\b(?:M_PI|PI)\b/g, 'π');

    // 7. Relational and logical operators
    s = s.replace(/!=/g, '≠');
    s = s.replace(/<=/g, '≤');
    s = s.replace(/>=/g, '≥');
    s = s.replace(/==/g, '=');
    s = s.replace(/&&/g, '∧');
    s = s.replace(/\|\|/g, '∨');

    // 8. Multiplication sign * -> ·
    s = s.replace(/\*/g, '·');

    return s;
}

export function parseFraction(expr) {
    if (!expr) return { isFraction: false };
    const s = expr.trim();
    let parenDepth = 0;
    let slashIdx = -1;
    let hasOtherTopLevel = false;

    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '(') parenDepth++;
        else if (c === ')') parenDepth--;
        else if (parenDepth === 0) {
            if (c === '+' || c === '-') {
                const prev = s.slice(0, i).trim();
                if (prev.length > 0 && !['=', '+', '-', '*', '/', '<', '>', '≤', '≥', '≠', '∧', '∨'].includes(prev[prev.length - 1])) {
                    hasOtherTopLevel = true;
                }
            } else if (c === '/') {
                if (slashIdx === -1) {
                    slashIdx = i;
                } else {
                    hasOtherTopLevel = true;
                }
            }
        }
    }

    if (slashIdx !== -1 && !hasOtherTopLevel) {
        const num = s.slice(0, slashIdx).trim();
        const den = s.slice(slashIdx + 1).trim();

        function stripOuter(str) {
            str = str.trim();
            if (str.startsWith('(') && str.endsWith(')')) {
                let depth = 0;
                let wrapsAll = true;
                for (let i = 0; i < str.length - 1; i++) {
                    if (str[i] === '(') depth++;
                    else if (str[i] === ')') depth--;
                    if (depth === 0) {
                        wrapsAll = false;
                        break;
                    }
                }
                if (wrapsAll) return stripOuter(str.slice(1, -1));
            }
            return str;
        }

        return {
            isFraction: true,
            numerator: stripOuter(num),
            denominator: stripOuter(den)
        };
    }

    return { isFraction: false };
}
