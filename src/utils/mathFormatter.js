/**
 * Mathematical notation converter for C++ expressions
 * Transforms C++ expressions into clean mathematical notation (powers, fractions, roots, etc.)
 */

const SUPERSCRIPT_MAP = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '-': '⁻', '+': '⁺', 'n': 'ⁿ', 'k': 'ᵏ', 'm': 'ᵐ', 'i': 'ⁱ',
    'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ', 'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ'
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
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 10) {
        changed = false;
        iterations++;
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
                if (/\b(?:std::)?pow\s*\(/.test(base)) {
                    continue;
                }
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
                changed = true;
                break;
            } else {
                break;
            }
        }
    }
    return s;
}

const NON_OPERAND_LEFT_WORDS = new Set([
    'void', 'char', 'short', 'int', 'long', 'float', 'double', 'bool', 'auto',
    'size_t', 'string', 'signed', 'unsigned', 'const', 'constexpr', 'volatile',
    'static', 'inline', 'extern', 'struct', 'class', 'typename', 'wchar_t',
    'char8_t', 'char16_t', 'char32_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t',
    'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
    'return', 'case', 'delete', 'new', 'throw', 'sizeof', 'typeof', 'decltype'
]);

function maskStringAndCharLiterals(str) {
    const literals = [];
    let masked = '';
    let i = 0;
    while (i < str.length) {
        const ch = str[i];
        if (ch === '"' || ch === "'") {
            const quote = ch;
            const start = i;
            i++;
            while (i < str.length) {
                if (str[i] === '\\' && i + 1 < str.length) {
                    i += 2;
                    continue;
                }
                if (str[i] === quote) {
                    i++;
                    break;
                }
                i++;
            }
            const idx = literals.length;
            literals.push(str.slice(start, i));
            masked += `@@LIT_${idx}@@`;
        } else {
            masked += ch;
            i++;
        }
    }
    return { masked, literals };
}

function unmaskLiterals(str, literals) {
    if (!literals || literals.length === 0) return str;
    return str.replace(/@@LIT_(\d+)@@/g, (m, idxStr) => {
        const idx = Number(idxStr);
        return Number.isInteger(idx) && idx >= 0 && idx < literals.length ? literals[idx] : m;
    });
}

function replaceBinaryMultiply(str) {
    let out = '';
    for (let i = 0; i < str.length; i++) {
        if (str[i] !== '*') {
            out += str[i];
            continue;
        }
        // Look back across whitespace for the left token/character
        let li = i - 1;
        while (li >= 0 && /\s/.test(str[li])) li--;
        const leftCh = li >= 0 ? str[li] : '';

        // Look ahead across whitespace for the right character
        let ri = i + 1;
        while (ri < str.length && /\s/.test(str[ri])) ri++;
        const rightCh = ri < str.length ? str[ri] : '';

        // Compound *=, end-of-expression, closing delimiters, or adjacent ** pointer
        if (!rightCh || str[i + 1] === '=' || rightCh === '=' || [')', ']', '}', ',', ';', ':'].includes(rightCh)) {
            out += '*';
            continue;
        }
        if (str[i + 1] === '*' || leftCh === '*') {
            out += '*';
            continue;
        }

        // Left side must end with an operand: digit, ), ], or non-type/non-keyword identifier
        let leftIsOperand = false;
        if (/[0-9)\]]/.test(leftCh)) {
            leftIsOperand = true;
        } else if (/[a-zA-Z_]/.test(leftCh)) {
            let wordStart = li;
            while (wordStart > 0 && /[a-zA-Z0-9_]/.test(str[wordStart - 1])) wordStart--;
            const leftWord = str.slice(wordStart, li + 1);
            if (!NON_OPERAND_LEFT_WORDS.has(leftWord)) {
                leftIsOperand = true;
            }
        }

        out += leftIsOperand ? '·' : '*';
    }
    return out;
}

function transformMathCore(str) {
    if (!str) return '';
    let s = String(str).trim();

    // 0. Remove C-style typecasts: (double)(x) -> (x)
    s = s.replace(/\(\s*(?:double|float|int|long|short|unsigned|signed)\s*\)/g, '');

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
        return `√(${transformMathCore(trimmed)})`;
    });

    // 7. abs / fabs with balanced parens
    s = replaceBalancedCalls(s, ['abs', 'fabs'], (fn, inner) => {
        return `|${transformMathCore(inner.trim())}|`;
    });

    // 7b. exp(...) with balanced parens -> eˣ or e^(...)
    s = replaceBalancedCalls(s, ['exp'], (fn, inner) => {
        const trimmed = inner.trim();
        if (/^[a-zA-Z0-9_]+$/.test(trimmed)) {
            return `e${toSuperscript(trimmed)}`;
        }
        return `e^(${transformMathCore(trimmed)})`;
    });

    // 8. C++ math logs & trig
    s = s.replace(/\blog10\b/g, 'lg');
    s = s.replace(/\blog\b/g, 'ln');
    s = s.replace(/\batan\b/g, 'arctg');
    s = s.replace(/\btan\b/g, 'tg');

    // 9. Constants & Greek letters
    s = s.replace(/\b(?:M_PI|PI|pi)\b/g, 'π');
    s = s.replace(/\b(?:eps|epsilon)\b/gi, 'ε');
    s = s.replace(/\balpha\b/g, 'α');
    s = s.replace(/\bbeta\b/g, 'β');
    s = s.replace(/\bgamma\b/g, 'γ');

    // 10. Clean C++ float-cast idiom: 1.*i or 1. * i -> i
    s = s.replace(/\b1\.(?:0)?\s*\*\s*/g, '');

    // 11. Relational operators
    s = s.replace(/!=/g, '≠');
    s = s.replace(/<=/g, '≤');
    s = s.replace(/>=/g, '≥');
    s = s.replace(/==/g, '=');

    // 12. Binary multiplication sign * -> · (preserving unary *t, pointer char*, *=)
    s = replaceBinaryMultiply(s);

    return s;
}

export function toMathExpression(str) {
    if (!str) return '';
    const { masked, literals } = maskStringAndCharLiterals(String(str).trim());
    const transformed = transformMathCore(masked);
    return unmaskLiterals(transformed, literals);
}

export function parseFraction(expr) {
    if (!expr) return { isFraction: false };
    let s = expr.trim();

    // Check if target = expr or return expr is inside (including +=, -=, *=, /=)
    let target = '';
    if (/^return\s+/i.test(s)) {
        target = 'return';
        s = s.replace(/^return\s+/i, '').trim();
    } else {
        const eqMatch = s.match(/^([a-zA-Z_][a-zA-Z0-9_\s]*?)\s*([+\-*/]?=)\s*(.*)$/);
        if (eqMatch) {
            let t = eqMatch[1].trim();
            const op = eqMatch[2];
            t = t.replace(/^(const\s+|constexpr\s+)?(double|float|int|long|short|auto|char|bool|unsigned|signed|size_t)\s+/, '').trim();
            target = op === '=' ? t : `${t} ${op}`;
            s = eqMatch[3].trim();
        }
    }

    // Strip C-style casts inside fraction expression: (double)(k - N) -> (k - N)
    s = s.replace(/\(\s*(?:double|float|int|long|short|unsigned|signed)\s*\)/g, '');

    let parenDepth = 0;
    let slashIdx = -1;
    let slashCount = 0;

    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '"' || c === "'") {
            const quote = c;
            i++;
            while (i < s.length) {
                if (s[i] === '\\' && i + 1 < s.length) {
                    i += 2;
                    continue;
                }
                if (s[i] === quote) break;
                i++;
            }
            continue;
        }
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
