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

export function stripOuter(str) {
    if (!str) return '';
    let s = str.trim();
    while (s.startsWith('(') && s.endsWith(')')) {
        let depth = 0;
        let wrapsAll = true;
        for (let i = 0; i < s.length - 1; i++) {
            if (s[i] === '(') depth++;
            else if (s[i] === ')') depth--;
            if (depth === 0) {
                wrapsAll = false;
                break;
            }
        }
        if (wrapsAll) {
            s = s.slice(1, -1).trim();
        } else {
            break;
        }
    }
    return s;
}

/**
 * Replaces function calls like sqrt(...) or abs(...) supporting arbitrary nested parentheses.
 */
function replaceBalancedCalls(str, fnNames, replacer) {
    let s = str;
    for (const fn of fnNames) {
        let pattern = new RegExp('\\b(?:std::)?' + fn + '\\s*\\(', 'g');
        let match;
        while ((match = pattern.exec(s)) !== null) {
            const startIdx = match.index;
            const openParenIdx = startIdx + match[0].length - 1;
            let depth = 1;
            let closeParenIdx = -1;
            for (let i = openParenIdx + 1; i < s.length; i++) {
                if (s[i] === '(') depth++;
                else if (s[i] === ')') {
                    depth--;
                    if (depth === 0) {
                        closeParenIdx = i;
                        break;
                    }
                }
            }
            if (closeParenIdx !== -1) {
                const inner = s.slice(openParenIdx + 1, closeParenIdx);
                const replacement = replacer(fn, inner);
                s = s.slice(0, startIdx) + replacement + s.slice(closeParenIdx + 1);
                pattern.lastIndex = startIdx + replacement.length;
            } else {
                break;
            }
        }
    }
    return s;
}

/**
 * Replaces pow(base, exp) calls supporting nested parentheses and trig powers:
 * pow(sin(x), 2) -> sin²(x)
 * pow(x, 2) -> x²
 * pow(x + 1, 2) -> (x + 1)²
 */
function replacePowCalls(s) {
    let pattern = /\b(?:std::)?pow\s*\(/g;
    let match;
    while ((match = pattern.exec(s)) !== null) {
        const startIdx = match.index;
        const openParenIdx = startIdx + match[0].length - 1;
        let depth = 1;
        let commaIdx = -1;
        let closeParenIdx = -1;
        for (let i = openParenIdx + 1; i < s.length; i++) {
            if (s[i] === '(') depth++;
            else if (s[i] === ')') {
                depth--;
                if (depth === 0) {
                    closeParenIdx = i;
                    break;
                }
            } else if (s[i] === ',' && depth === 1 && commaIdx === -1) {
                commaIdx = i;
            }
        }
        if (closeParenIdx !== -1 && commaIdx !== -1) {
            let base = s.slice(openParenIdx + 1, commaIdx).trim();
            let exp = s.slice(commaIdx + 1, closeParenIdx).trim();
            const supExp = toSuperscript(exp);

            // Check if base is a trig call: sin(x), cos(a), tan(x), etc.
            const trigMatch = base.match(/^((?:std::)?(?:sin|cos|tg|tan|ctg|arcsin|arccos|arctg))\s*\((.+)\)$/);
            let replacement = '';
            if (trigMatch) {
                let trigName = trigMatch[1].replace('std::', '');
                if (trigName === 'tan') trigName = 'tg';
                replacement = `${trigName}${supExp}(${trigMatch[2]})`;
            } else {
                const needsParens = /[+\-*/]/.test(base) && !(base.startsWith('(') && base.endsWith(')'));
                const baseFmt = needsParens ? `(${base})` : base;
                replacement = `${baseFmt}${supExp}`;
            }
            s = s.slice(0, startIdx) + replacement + s.slice(closeParenIdx + 1);
            pattern.lastIndex = startIdx + replacement.length;
        } else {
            break;
        }
    }
    return s;
}

export function toMathExpression(str) {
    if (!str) return '';
    let s = String(str).trim();

    // 1. Remove std:: prefix
    s = s.replace(/\bstd::/g, '');

    // 2. Float .0 literals: 4.0 -> 4, 1.0 -> 1, 5.0 -> 5
    s = s.replace(/\b(\d+)\.0\b/g, '$1');

    // 3. pow(base, exp)
    s = replacePowCalls(s);

    // 4. Caret powers: x^2 -> x², x^3 -> x³
    s = s.replace(/\b([a-zA-Z_]\w*)\^(\d+|[nkm])\b/g, (_, b, e) => b + toSuperscript(e));

    // 5. Repeated multiplication: (expr) * (expr) -> (expr)², x * x * x -> x³, x * x -> x²
    s = s.replace(/(\([^()]+?\))\s*\*\s*\1/g, '$1²');
    s = s.replace(/\b([a-zA-Z_]\w*)\s*\*\s*\1\s*\*\s*\1\b/g, '$1³');
    s = s.replace(/\b([a-zA-Z_]\w*)\s*\*\s*\1\b/g, '$1²');

    // 6. sqrt(...) with balanced parens
    s = replaceBalancedCalls(s, ['sqrt'], (fn, inner) => {
        const trimmed = inner.trim();
        if (/^[a-zA-Z0-9_]+$/.test(trimmed)) {
            return `√${trimmed}`;
        }
        return `√(${toMathExpression(trimmed)})`;
    });

    // 7. abs / fabs with balanced parens
    s = replaceBalancedCalls(s, ['abs', 'fabs'], (fn, inner) => {
        return `|${toMathExpression(inner.trim())}|`;
    });

    // 8. C++ math logs & trig
    s = s.replace(/\blog10\b/g, 'lg');
    s = s.replace(/\blog\b/g, 'ln');
    s = s.replace(/\batan\b/g, 'arctg');
    s = s.replace(/\btan\b/g, 'tg');

    // 9. Constants & Greek letters
    s = s.replace(/\b(?:M_PI|PI|pi)\b/g, 'π');
    s = s.replace(/\balpha\b/g, 'α');
    s = s.replace(/\bbeta\b/g, 'β');
    s = s.replace(/\bgamma\b/g, 'γ');

    // 10. Relational operators
    s = s.replace(/!=/g, '≠');
    s = s.replace(/<=/g, '≤');
    s = s.replace(/>=/g, '≥');
    s = s.replace(/==/g, '=');

    // 11. Multiplication sign * -> ·
    s = s.replace(/\*/g, '·');

    return s;
}

export function parseFraction(expr) {
    if (!expr) return { isFraction: false };
    let s = expr.trim();

    // Check if target = expr or return expr is inside
    let target = '';
    if (/^return\s+/i.test(s)) {
        target = 'return';
        s = s.replace(/^return\s+/i, '').trim();
    } else {
        const eqMatch = s.match(/^([a-zA-Z_][a-zA-Z0-9_\s]*)=(.*)$/);
        if (eqMatch) {
            let t = eqMatch[1].trim();
            t = t.replace(/^(const\s+|constexpr\s+)?(double|float|int|long|short|auto|char|bool|unsigned|signed|size_t)\s+/, '').trim();
            target = t;
            s = eqMatch[2].trim();
        }
    }

    let parenDepth = 0;
    let slashIdx = -1;
    let slashCount = 0;

    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '(') parenDepth++;
        else if (c === ')') parenDepth--;
        else if (parenDepth === 0 && c === '/') {
            slashIdx = i;
            slashCount++;
        }
    }

    if (slashCount !== 1) {
        return { isFraction: false };
    }

    let left = s.slice(0, slashIdx).trim();
    let right = s.slice(slashIdx + 1).trim();

    let prefix = '';
    let numPart = left;

    // Check if left has a top-level '+' or '-' before slash (e.g. "1 + (x + 2)" or "a + b / c")
    let leftParenDepth = 0;
    let lastAddOpIdx = -1;
    for (let i = 0; i < left.length; i++) {
        const c = left[i];
        if (c === '(') leftParenDepth++;
        else if (c === ')') leftParenDepth--;
        else if (leftParenDepth === 0) {
            if ((c === '+' || c === '-') && i > 0) {
                const prev = left.slice(0, i).trim();
                if (prev.length > 0 && !['+', '-', '*', '/', '(', '='].includes(prev[prev.length - 1])) {
                    lastAddOpIdx = i;
                }
            }
        }
    }

    if (lastAddOpIdx !== -1) {
        prefix = left.slice(0, lastAddOpIdx + 1).trim() + ' ';
        numPart = left.slice(lastAddOpIdx + 1).trim();
    }

    let suffix = '';
    let denPart = right;

    // Check if right has a top-level suffix outside closed parens: e.g. "(x^2 + 1) + 5"
    if (right.startsWith('(')) {
        let depth = 0;
        let closeIdx = -1;
        for (let i = 0; i < right.length; i++) {
            if (right[i] === '(') depth++;
            else if (right[i] === ')') {
                depth--;
                if (depth === 0) {
                    closeIdx = i;
                    break;
                }
            }
        }
        if (closeIdx !== -1 && closeIdx < right.length - 1) {
            const remainder = right.slice(closeIdx + 1).trim();
            if (remainder.startsWith('+') || remainder.startsWith('-')) {
                denPart = right.slice(0, closeIdx + 1).trim();
                suffix = ' ' + remainder;
            }
        }
    }

    const cleanNum = stripOuter(numPart);
    const cleanDen = stripOuter(denPart);

    if (!cleanNum || !cleanDen) {
        return { isFraction: false };
    }

    return {
        isFraction: true,
        target: target,
        prefix: prefix,
        numerator: cleanNum,
        denominator: cleanDen,
        suffix: suffix
    };
}
