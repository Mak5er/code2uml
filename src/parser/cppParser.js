/**
 * C++ Lexer and AST Parser for Algorithm Flowcharts, UML Activity Diagrams,
 * and Multi-File / Multi-Module GOST Structure Charts.
 * Tailored for university programming courses and labs (single-file & multi-file projects).
 */

const CPP_CONTROL_KEYWORDS = new Set([
    'if', 'else', 'while', 'for', 'do', 'switch', 'case', 'default',
    'return', 'break', 'continue', 'goto', 'using', 'namespace',
    'typedef', 'struct', 'class', 'enum', 'union', 'public', 'private', 'protected',
    'template', 'typename', 'try', 'catch', 'throw', 'new', 'delete', 'sizeof',
    'static_cast', 'dynamic_cast', 'const_cast', 'reinterpret_cast',
    'cin', 'cout', 'cerr', 'clog'
]);

const CPP_TYPE_WORDS = new Set([
    'int', 'void', 'double', 'float', 'char', 'bool', 'auto', 'size_t', 'string',
    'long', 'short', 'unsigned', 'signed', 'static', 'inline', 'const', 'constexpr',
    'virtual', 'extern', 'volatile', 'mutable', 'wchar_t', 'int64_t', 'uint64_t',
    'int32_t', 'uint32_t', 'ifstream', 'ofstream', 'fstream', 'stringstream'
]);

const STD_NAMESPACE_TYPES = new Set([
    'string', 'wstring', 'size_t', 'ptrdiff_t', 'ifstream', 'ofstream', 'fstream',
    'stringstream', 'istringstream', 'ostringstream', 'vector', 'array', 'pair',
    'map', 'set', 'list', 'deque', 'queue', 'stack'
]);

const STDLIB_FUNCTION_HEADERS = {
    // <cstring>
    strlen: '<cstring>', strchr: '<cstring>', strrchr: '<cstring>', strstr: '<cstring>',
    strcat: '<cstring>', strncat: '<cstring>', strcpy: '<cstring>', strncpy: '<cstring>',
    strcmp: '<cstring>', strncmp: '<cstring>', memcpy: '<cstring>', memmove: '<cstring>',
    memset: '<cstring>', memcmp: '<cstring>',
    // <string>
    getline: '<string>', to_string: '<string>', stoi: '<string>', stol: '<string>',
    stoll: '<string>', stof: '<string>', stod: '<string>',
    // <cctype>
    isspace: '<cctype>', ispunct: '<cctype>', isalpha: '<cctype>', isdigit: '<cctype>',
    isalnum: '<cctype>', isupper: '<cctype>', islower: '<cctype>', tolower: '<cctype>',
    toupper: '<cctype>',
    // <cmath>
    sin: '<cmath>', cos: '<cmath>', tan: '<cmath>', asin: '<cmath>', acos: '<cmath>',
    atan: '<cmath>', atan2: '<cmath>', sinh: '<cmath>', cosh: '<cmath>', tanh: '<cmath>',
    exp: '<cmath>', log: '<cmath>', log10: '<cmath>', log2: '<cmath>', pow: '<cmath>',
    sqrt: '<cmath>', cbrt: '<cmath>', abs: '<cmath>', fabs: '<cmath>', ceil: '<cmath>',
    floor: '<cmath>', round: '<cmath>', fmod: '<cmath>',
    // <cstdlib> / <ctime> / <algorithm> / <cassert>
    rand: '<cstdlib>', srand: '<cstdlib>', exit: '<cstdlib>',
    time: '<ctime>', clock: '<ctime>',
    max: '<algorithm>', min: '<algorithm>', swap: '<algorithm>', sort: '<algorithm>',
    reverse: '<algorithm>', find: '<algorithm>',
    assert: '<cassert>'
};

const STRING_MEMBER_METHODS = new Set([
    'find', 'rfind', 'find_first_of', 'find_last_of', 'replace', 'substr',
    'length', 'size', 'empty', 'clear', 'append', 'erase', 'insert',
    'push_back', 'pop_back', 'c_str', 'data', 'compare'
]);

const TWO_CHAR_OPERATORS = new Set([
    '::', '->', '<<', '>>', '==', '!=', '<=', '>=', '&&', '||',
    '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '.*'
]);

const THREE_CHAR_OPERATORS = new Set(['<<=', '>>=', '->*']);

const HEADER_EXTENSIONS = new Set(['.h', '.hpp', '.hh', '.hxx']);
const SOURCE_EXTENSIONS = new Set(['.cpp', '.cc', '.cxx', '.c', '.c++']);

/**
 * Strip inline // and /* ... * / comments from a logical preprocessor line, preserving string literals.
 */
function stripDirectiveComments(raw) {
    let out = '';
    let i = 0;
    const len = raw.length;
    while (i < len) {
        const c = raw[i];
        const next = i + 1 < len ? raw[i + 1] : '';
        if (c === '"' || c === '\'') {
            const q = c;
            out += c;
            i++;
            let esc = false;
            while (i < len) {
                const ch = raw[i];
                out += ch;
                i++;
                if (esc) {
                    esc = false;
                } else if (ch === '\\') {
                    esc = true;
                } else if (ch === q) {
                    break;
                }
            }
            continue;
        }
        if (c === '/' && next === '/') {
            break;
        }
        if (c === '/' && next === '*') {
            i += 2;
            while (i < len && !(raw[i] === '*' && raw[i + 1] === '/')) {
                i++;
            }
            if (i < len) i += 2;
            out += ' ';
            continue;
        }
        out += c;
        i++;
    }
    return out.trim();
}

/**
 * Parse a preprocessor directive line (after line-continuation splicing) into structured metadata.
 */
function parseDirectiveMeta(rawDirective) {
    const raw = rawDirective.trim();
    const cleaned = stripDirectiveComments(raw);
    const match = cleaned.match(/^#\s*([a-zA-Z_]\w*)(.*)$/);
    if (!match) {
        return {
            directiveKind: 'unknown',
            raw,
            cleaned
        };
    }

    const kind = match[1].toLowerCase();
    const rest = (match[2] || '').trim();

    if (kind === 'include') {
        const localMatch = rest.match(/^"([^"]+)"/);
        const sysMatch = rest.match(/^<([^>]+)>/);
        const includeTarget = localMatch ? localMatch[1] : (sysMatch ? sysMatch[1] : rest);
        return {
            directiveKind: 'include',
            includeTarget,
            isLocal: Boolean(localMatch),
            raw,
            cleaned
        };
    }

    if (kind === 'define') {
        // Must preserve whether '(' immediately follows macro name with NO whitespace
        const defMatch = rest.match(/^([a-zA-Z_]\w*)(.*)$/);
        if (defMatch) {
            const macroName = defMatch[1];
            const afterName = defMatch[2] || '';
            let macroParams = null;
            let macroBody = afterName.trim();
            let macroKind = macroBody ? 'constant' : 'flag';

            if (afterName.startsWith('(')) {
                const closeIdx = afterName.indexOf(')');
                if (closeIdx !== -1) {
                    const paramStr = afterName.slice(1, closeIdx).trim();
                    macroParams = paramStr ? paramStr.split(',').map(p => p.trim()).filter(Boolean) : [];
                    macroBody = afterName.slice(closeIdx + 1).trim();
                    macroKind = 'function';
                }
            }

            return {
                directiveKind: 'define',
                macroName,
                macroParams,
                macroKind,
                macroBody,
                raw,
                cleaned
            };
        }
    }

    if (kind === 'undef') {
        const nameMatch = rest.match(/^([a-zA-Z_]\w*)/);
        return {
            directiveKind: 'undef',
            macroName: nameMatch ? nameMatch[1] : rest,
            raw,
            cleaned
        };
    }

    if (kind === 'ifdef' || kind === 'ifndef') {
        const nameMatch = rest.match(/^([a-zA-Z_]\w*)/);
        return {
            directiveKind: kind,
            condition: nameMatch ? nameMatch[1] : rest,
            raw,
            cleaned
        };
    }

    if (kind === 'if' || kind === 'elif') {
        return {
            directiveKind: kind,
            condition: rest,
            raw,
            cleaned
        };
    }

    if (kind === 'else' || kind === 'endif') {
        return {
            directiveKind: kind,
            condition: null,
            raw,
            cleaned
        };
    }

    if (kind === 'error' || kind === 'warning') {
        return {
            directiveKind: kind,
            message: rest,
            raw,
            cleaned
        };
    }

    if (kind === 'pragma') {
        return {
            directiveKind: 'pragma',
            pragmaArg: rest,
            raw,
            cleaned
        };
    }

    return {
        directiveKind: kind,
        rest,
        raw,
        cleaned
    };
}

class CppTokenizer {
    constructor(source) {
        this.source = String(source || '');
        this.pos = 0;
        this.len = this.source.length;
        this.line = 1;
    }

    tokenize() {
        const tokens = [];
        while (this.pos < this.len) {
            this.skipWhitespace();
            if (this.pos >= this.len) break;

            const char = this.source[this.pos];
            const nextChar = this.pos + 1 < this.len ? this.source[this.pos + 1] : '';

            // Single-line comments
            if (char === '/' && nextChar === '/') {
                const start = this.pos;
                this.pos += 2;
                while (this.pos < this.len && this.source[this.pos] !== '\n') {
                    this.pos++;
                }
                const text = this.source.slice(start, this.pos).trim();
                const splitMatch = text.match(/^\/\/\s*(?:\[\s*(?:split|col|column|connector|page|з'єднувач|з’єднувач|розділ|розрив)(?::\s*([^\]]+))?\s*\]|@(?:split|connector|page)\s*(\S+)?|---\s*(?:split|break)\s*---)/i);
                if (splitMatch) {
                    tokens.push({ type: 'SPLIT_DIRECTIVE', label: (splitMatch[1] || splitMatch[2] || '').trim() || null });
                } else {
                    tokens.push({ type: 'COMMENT', value: text });
                }
                continue;
            }

            // Block comments
            if (char === '/' && nextChar === '*') {
                const start = this.pos;
                this.pos += 2;
                while (this.pos < this.len && !(this.source[this.pos] === '*' && this.source[this.pos + 1] === '/')) {
                    if (this.source[this.pos] === '\n') this.line++;
                    this.pos++;
                }
                if (this.pos + 1 < this.len) {
                    this.pos += 2;
                }
                const text = this.source.slice(start, this.pos).trim();
                const splitMatch = text.match(/^\/\*\s*\[\s*(?:split|col|column|connector|page|з'єднувач|з’єднувач|розділ|розрив)(?::\s*([^\]]+))?\s*\]\s*\*\/$/i);
                if (splitMatch) {
                    tokens.push({ type: 'SPLIT_DIRECTIVE', label: (splitMatch[1] || '').trim() || null });
                } else {
                    tokens.push({ type: 'COMMENT_BLOCK', value: text });
                }
                continue;
            }

            // Preprocessor directives (#include, #define, #if, #elif, #else, #endif, #ifdef, #ifndef, #pragma, #error)
            if (char === '#') {
                const token = this.readDirective();
                tokens.push(token);
                continue;
            }

            // String / char literals
            if (char === '"' || char === '\'') {
                const quote = char;
                const start = this.pos;
                this.pos++;
                let escaped = false;
                while (this.pos < this.len) {
                    const c = this.source[this.pos];
                    if (c === '\n') this.line++;
                    if (escaped) {
                        escaped = false;
                        this.pos++;
                        continue;
                    }
                    if (c === '\\') {
                        escaped = true;
                        this.pos++;
                        continue;
                    }
                    if (c === quote) {
                        this.pos++;
                        break;
                    }
                    this.pos++;
                }
                tokens.push({ type: 'STRING', value: this.source.slice(start, this.pos) });
                continue;
            }

            // Numbers (including scientific notation like 1e-6, 1.5E+3, hex 0xFF)
            if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(nextChar))) {
                const start = this.pos;
                while (this.pos < this.len) {
                    const cur = this.source[this.pos];
                    if (/[0-9a-zA-Z._]/.test(cur)) {
                        this.pos++;
                        if ((cur === 'e' || cur === 'E') && this.pos < this.len &&
                            (this.source[this.pos] === '+' || this.source[this.pos] === '-') &&
                            this.pos + 1 < this.len && /[0-9]/.test(this.source[this.pos + 1])) {
                            this.pos++;
                        }
                    } else {
                        break;
                    }
                }
                tokens.push({ type: 'NUMBER', value: this.source.slice(start, this.pos) });
                continue;
            }

            // Identifiers / Keywords
            if (/[a-zA-Z_]/.test(char)) {
                const start = this.pos;
                while (this.pos < this.len && /[a-zA-Z0-9_]/.test(this.source[this.pos])) {
                    this.pos++;
                }
                const word = this.source.slice(start, this.pos);
                tokens.push({ type: 'IDENTIFIER', value: word });
                continue;
            }

            // Three-char operators
            const threeChar = this.pos + 2 < this.len ? this.source.slice(this.pos, this.pos + 3) : '';
            if (THREE_CHAR_OPERATORS.has(threeChar)) {
                tokens.push({ type: 'OPERATOR', value: threeChar });
                this.pos += 3;
                continue;
            }

            // Two-char operators
            const twoChar = char + nextChar;
            if (TWO_CHAR_OPERATORS.has(twoChar)) {
                tokens.push({ type: 'OPERATOR', value: twoChar });
                this.pos += 2;
                continue;
            }

            // Single-char symbols
            tokens.push({ type: 'SYMBOL', value: char });
            this.pos++;
        }

        return tokens;
    }

    readDirective() {
        let logicalLine = '';
        while (this.pos < this.len) {
            const c = this.source[this.pos];
            if (c === '\r') {
                this.pos++;
                continue;
            }
            if (c === '\n') {
                if (/\\[ \t]*$/.test(logicalLine)) {
                    logicalLine = logicalLine.replace(/\\[ \t]*$/, ' ');
                    this.pos++;
                    this.line++;
                    continue;
                }
                break;
            }
            logicalLine += c;
            this.pos++;
        }
        const normalized = logicalLine.replace(/[ \t]+/g, ' ').trim();
        const meta = parseDirectiveMeta(normalized);
        return {
            type: 'DIRECTIVE',
            value: normalized,
            ...meta
        };
    }

    skipWhitespace() {
        while (this.pos < this.len && /\s/.test(this.source[this.pos])) {
            if (this.source[this.pos] === '\n') this.line++;
            this.pos++;
        }
    }
}

/**
 * Safely expand known C++ macros inside a preprocessor #if/#elif expression string.
 */
function expandPreprocessorMacros(expr, definedMacros, depth = 0) {
    if (!expr || depth > 16) return expr;

    let src = String(expr);
    // Resolve defined(NAME) and defined NAME before macro substitution
    src = src.replace(/\bdefined\s*\(\s*([a-zA-Z_]\w*)\s*\)/g, (_, name) =>
        (definedMacros.has(name) ? ' 1 ' : ' 0 ')
    );
    src = src.replace(/\bdefined\s+([a-zA-Z_]\w*)/g, (_, name) =>
        (definedMacros.has(name) ? ' 1 ' : ' 0 ')
    );

    const tokens = new CppTokenizer(src).tokenize().filter(t => t.type !== 'COMMENT' && t.type !== 'COMMENT_BLOCK');
    let out = '';
    let changed = false;

    for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        if (tok.type === 'IDENTIFIER' && definedMacros.has(tok.value)) {
            const macro = definedMacros.get(tok.value);
            if (macro.params !== null && tokens[i + 1]?.value === '(') {
                // Collect function-like macro arguments
                let pDepth = 1;
                let j = i + 2;
                const args = [];
                let curArg = [];
                while (j < tokens.length && pDepth > 0) {
                    const t = tokens[j];
                    if (t.value === '(') {
                        pDepth++;
                        curArg.push(t.value);
                    } else if (t.value === ')') {
                        pDepth--;
                        if (pDepth === 0) break;
                        curArg.push(t.value);
                    } else if (t.value === ',' && pDepth === 1) {
                        args.push(curArg.join(' '));
                        curArg = [];
                    } else {
                        curArg.push(t.value);
                    }
                    j++;
                }
                if (curArg.length > 0 || args.length > 0) {
                    args.push(curArg.join(' '));
                }

                let body = macro.body || '0';
                const bodyTokens = new CppTokenizer(body).tokenize();
                const paramMap = new Map();
                macro.params.forEach((p, idx) => {
                    paramMap.set(p, args[idx] ?? '');
                });
                const substituted = bodyTokens.map(bt => {
                    if (bt.type === 'IDENTIFIER' && paramMap.has(bt.value)) {
                        return `(${paramMap.get(bt.value)})`;
                    }
                    return bt.value;
                }).join(' ');
                out += ` (${substituted}) `;
                i = j;
                changed = true;
                continue;
            } else if (macro.params === null) {
                out += ` (${macro.body || '1'}) `;
                changed = true;
                continue;
            }
        }
        out += tok.value + ' ';
    }

    return changed ? expandPreprocessorMacros(out, definedMacros, depth + 1) : out.trim();
}

/**
 * Evaluate a C++ #if / #elif integer constant expression safely without eval().
 */
function evaluatePreprocessorExpr(expr, definedMacros) {
    try {
        const expanded = expandPreprocessorMacros(expr, definedMacros);
        const tokens = new CppTokenizer(expanded).tokenize().filter(t => t.type !== 'COMMENT' && t.type !== 'COMMENT_BLOCK');
        if (tokens.length === 0) return false;

        let idx = 0;
        const peek = () => (idx < tokens.length ? tokens[idx] : null);
        const consume = () => tokens[idx++];

        const parseTernary = () => {
            const cond = parseOr();
            if (peek()?.value === '?') {
                consume();
                const tVal = parseTernary();
                if (peek()?.value === ':') consume();
                const fVal = parseTernary();
                return cond ? tVal : fVal;
            }
            return cond;
        };
        const parseOr = () => {
            let v = parseAnd();
            while (peek()?.value === '||') {
                consume();
                const r = parseAnd();
                v = (v || r) ? 1 : 0;
            }
            return v;
        };
        const parseAnd = () => {
            let v = parseBitOr();
            while (peek()?.value === '&&') {
                consume();
                const r = parseBitOr();
                v = (v && r) ? 1 : 0;
            }
            return v;
        };
        const parseBitOr = () => {
            let v = parseBitXor();
            while (peek()?.value === '|') {
                consume();
                v = v | parseBitXor();
            }
            return v;
        };
        const parseBitXor = () => {
            let v = parseBitAnd();
            while (peek()?.value === '^') {
                consume();
                v = v ^ parseBitAnd();
            }
            return v;
        };
        const parseBitAnd = () => {
            let v = parseEq();
            while (peek()?.value === '&') {
                consume();
                v = v & parseEq();
            }
            return v;
        };
        const parseEq = () => {
            let v = parseRel();
            while (peek()?.value === '==' || peek()?.value === '!=') {
                const op = consume().value;
                const r = parseRel();
                v = (op === '==' ? v === r : v !== r) ? 1 : 0;
            }
            return v;
        };
        const parseRel = () => {
            let v = parseShift();
            while (['<', '<=', '>', '>='].includes(peek()?.value)) {
                const op = consume().value;
                const r = parseShift();
                if (op === '<') v = v < r ? 1 : 0;
                else if (op === '<=') v = v <= r ? 1 : 0;
                else if (op === '>') v = v > r ? 1 : 0;
                else v = v >= r ? 1 : 0;
            }
            return v;
        };
        const parseShift = () => {
            let v = parseAdd();
            while (peek()?.value === '<<' || peek()?.value === '>>') {
                const op = consume().value;
                const r = parseAdd();
                v = op === '<<' ? (v << r) : (v >> r);
            }
            return v;
        };
        const parseAdd = () => {
            let v = parseMul();
            while (peek()?.value === '+' || peek()?.value === '-') {
                const op = consume().value;
                const r = parseMul();
                v = op === '+' ? (v + r) : (v - r);
            }
            return v;
        };
        const parseMul = () => {
            let v = parseUnary();
            while (['*', '/', '%'].includes(peek()?.value)) {
                const op = consume().value;
                const r = parseUnary();
                if (op === '*') v *= r;
                else if (op === '/') v = r === 0 ? 0 : Math.trunc(v / r);
                else v = r === 0 ? 0 : v % r;
            }
            return v;
        };
        const parseUnary = () => {
            const p = peek();
            if (!p) return 0;
            if (p.value === '!') { consume(); return parseUnary() ? 0 : 1; }
            if (p.value === '~') { consume(); return ~parseUnary(); }
            if (p.value === '-') { consume(); return -parseUnary(); }
            if (p.value === '+') { consume(); return +parseUnary(); }
            return parsePrimary();
        };
        const parsePrimary = () => {
            const p = peek();
            if (!p) return 0;
            if (p.value === '(') {
                consume();
                const v = parseTernary();
                if (peek()?.value === ')') consume();
                return v;
            }
            if (p.type === 'NUMBER') {
                consume();
                const cleaned = p.value.replace(/[uUlLfF]+$/, '');
                const num = Number(cleaned);
                return Number.isNaN(num) ? 0 : num;
            }
            if (p.type === 'STRING' && p.value.startsWith('\'')) {
                consume();
                const inner = p.value.slice(1, -1);
                return inner ? inner.charCodeAt(0) : 0;
            }
            if (p.type === 'IDENTIFIER') {
                consume();
                if (p.value === 'true') return 1;
                if (p.value === 'false') return 0;
                return 0; // Undefined identifiers evaluate to 0 in C++ preprocessor
            }
            consume();
            return 0;
        };

        return Boolean(parseTernary());
    } catch {
        return true;
    }
}

function evaluateDirectiveBranch(directive, definedMacros) {
    if (!directive) return false;
    if (directive.directiveKind === 'ifdef') {
        return definedMacros.has(directive.condition);
    }
    if (directive.directiveKind === 'ifndef') {
        return !definedMacros.has(directive.condition);
    }
    if (directive.directiveKind === 'if' || directive.directiveKind === 'elif') {
        return evaluatePreprocessorExpr(directive.condition, definedMacros);
    }
    if (directive.directiveKind === 'else') {
        return true;
    }
    return false;
}

/**
 * Extract readable parameter names from a parameter token list, handling default values (= 0) and arrays ([]).
 */
function extractParamNames(paramTokens) {
    if (!paramTokens || paramTokens.length === 0) return [];

    // Split into comma-separated parameter chunks at top-level nesting
    const chunks = [];
    let cur = [];
    let pDepth = 0;
    let aDepth = 0;
    let bDepth = 0;
    for (const tok of paramTokens) {
        if (tok.value === '(' || tok.value === '{') pDepth++;
        else if (tok.value === ')' || tok.value === '}') pDepth--;
        else if (tok.value === '[') bDepth++;
        else if (tok.value === ']') bDepth--;
        else if (tok.value === '<' && pDepth === 0) aDepth++;
        else if (tok.value === '>' && pDepth === 0 && aDepth > 0) aDepth--;
        else if (tok.value === ',' && pDepth === 0 && aDepth === 0 && bDepth === 0) {
            chunks.push(cur);
            cur = [];
            continue;
        }
        cur.push(tok);
    }
    if (cur.length > 0) chunks.push(cur);

    // Lone 'void' parameter list means 0 params
    if (chunks.length === 1 && chunks[0].length === 1 && chunks[0][0].value === 'void') {
        return [];
    }

    const names = [];
    for (const chunk of chunks) {
        // Ignore default value tokens (= ...)
        let eqIdx = -1;
        let depth = 0;
        for (let i = 0; i < chunk.length; i++) {
            const v = chunk[i].value;
            if (v === '(' || v === '<' || v === '[') depth++;
            else if (v === ')' || v === '>' || v === ']') depth--;
            else if (v === '=' && depth === 0) {
                eqIdx = i;
                break;
            }
        }
        const beforeDefault = eqIdx !== -1 ? chunk.slice(0, eqIdx) : chunk;
        // Strip trailing array brackets [N]
        let endIdx = beforeDefault.length;
        while (endIdx > 0 && beforeDefault[endIdx - 1].value === ']') {
            let br = 1;
            endIdx--;
            while (endIdx > 0 && br > 0) {
                endIdx--;
                if (beforeDefault[endIdx].value === ']') br++;
                else if (beforeDefault[endIdx].value === '[') br--;
            }
        }
        const head = beforeDefault.slice(0, endIdx);
        // Find last identifier in head (excluding type words)
        for (let i = head.length - 1; i >= 0; i--) {
            const tok = head[i];
            if (tok.type === 'IDENTIFIER' && !CPP_TYPE_WORDS.has(tok.value)) {
                names.push(tok.value);
                break;
            }
        }
    }
    return names;
}

/**
 * Extract declared variable name(s) and initializer tokens from a declaration token slice (after type prefix).
 */
function parseDeclaratorList(declTokens, formatExprFn) {
    const declarators = [];
    let cur = [];
    let parenDepth = 0;
    for (const t of declTokens) {
        if (t.value === '(' || t.value === '{' || t.value === '[') parenDepth++;
        else if (t.value === ')' || t.value === '}' || t.value === ']') parenDepth--;
        else if (t.value === ',' && parenDepth === 0) {
            if (cur.length > 0) declarators.push(cur);
            cur = [];
            continue;
        }
        cur.push(t);
    }
    if (cur.length > 0) declarators.push(cur);

    return declarators.map(decl => {
        let eqIdx = -1;
        let pDepth = 0;
        for (let i = 0; i < decl.length; i++) {
            const v = decl[i].value;
            if (v === '(' || v === '[' || v === '{') pDepth++;
            else if (v === ')' || v === ']' || v === '}') pDepth--;
            else if (v === '=' && pDepth === 0) {
                eqIdx = i;
                break;
            }
        }
        const lhs = eqIdx !== -1 ? decl.slice(0, eqIdx) : decl;
        const rhs = eqIdx !== -1 ? decl.slice(eqIdx + 1) : [];

        // Strip leading * / & pointers and trailing [dims] when extracting plain identifier name
        const cleanLhs = lhs.filter(t => t.value !== '*' && t.value !== '&');
        let varName = '';
        for (const t of cleanLhs) {
            if (t.type === 'IDENTIFIER') {
                varName = t.value;
                break;
            }
        }
        const lhsDisplay = cleanLhs.map(t => t.value).join('');
        const exprText = rhs.length > 0 ? formatExprFn(rhs) : '';
        return {
            varName: varName || lhsDisplay,
            lhsDisplay: lhsDisplay || varName,
            hasInit: eqIdx !== -1,
            exprText,
            decl
        };
    });
}

class CppParser {
    constructor(tokens, options = {}) {
        this.tokens = tokens.filter(t => t.type !== 'COMMENT' && t.type !== 'COMMENT_BLOCK');
        this.pos = 0;
        this.options = Object.assign({
            simplifyExpressions: false,
            showDeclarations: false,
            expressionStyle: 'original',
            fileName: 'main.cpp',
            definedMacros: null,
            resolveInclude: null,
            deferDependencyResolution: false
        }, options);

        this.exprCounter = 1;
        this.exprMap = new Map();

        this.fileIncludes = [];
        this.fileMacros = [];
        this.fileMacroMap = new Map();
        this.definedMacros = new Map(this.options.definedMacros || []);
        this.fileNamespaces = [];
        this.fileNamespaceSet = new Set();
        this.usingNamespaces = [];
        this.usingNamespaceSet = new Set();
        this.usingDeclarations = new Map();
        this.namespaceStack = [];
        this.globals = [];
        this.functions = [];
        this.globalStmts = [];
        this.currentLocalVars = new Set();
    }

    peek(offset = 0) {
        return this.pos + offset < this.tokens.length ? this.tokens[this.pos + offset] : null;
    }

    consume() {
        return this.pos < this.tokens.length ? this.tokens[this.pos++] : null;
    }

    match(type, value) {
        const t = this.peek();
        if (!t) return false;
        if (type && t.type !== type) return false;
        if (value && t.value !== value) return false;
        return true;
    }

    expect(type, value) {
        if (!this.match(type, value)) {
            const actual = this.peek() ? `${this.peek().type}('${this.peek().value}')` : 'EOF';
            throw new Error(`Очікувалось ${type}${value ? ` '${value}'` : ''}, отримано ${actual}`);
        }
        return this.consume();
    }

    recordMacro(tok) {
        if (!tok || !tok.macroName) return;
        const entry = {
            name: tok.macroName,
            params: tok.macroParams ?? null,
            kind: tok.macroKind || 'constant',
            body: tok.macroBody || '',
            raw: tok.raw || tok.value
        };
        this.definedMacros.set(entry.name, entry);
        if (!this.fileMacroMap.has(entry.name)) {
            this.fileMacroMap.set(entry.name, entry);
            this.fileMacros.push(entry);
        } else {
            // Update to latest active definition while keeping list position
            const existing = this.fileMacroMap.get(entry.name);
            Object.assign(existing, entry);
        }
    }

    recordNamespace(nsName) {
        if (!nsName) return;
        if (!this.fileNamespaceSet.has(nsName)) {
            this.fileNamespaceSet.add(nsName);
            this.fileNamespaces.push(nsName);
        }
    }

    recordUsingNamespace(nsName) {
        if (!nsName) return;
        if (!this.usingNamespaceSet.has(nsName)) {
            this.usingNamespaceSet.add(nsName);
            this.usingNamespaces.push(nsName);
        }
    }

    /**
     * Collect all #if / #elif / #else / #endif branches starting from the current DIRECTIVE token.
     */
    collectPreprocessorBranches() {
        const firstDir = this.consume();
        const branches = [{ directive: firstDir, tokens: [] }];
        let depth = 0;

        while (this.pos < this.tokens.length) {
            const tok = this.consume();
            if (tok.type === 'DIRECTIVE') {
                if (['if', 'ifdef', 'ifndef'].includes(tok.directiveKind)) {
                    depth++;
                    branches[branches.length - 1].tokens.push(tok);
                    continue;
                }
                if (tok.directiveKind === 'endif') {
                    if (depth === 0) break;
                    depth--;
                    branches[branches.length - 1].tokens.push(tok);
                    continue;
                }
                if (depth === 0 && (tok.directiveKind === 'elif' || tok.directiveKind === 'else')) {
                    branches.push({ directive: tok, tokens: [] });
                    continue;
                }
            }
            branches[branches.length - 1].tokens.push(tok);
        }
        return branches;
    }

    /**
     * Catalog #define tokens inside inactive branches so header macro lists remain complete.
     */
    catalogMacrosInTokens(tokenList) {
        for (const tok of tokenList) {
            if (tok.type === 'DIRECTIVE' && tok.directiveKind === 'define' && tok.macroName) {
                if (!this.fileMacroMap.has(tok.macroName)) {
                    const entry = {
                        name: tok.macroName,
                        params: tok.macroParams ?? null,
                        kind: tok.macroKind || 'constant',
                        body: tok.macroBody || '',
                        raw: tok.raw || tok.value
                    };
                    this.fileMacroMap.set(entry.name, entry);
                    this.fileMacros.push(entry);
                }
            }
        }
    }

    /**
     * Parse top-level or namespace-level items.
     */
    parse() {
        this.parseScopeItems(false);
        if (this.options.deferDependencyResolution) {
            return this.buildFileSummary();
        }
        return finalizeSingleFileResult(this.buildFileSummary(), this.options);
    }

    buildFileSummary() {
        return {
            fileName: this.options.fileName || 'main.cpp',
            includes: this.fileIncludes,
            macros: this.fileMacros,
            definedMacros: this.definedMacros,
            namespaces: this.fileNamespaces,
            usingNamespaces: this.usingNamespaces,
            usingDeclarations: this.usingDeclarations,
            globals: this.globals,
            functions: this.functions,
            globalStmts: this.cleanStatements(this.globalStmts)
        };
    }

    parseScopeItems(stopAtBrace = false) {
        while (this.pos < this.tokens.length) {
            if (stopAtBrace && this.match('SYMBOL', '}')) {
                this.consume();
                return;
            }
            if (this.match('SYMBOL', ';')) {
                this.consume();
                continue;
            }

            const tok = this.peek();

            // Preprocessor directives at file/namespace scope
            if (tok.type === 'DIRECTIVE') {
                this.handleTopLevelDirective();
                continue;
            }

            // using namespace X; or using X::y;
            if (tok.type === 'IDENTIFIER' && tok.value === 'using') {
                this.parseUsingDirective();
                continue;
            }

            // namespace nsName { ... }
            if (tok.type === 'IDENTIFIER' && tok.value === 'namespace') {
                this.parseNamespaceBlock();
                continue;
            }

            // typedef ...;
            if (tok.type === 'IDENTIFIER' && tok.value === 'typedef') {
                this.skipTypeDeclaration();
                continue;
            }

            // struct / class / enum definitions (distinguishing `struct Node { ... };` from `struct Node* fn()`)
            if (tok.type === 'IDENTIFIER' && ['struct', 'class', 'enum', 'union'].includes(tok.value) && this.isTypeDefinitionStart()) {
                this.skipTypeDeclaration();
                continue;
            }

            // Function definition or prototype (including template <...> and ns::func)
            if (this.isFunctionHeader()) {
                const func = this.parseFunctionDefinitionOrPrototype();
                if (func) {
                    this.functions.push(func);
                }
                continue;
            }

            // Global or namespace variable declaration (e.g., extern int n; double x = 0.0, y = 0.0;)
            if (this.isVariableDeclarationAtScope()) {
                const stmts = this.parseScopeVariableDeclaration();
                if (stmts && stmts.length > 0 && this.namespaceStack.length === 0) {
                    this.globalStmts.push(...stmts);
                }
                continue;
            }

            // Fallback: statement snippet mode (for code fragments pasted without main())
            const stmt = this.parseStatement();
            if (stmt) {
                if (Array.isArray(stmt)) this.globalStmts.push(...stmt);
                else this.globalStmts.push(stmt);
            }
        }
    }

    handleTopLevelDirective() {
        const dir = this.peek();
        if (!dir) return;

        if (dir.directiveKind === 'include') {
            this.consume();
            this.fileIncludes.push({
                target: dir.includeTarget,
                isLocal: dir.isLocal,
                raw: dir.raw || dir.value
            });
            if (typeof this.options.resolveInclude === 'function') {
                const imported = this.options.resolveInclude(dir.includeTarget, dir.isLocal, this.definedMacros);
                if (imported && imported.size > 0) {
                    for (const [k, v] of imported.entries()) {
                        if (!this.definedMacros.has(k)) {
                            this.definedMacros.set(k, v);
                        }
                    }
                }
            }
            return;
        }

        if (dir.directiveKind === 'define') {
            this.consume();
            this.recordMacro(dir);
            return;
        }

        if (dir.directiveKind === 'undef') {
            this.consume();
            if (dir.macroName) this.definedMacros.delete(dir.macroName);
            return;
        }

        if (['if', 'ifdef', 'ifndef'].includes(dir.directiveKind)) {
            const branches = this.collectPreprocessorBranches();
            let chosen = null;
            for (const b of branches) {
                if (!chosen && evaluateDirectiveBranch(b.directive, this.definedMacros)) {
                    chosen = b;
                } else {
                    this.catalogMacrosInTokens(b.tokens);
                }
            }
            if (chosen && chosen.tokens.length > 0) {
                // Splice chosen branch tokens directly at current position
                this.tokens.splice(this.pos, 0, ...chosen.tokens);
            }
            return;
        }

        // #pragma, #error, stray #elif/#else/#endif
        this.consume();
    }

    parseUsingDirective() {
        this.expect('IDENTIFIER', 'using');
        const parts = [];
        while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) {
            parts.push(this.consume());
        }
        if (this.match('SYMBOL', ';')) this.consume();

        if (parts.length >= 2 && parts[0].value === 'namespace') {
            const ns = parts.slice(1).map(t => t.value).join('');
            this.recordUsingNamespace(ns);
        } else if (parts.length >= 3 && parts.some(t => t.value === '::') && !parts.some(t => t.value === '=')) {
            const full = parts.map(t => t.value).join('');
            const shortName = parts[parts.length - 1].value;
            this.usingDeclarations.set(shortName, full);
        }
    }

    parseNamespaceBlock() {
        this.expect('IDENTIFIER', 'namespace');
        const nameParts = [];
        while (this.pos < this.tokens.length && !this.match('SYMBOL', '{') && !this.match('SYMBOL', ';') && !this.match('SYMBOL', '=')) {
            const t = this.consume();
            if (t.type === 'IDENTIFIER') nameParts.push(t.value);
        }

        // namespace alias = target;
        if (this.match('SYMBOL', '=')) {
            while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) this.consume();
            if (this.match('SYMBOL', ';')) this.consume();
            return;
        }

        const nsName = nameParts.join('::') || '(anonymous)';
        if (this.match('SYMBOL', '{')) {
            this.consume();
            this.recordNamespace(nsName);
            this.namespaceStack.push(nsName);
            this.parseScopeItems(true);
            this.namespaceStack.pop();
        } else if (this.match('SYMBOL', ';')) {
            this.consume();
        }
    }

    isTypeDefinitionStart() {
        let idx = this.pos + 1;
        while (idx < this.tokens.length) {
            const v = this.tokens[idx].value;
            if (v === '{' || v === ':' || v === ';') return true;
            if (v === '(' || v === '*' || v === '&') return false;
            idx++;
        }
        return false;
    }

    skipTypeDeclaration() {
        while (this.pos < this.tokens.length) {
            const t = this.consume();
            if (t.value === '{') {
                let depth = 1;
                while (this.pos < this.tokens.length && depth > 0) {
                    const inner = this.consume();
                    if (inner.value === '{') depth++;
                    else if (inner.value === '}') depth--;
                }
                while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) {
                    this.consume();
                }
                if (this.match('SYMBOL', ';')) this.consume();
                return;
            }
            if (t.value === ';') return;
        }
    }

    /**
     * Skip an optional `template < ... >` prefix starting at `idx`.
     * Returns { endIdx, templateParams } or null if not a template prefix.
     */
    scanTemplatePrefix(startIdx) {
        if (this.tokens[startIdx]?.value !== 'template') return null;
        if (this.tokens[startIdx + 1]?.value !== '<') return null;

        let idx = startIdx + 2;
        let depth = 1;
        const innerTokens = [];
        while (idx < this.tokens.length && depth > 0) {
            const val = this.tokens[idx].value;
            if (val === '<') {
                depth++;
            } else if (val === '>') {
                depth--;
                if (depth === 0) {
                    idx++;
                    break;
                }
            } else if (val === '>>') {
                depth -= 2;
                if (depth <= 0) {
                    idx++;
                    break;
                }
            }
            innerTokens.push(this.tokens[idx]);
            idx++;
        }
        if (depth > 0) return null;

        // Extract template parameter names (e.g. typename T -> ['T'])
        const templateParams = [];
        const paramChunks = [];
        let cur = [];
        for (const t of innerTokens) {
            if (t.value === ',') {
                paramChunks.push(cur);
                cur = [];
            } else {
                cur.push(t);
            }
        }
        if (cur.length > 0) paramChunks.push(cur);
        for (const chunk of paramChunks) {
            for (let k = chunk.length - 1; k >= 0; k--) {
                if (chunk[k].type === 'IDENTIFIER' && !['typename', 'class', 'int', 'size_t'].includes(chunk[k].value)) {
                    templateParams.push(chunk[k].value);
                    break;
                }
            }
        }
        return { endIdx: idx, templateParams };
    }

    isFunctionHeader() {
        let scanStart = this.pos;
        const tmpl = this.scanTemplatePrefix(scanStart);
        if (tmpl) {
            scanStart = tmpl.endIdx;
        }

        let parenIdx = -1;
        let angleDepth = 0;
        for (let i = scanStart; i < this.tokens.length; i++) {
            const val = this.tokens[i].value;
            if (val === '<' && i > scanStart) {
                angleDepth++;
                continue;
            }
            if (val === '>' && angleDepth > 0) {
                angleDepth--;
                continue;
            }
            if (angleDepth === 0 && val === '(') {
                parenIdx = i;
                break;
            }
            if ([';', '{', '}', '=', '<<', '>>'].includes(val)) {
                return false;
            }
        }

        if (parenIdx <= scanStart) return false;

        // Function name may be qualified: nsDod::dod or dod
        let nameStartIdx = parenIdx - 1;
        const nameTok = this.tokens[nameStartIdx];
        if (!nameTok || nameTok.type !== 'IDENTIFIER' || CPP_CONTROL_KEYWORDS.has(nameTok.value)) {
            return false;
        }
        while (nameStartIdx >= scanStart + 2 &&
               this.tokens[nameStartIdx - 1]?.value === '::' &&
               this.tokens[nameStartIdx - 2]?.type === 'IDENTIFIER') {
            nameStartIdx -= 2;
        }

        // Must have a return type before nameStartIdx (or constructor — though labs use return types)
        if (nameStartIdx <= scanStart) return false;

        angleDepth = 0;
        for (let i = scanStart; i < nameStartIdx; i++) {
            const t = this.tokens[i];
            if (t.value === '<') { angleDepth++; continue; }
            if (t.value === '>' && angleDepth > 0) { angleDepth--; continue; }
            if (angleDepth > 0) continue;
            if (CPP_TYPE_WORDS.has(t.value) || t.value === '*' || t.value === '&' || t.value === '::' ||
                (t.type === 'IDENTIFIER' && !CPP_CONTROL_KEYWORDS.has(t.value))) {
                continue;
            }
            return false;
        }

        let depth = 1;
        let idx = parenIdx + 1;
        while (idx < this.tokens.length && depth > 0) {
            if (this.tokens[idx].value === '(') depth++;
            else if (this.tokens[idx].value === ')') depth--;
            idx++;
        }
        if (depth !== 0) return false;

        while (idx < this.tokens.length && ['const', 'noexcept', 'override', 'final'].includes(this.tokens[idx].value)) {
            idx++;
        }

        if (idx < this.tokens.length && (this.tokens[idx].value === '{' || this.tokens[idx].value === ';')) {
            return true;
        }
        return false;
    }

    parseFunctionDefinitionOrPrototype() {
        let templateParams = [];
        let isTemplate = false;
        const tmpl = this.scanTemplatePrefix(this.pos);
        if (tmpl) {
            isTemplate = true;
            templateParams = tmpl.templateParams;
            this.pos = tmpl.endIdx;
        }

        let parenIdx = this.pos;
        let angleDepth = 0;
        while (parenIdx < this.tokens.length) {
            const v = this.tokens[parenIdx].value;
            if (v === '<' && parenIdx > this.pos) angleDepth++;
            else if (v === '>' && angleDepth > 0) angleDepth--;
            else if (angleDepth === 0 && v === '(') break;
            parenIdx++;
        }

        // Walk backwards from parenIdx - 1 to split returnType vs qualified function name (e.g. nsDod::dod)
        let nameStartIdx = parenIdx - 1;
        while (nameStartIdx >= this.pos + 2 &&
               this.tokens[nameStartIdx - 1]?.value === '::' &&
               this.tokens[nameStartIdx - 2]?.type === 'IDENTIFIER') {
            nameStartIdx -= 2;
        }

        const returnTypeTokens = [];
        while (this.pos < nameStartIdx) {
            returnTypeTokens.push(this.consume().value);
        }

        const qualifiedTokens = [];
        while (this.pos < parenIdx) {
            qualifiedTokens.push(this.consume().value);
        }

        const baseName = qualifiedTokens[qualifiedTokens.length - 1] || '';
        const explicitNsParts = [];
        for (let i = 0; i < qualifiedTokens.length - 1; i += 2) {
            if (qualifiedTokens[i] && qualifiedTokens[i] !== '::') {
                explicitNsParts.push(qualifiedTokens[i]);
            }
        }
        const combinedNsParts = [...this.namespaceStack, ...explicitNsParts].filter(Boolean);
        const namespace = combinedNsParts.length > 0 ? combinedNsParts.join('::') : null;
        if (namespace) {
            this.recordNamespace(namespace);
        }

        this.expect('SYMBOL', '(');
        const paramTokens = [];
        let parenDepth = 1;
        while (this.pos < this.tokens.length && parenDepth > 0) {
            const t = this.consume();
            if (t.value === '(') parenDepth++;
            else if (t.value === ')') {
                parenDepth--;
                if (parenDepth === 0) break;
            }
            paramTokens.push(t);
        }

        while (this.pos < this.tokens.length && ['const', 'noexcept', 'override', 'final'].includes(this.peek()?.value)) {
            this.consume();
        }

        const paramNames = extractParamNames(paramTokens);
        const displayName = isTemplate && templateParams.length > 0
            ? `${baseName}<${templateParams.join(', ')}>`
            : baseName;
        const qualifiedName = namespace ? `${namespace}::${displayName}` : displayName;
        const sig = `${displayName}(${paramNames.join(', ')})`;
        const qualifiedSig = namespace ? `${namespace}::${sig}` : sig;
        const returnType = returnTypeTokens.join(' ').replace(/\s*::\s*/g, '::');
        const fileName = this.options.fileName || 'main.cpp';

        // Prototype / declaration ending with ';'
        if (this.match('SYMBOL', ';')) {
            this.consume();
            return {
                name: displayName,
                baseName,
                qualifiedName,
                namespace,
                returnType,
                signature: sig,
                qualifiedSignature: qualifiedSig,
                paramNames,
                file: fileName,
                isMain: baseName === 'main' && !namespace,
                isDeclaration: true,
                isTemplate,
                templateParams,
                body: [],
                rawBodyTokens: [],
                localVarNames: new Set(paramNames)
            };
        }

        // Function definition with '{ ... }'
        if (this.match('SYMBOL', '{')) {
            const bodyStartIdx = this.pos + 1;
            const prevLocals = this.currentLocalVars;
            this.currentLocalVars = new Set(paramNames);

            const body = this.parseBlock();
            const bodyEndIdx = this.pos - 1;
            const rawBodyTokens = this.tokens.slice(bodyStartIdx, bodyEndIdx);
            const localVarNames = new Set(this.currentLocalVars);
            this.currentLocalVars = prevLocals;

            const cleanedBody = this.cleanStatements(body);

            return {
                name: displayName,
                baseName,
                qualifiedName,
                namespace,
                returnType,
                signature: sig,
                qualifiedSignature: qualifiedSig,
                paramNames,
                file: fileName,
                isMain: baseName === 'main' && !namespace,
                isDeclaration: false,
                isTemplate,
                templateParams,
                body: cleanedBody,
                rawBodyTokens,
                localVarNames
            };
        }

        return null;
    }

    /**
     * Check if the current token position starts a variable type (including optional `std::`).
     * Returns { typeEndIdx, typeTokens, isExtern, isConstOnly } or null.
     */
    scanTypePrefix(startIdx = this.pos) {
        let idx = startIdx;
        let isExtern = false;
        let isConst = false;
        let hasBaseType = false;
        const typeTokens = [];

        while (idx < this.tokens.length) {
            const tok = this.tokens[idx];
            if (tok.value === 'extern') {
                isExtern = true;
                idx++;
                continue;
            }
            if (tok.value === 'const' || tok.value === 'constexpr') {
                isConst = true;
                typeTokens.push(tok.value);
                idx++;
                continue;
            }
            if (tok.value === 'std' && this.tokens[idx + 1]?.value === '::' &&
                STD_NAMESPACE_TYPES.has(this.tokens[idx + 2]?.value)) {
                typeTokens.push('std::' + this.tokens[idx + 2].value);
                hasBaseType = true;
                idx += 3;
                // Optional template argument e.g. std::vector<int>
                if (this.tokens[idx]?.value === '<') {
                    let aDepth = 1;
                    let tArgs = '<';
                    idx++;
                    while (idx < this.tokens.length && aDepth > 0) {
                        const v = this.tokens[idx].value;
                        tArgs += v;
                        if (v === '<') aDepth++;
                        else if (v === '>') aDepth--;
                        idx++;
                    }
                    typeTokens[typeTokens.length - 1] += tArgs;
                }
                continue;
            }
            if (CPP_TYPE_WORDS.has(tok.value)) {
                typeTokens.push(tok.value);
                if (!['static', 'inline', 'virtual', 'volatile', 'mutable'].includes(tok.value)) {
                    hasBaseType = true;
                }
                idx++;
                continue;
            }
            break;
        }

        let hasPointer = false;
        while (idx < this.tokens.length && (this.tokens[idx].value === '*' || this.tokens[idx].value === '&')) {
            if (this.tokens[idx].value === '*') hasPointer = true;
            typeTokens.push(this.tokens[idx].value);
            idx++;
            // Handle `int * const p`
            while (idx < this.tokens.length && this.tokens[idx].value === 'const') {
                typeTokens.push('const');
                idx++;
            }
        }

        if (!hasBaseType) return null;
        return { typeEndIdx: idx, typeTokens, isExtern, isConst, hasPointer };
    }

    isVariableDeclarationAtScope() {
        const info = this.scanTypePrefix(this.pos);
        if (!info) return false;
        const nameTok = this.tokens[info.typeEndIdx];
        if (!nameTok || nameTok.type !== 'IDENTIFIER' || CPP_CONTROL_KEYWORDS.has(nameTok.value)) {
            return false;
        }
        const afterTok = this.tokens[info.typeEndIdx + 1];
        return Boolean(afterTok && ['=', ',', ';', '['].includes(afterTok.value));
    }

    parseScopeVariableDeclaration() {
        const info = this.scanTypePrefix(this.pos);
        if (!info) return [];
        this.pos = info.typeEndIdx;

        const declTokens = [];
        while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) {
            declTokens.push(this.consume());
        }
        if (this.match('SYMBOL', ';')) this.consume();

        const fullType = info.typeTokens.join(' ').replace(/\s+([*&])/g, '$1');
        const currentNs = this.namespaceStack.length > 0 ? this.namespaceStack.join('::') : null;
        const items = parseDeclaratorList(declTokens, t => this.formatExpression(t));

        const stmts = [];
        for (const item of items) {
            if (item.varName) {
                this.globals.push({
                    name: item.varName,
                    type: fullType,
                    isExtern: info.isExtern,
                    namespace: currentNs
                });
            }
            if (!info.isExtern && item.hasInit) {
                const cleanText = `${item.lhsDisplay} = ${item.exprText}`;
                stmts.push({
                    type: 'process',
                    raw: `${cleanText};`,
                    target: item.lhsDisplay,
                    expr: item.exprText,
                    text: cleanText,
                    simplifiedText: cleanText,
                    isDeclarationAssignment: true
                });
            }
        }
        return stmts;
    }

    parseBlock() {
        this.expect('SYMBOL', '{');
        const stmts = [];
        while (this.pos < this.tokens.length && !this.match('SYMBOL', '}')) {
            const stmt = this.parseStatement();
            if (stmt) {
                if (Array.isArray(stmt)) {
                    stmts.push(...stmt);
                } else {
                    stmts.push(stmt);
                }
            }
        }
        if (this.match('SYMBOL', '}')) {
            this.consume();
        }
        return stmts;
    }

    /**
     * Handle #if / #ifdef / #ifndef ... #elif ... #else ... #endif inside function bodies.
     */
    parsePreprocessorConditional() {
        const branches = this.collectPreprocessorBranches();

        // Verify braces are balanced inside every branch before building conditional AST nodes
        const hasBalancedBraces = (toks) => {
            let depth = 0;
            for (const t of toks) {
                if (t.value === '{') depth++;
                else if (t.value === '}') {
                    depth--;
                    if (depth < 0) return false;
                }
            }
            return depth === 0;
        };

        const allBalanced = branches.every(b => hasBalancedBraces(b.tokens));
        if (!allBalanced) {
            // Unbalanced partial block across #if/#else -> splice active branch cleanly
            let chosen = null;
            for (const b of branches) {
                if (evaluateDirectiveBranch(b.directive, this.definedMacros)) {
                    chosen = b;
                    break;
                }
            }
            if (chosen && chosen.tokens.length > 0) {
                this.tokens.splice(this.pos, 0, ...chosen.tokens);
            }
            return null;
        }

        // Parse each branch's statements cleanly into an if / else-if / else AST chain
        const parsedBranches = branches.map(b => {
            const subParser = new CppParser(b.tokens, {
                ...this.options,
                definedMacros: new Map(this.definedMacros)
            });
            const body = [];
            while (subParser.pos < subParser.tokens.length) {
                const s = subParser.parseStatement();
                if (s) {
                    if (Array.isArray(s)) body.push(...s);
                    else body.push(s);
                }
            }
            subParser.fileMacros.forEach(m => {
                if (!this.fileMacroMap.has(m.name)) {
                    this.fileMacroMap.set(m.name, m);
                    this.fileMacros.push(m);
                }
            });
            subParser.currentLocalVars.forEach(v => this.currentLocalVars.add(v));

            const d = b.directive;
            let condLabel = null;
            if (d.directiveKind !== 'else') {
                condLabel = `#${d.directiveKind} ${d.condition || ''}`.trim();
            }
            return {
                kind: d.directiveKind,
                condition: condLabel,
                stmts: body
            };
        });

        const hasAnyStmt = parsedBranches.some(b => b.stmts.length > 0);
        if (!hasAnyStmt) return null;

        let root = null;
        let curIf = null;
        for (const b of parsedBranches) {
            if (b.kind === 'else') {
                if (curIf) {
                    curIf.elseBranch = b.stmts;
                }
                break;
            }
            const ifNode = {
                type: 'if',
                isPreprocessor: true,
                preprocessorKind: `#${b.kind}`,
                condition: b.condition,
                thenBranch: b.stmts,
                elseBranch: null
            };
            if (!root) {
                root = ifNode;
                curIf = ifNode;
            } else {
                curIf.elseBranch = [ifNode];
                curIf = ifNode;
            }
        }
        return root;
    }

    parseStatement() {
        if (this.pos >= this.tokens.length) return null;

        if (this.match('SYMBOL', ';')) {
            this.consume();
            return null;
        }

        if (this.match('SYMBOL', '{')) {
            return this.parseBlock();
        }

        const t = this.peek();

        if (t.type === 'SPLIT_DIRECTIVE') {
            this.consume();
            return {
                type: 'split',
                label: t.label || null
            };
        }

        if (t.type === 'DIRECTIVE') {
            if (['if', 'ifdef', 'ifndef'].includes(t.directiveKind)) {
                return this.parsePreprocessorConditional();
            }
            if (t.directiveKind === 'define') {
                this.consume();
                this.recordMacro(t);
                return null;
            }
            if (t.directiveKind === 'undef') {
                this.consume();
                if (t.macroName) this.definedMacros.delete(t.macroName);
                return null;
            }
            if (t.directiveKind === 'error') {
                this.consume();
                return {
                    type: 'process',
                    isPreprocessor: true,
                    raw: t.raw || t.value,
                    text: t.raw || t.value,
                    simplifiedText: t.raw || t.value
                };
            }
            this.consume();
            return null;
        }

        if (t.type === 'IDENTIFIER' && t.value === 'if') {
            return this.parseIf();
        }

        if (t.type === 'IDENTIFIER' && t.value === 'while') {
            return this.parseWhile();
        }

        if (t.type === 'IDENTIFIER' && t.value === 'for') {
            return this.parseFor();
        }

        if (t.type === 'IDENTIFIER' && t.value === 'do') {
            return this.parseDoWhile();
        }

        if (t.type === 'IDENTIFIER' && t.value === 'switch') {
            return this.parseSwitch();
        }

        if (t.type === 'IDENTIFIER' && t.value === 'return') {
            return this.parseReturn();
        }

        // cin.getline(...) / std::cin.getline(...) -> input statement; cin.get/ignore/clear/sync -> skip
        const isStdCin = t.value === 'std' && this.peek(1)?.value === '::' && this.peek(2)?.value === 'cin';
        const cinOffset = isStdCin ? 2 : (t.value === 'cin' ? 0 : -1);
        if (cinOffset !== -1 && this.peek(cinOffset + 1)?.value === '.') {
            const methodTok = this.peek(cinOffset + 2);
            if (methodTok && methodTok.value === 'getline') {
                return this.parseCinGetline();
            }
            while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) this.consume();
            if (this.match('SYMBOL', ';')) this.consume();
            return null;
        }

        // System pauses / console setup / random seed boilerplate
        if (t.type === 'IDENTIFIER' && ['system', 'getch', '_getch', 'SetConsoleCP', 'SetConsoleOutputCP', 'srand'].includes(t.value)) {
            while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) this.consume();
            if (this.match('SYMBOL', ';')) this.consume();
            return null;
        }

        // Constants (const / constexpr) without pointer indirection -> ignore compile-time constants in flowchart
        if (t.type === 'IDENTIFIER' && ['const', 'constexpr'].includes(t.value)) {
            const typeCheck = this.scanTypePrefix(this.pos);
            if (!typeCheck || !typeCheck.hasPointer) {
                while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) {
                    this.consume();
                }
                if (this.match('SYMBOL', ';')) this.consume();
                return null;
            }
        }

        // Variable declarations (e.g. int x, double *a, std::string str, size_t len = ...)
        const typeInfo = this.scanTypePrefix(this.pos);
        if (typeInfo) {
            const nameTok = this.tokens[typeInfo.typeEndIdx];
            if (nameTok && nameTok.type === 'IDENTIFIER' && !CPP_CONTROL_KEYWORDS.has(nameTok.value)) {
                const afterTok = this.tokens[typeInfo.typeEndIdx + 1];
                if (afterTok && ['=', ',', ';', '['].includes(afterTok.value)) {
                    return this.parseDeclaration();
                }
            }
        }

        if (t.value === 'getline' || (t.value === 'std' && this.peek(1)?.value === '::' && this.peek(2)?.value === 'getline')) {
            return this.parseGetline();
        }

        if (t.value === 'cin' || isStdCin) {
            return this.parseCin();
        }

        if (['cout', 'cerr', 'clog'].includes(t.value) ||
            (t.value === 'std' && this.peek(1)?.value === '::' && ['cout', 'cerr', 'clog'].includes(this.peek(2)?.value))) {
            return this.parseCout();
        }

        return this.parseExpressionStatement();
    }

    parseDeclaration() {
        const typeInfo = this.scanTypePrefix(this.pos);
        if (!typeInfo) return null;
        this.pos = typeInfo.typeEndIdx;
        const fullType = typeInfo.typeTokens.join(' ');

        const declTokens = [];
        while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) {
            declTokens.push(this.consume());
        }
        if (this.match('SYMBOL', ';')) this.consume();

        const items = parseDeclaratorList(declTokens, t => this.formatExpression(t));
        items.forEach(item => {
            if (item.varName) this.currentLocalVars.add(item.varName);
        });

        const assignments = items.filter(it => it.hasInit);
        if (assignments.length === 0) {
            if (this.options.showDeclarations) {
                const vars = items.map(it => it.lhsDisplay).filter(Boolean);
                return {
                    type: 'process',
                    raw: `${fullType} ${vars.join(', ')};`,
                    text: `${fullType} ${vars.join(', ')}`,
                    simplifiedText: `${fullType} ${vars.join(', ')}`
                };
            }
            return null;
        }

        // Ignore dummy 0 initializations in mixed declaration lists (e.g. double xp, xk, x, dx, eps, a=0, R=0, S=0)
        const hasUninitialized = items.some(it => !it.hasInit);
        const allDummyZero = assignments.every(a => ['0', '0.0', '0.f', 'NULL', 'nullptr', '""', '\'\''].includes(a.exprText.trim()));
        if (hasUninitialized && allDummyZero) {
            return null;
        }

        const processNodes = assignments.map(a => {
            const cleanText = `${a.lhsDisplay} = ${a.exprText}`;
            return {
                type: 'process',
                raw: `${cleanText};`,
                target: a.lhsDisplay,
                expr: a.exprText,
                text: cleanText,
                simplifiedText: cleanText,
                isDeclarationAssignment: true
            };
        });

        return processNodes.length === 1 ? processNodes[0] : processNodes;
    }

    readBalancedArgTokens() {
        const targetTokens = [];
        let parenDepth = 0;
        while (this.pos < this.tokens.length) {
            if (this.match('SYMBOL', '(')) parenDepth++;
            else if (this.match('SYMBOL', ')')) {
                if (parenDepth === 0) break;
                parenDepth--;
            } else if (this.match('SYMBOL', ',') && parenDepth === 0) {
                break;
            }
            targetTokens.push(this.consume());
        }
        return targetTokens;
    }

    consumeUntilSemicolon() {
        while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) {
            this.consume();
        }
        if (this.match('SYMBOL', ';')) this.consume();
    }

    parseCinGetline() {
        while (this.pos < this.tokens.length && !this.match('SYMBOL', '(')) {
            this.consume();
        }
        if (this.match('SYMBOL', '(')) this.consume();

        const targetTokens = this.readBalancedArgTokens();
        this.consumeUntilSemicolon();

        const targetVar = this.formatExpression(targetTokens);
        return {
            type: 'input',
            raw: `cin.getline(${targetVar});`,
            variables: [targetVar],
            text: targetVar,
            umlText: `ввід ${targetVar}`
        };
    }

    parseGetline() {
        while (this.peek()?.value === 'std' || this.peek()?.value === '::' || this.peek()?.value === 'getline') {
            this.consume();
        }
        if (this.match('SYMBOL', '(')) this.consume();

        // 1st arg: stream (cin or file)
        while (this.pos < this.tokens.length && !this.match('SYMBOL', ',') && !this.match('SYMBOL', ')')) {
            this.consume();
        }
        if (this.match('SYMBOL', ',')) this.consume();

        // 2nd arg: target variable
        const targetTokens = this.readBalancedArgTokens();
        this.consumeUntilSemicolon();

        const targetVar = this.formatExpression(targetTokens);
        return {
            type: 'input',
            raw: `getline(cin, ${targetVar});`,
            variables: [targetVar],
            text: targetVar,
            umlText: `ввід ${targetVar}`
        };
    }

    parseCin() {
        while (this.peek()?.value === 'std' || this.peek()?.value === '::' || this.peek()?.value === 'cin') {
            this.consume();
        }

        const vars = [];
        while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) {
            if (this.match('OPERATOR', '>>')) {
                this.consume();
                const varTokens = [];
                while (this.pos < this.tokens.length && !this.match('OPERATOR', '>>') && !this.match('SYMBOL', ';')) {
                    varTokens.push(this.consume());
                }
                if (varTokens.length > 0) {
                    vars.push(this.formatExpression(varTokens));
                }
            } else {
                this.consume();
            }
        }
        if (this.match('SYMBOL', ';')) this.consume();

        const varList = vars.join(', ');
        return {
            type: 'input',
            raw: `cin >> ${vars.join(' >> ')};`,
            variables: vars,
            text: varList,
            umlText: `ввід ${varList}`
        };
    }

    parseCout() {
        while (this.peek()?.value === 'std' || this.peek()?.value === '::' || ['cout', 'cerr', 'clog'].includes(this.peek()?.value)) {
            this.consume();
        }

        const parts = [];
        let curPart = [];
        const rawTokens = [];

        while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) {
            const tok = this.consume();
            rawTokens.push(tok);
            if (tok.type === 'OPERATOR' && tok.value === '<<') {
                if (curPart.length > 0) {
                    parts.push(curPart);
                    curPart = [];
                }
            } else {
                curPart.push(tok);
            }
        }
        if (curPart.length > 0) parts.push(curPart);
        if (this.match('SYMBOL', ';')) this.consume();

        const manipulators = new Set([
            'endl', 'ends', 'flush', 'ws',
            'fixed', 'scientific', 'hex', 'dec', 'oct',
            'boolalpha', 'noboolalpha', 'showpoint', 'noshowpoint',
            'left', 'right', 'internal'
        ]);
        const paramManipulators = new Set(['setw', 'setprecision', 'setfill', 'setbase']);

        const orderedItems = [];
        let hasNonString = false;
        let hasTableFormatting = false;

        let hasUpcomingNonString = false;
        for (const p of parts) {
            let firstIdx = 0;
            if (p.length >= 3 && p[0].value === 'std' && p[1].value === '::') {
                firstIdx = 2;
            }
            const leadVal = p[firstIdx]?.value;
            if (manipulators.has(leadVal)) continue;
            if (p.length - firstIdx >= 3 && paramManipulators.has(leadVal)) continue;
            if (p.length === 1 && p[0].type === 'STRING') continue;
            hasUpcomingNonString = true;
            break;
        }

        for (const p of parts) {
            if (p.length === 0) continue;

            let firstIdx = 0;
            if (p.length >= 3 && p[0].value === 'std' && p[1].value === '::') {
                firstIdx = 2;
            }
            const leadVal = p[firstIdx]?.value;

            if (p.length - firstIdx === 1 && manipulators.has(leadVal)) {
                continue;
            }

            if (p.length - firstIdx >= 3 && paramManipulators.has(leadVal) && p[firstIdx + 1]?.value === '(') {
                hasTableFormatting = true;
                continue;
            }

            if (p.length === 1 && p[0].type === 'STRING') {
                const strVal = p[0].value;
                const inner = strVal.slice(1, -1).trim();
                if (/^[-=*#|+_~]+$/.test(inner) || inner === '') {
                    hasTableFormatting = true;
                    continue;
                }
                if (inner.startsWith('|') && inner.endsWith('|')) {
                    hasTableFormatting = true;
                    continue;
                }
                if (hasUpcomingNonString && (inner.endsWith('=') || inner.endsWith(':'))) {
                    continue;
                }
                orderedItems.push(p[0].value);
                continue;
            }

            const exprText = this.formatExpression(p);
            if (exprText) {
                orderedItems.push(exprText);
                hasNonString = true;
            }
        }

        if (orderedItems.length === 0) return null;
        if (!hasNonString && hasTableFormatting) return null;

        const simpleText = orderedItems.join(', ');

        const lastPart = parts.length > 0 ? parts[parts.length - 1] : null;
        let endsWithPromptPunct = false;
        if (lastPart && lastPart.length === 1 && lastPart[0].type === 'STRING') {
            const inner = lastPart[0].value.slice(1, -1).trim();
            endsWithPromptPunct = inner.endsWith('=') || inner.endsWith(':') || inner.endsWith('?') || inner.endsWith('>');
        }
        const hasPromptKeywords = /(?:введіть|ввід|enter|input|точка|point|координат)/i.test(simpleText);
        const isPromptCandidate = !hasNonString || endsWithPromptPunct || hasPromptKeywords;

        return {
            type: 'output',
            raw: `cout ${this.formatExpression(rawTokens)};`,
            text: simpleText,
            umlText: `вивід ${simpleText}`,
            fullText: simpleText,
            isPromptCandidate
        };
    }

    parseIf() {
        this.expect('IDENTIFIER', 'if');
        this.expect('SYMBOL', '(');

        let parenCount = 1;
        const condTokens = [];
        while (this.pos < this.tokens.length && parenCount > 0) {
            const t = this.consume();
            if (t.value === '(') parenCount++;
            else if (t.value === ')') {
                parenCount--;
                if (parenCount === 0) break;
            }
            condTokens.push(t);
        }

        const condition = this.formatExpression(condTokens);

        let thenStmt = null;
        if (this.match('SYMBOL', '{')) {
            thenStmt = this.parseBlock();
        } else {
            thenStmt = this.parseStatement();
            if (thenStmt && !Array.isArray(thenStmt)) {
                thenStmt = [thenStmt];
            }
        }

        let elseStmt = null;
        if (this.match('IDENTIFIER', 'else')) {
            this.consume();
            if (this.match('IDENTIFIER', 'if')) {
                const nestedIf = this.parseIf();
                elseStmt = [nestedIf];
            } else if (this.match('SYMBOL', '{')) {
                elseStmt = this.parseBlock();
            } else {
                const s = this.parseStatement();
                if (s) {
                    elseStmt = Array.isArray(s) ? s : [s];
                }
            }
        }

        return {
            type: 'if',
            condition,
            thenBranch: thenStmt || [],
            elseBranch: elseStmt || null
        };
    }

    parseWhile() {
        this.expect('IDENTIFIER', 'while');
        this.expect('SYMBOL', '(');

        let parenCount = 1;
        const condTokens = [];
        while (this.pos < this.tokens.length && parenCount > 0) {
            const t = this.consume();
            if (t.value === '(') parenCount++;
            else if (t.value === ')') {
                parenCount--;
                if (parenCount === 0) break;
            }
            condTokens.push(t);
        }

        const condition = this.formatExpression(condTokens);

        let body = null;
        if (this.match('SYMBOL', '{')) {
            body = this.parseBlock();
        } else {
            const s = this.parseStatement();
            body = s ? (Array.isArray(s) ? s : [s]) : [];
        }

        return {
            type: 'while',
            condition,
            body
        };
    }

    parseFor() {
        this.expect('IDENTIFIER', 'for');
        this.expect('SYMBOL', '(');

        const initTokens = [];
        while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) {
            initTokens.push(this.consume());
        }
        if (this.match('SYMBOL', ';')) this.consume();

        const condTokens = [];
        while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) {
            condTokens.push(this.consume());
        }
        if (this.match('SYMBOL', ';')) this.consume();

        const stepTokens = [];
        let parenDepth = 1;
        while (this.pos < this.tokens.length && parenDepth > 0) {
            const t = this.consume();
            if (t.value === '(') parenDepth++;
            else if (t.value === ')') {
                parenDepth--;
                if (parenDepth === 0) break;
            }
            stepTokens.push(t);
        }

        let body = null;
        if (this.match('SYMBOL', '{')) {
            body = this.parseBlock();
        } else {
            const s = this.parseStatement();
            body = s ? (Array.isArray(s) ? s : [s]) : [];
        }

        const initFiltered = initTokens.filter(t => !['int', 'double', 'float', 'size_t', 'long', 'short', 'unsigned', 'signed', 'char', 'auto'].includes(t.value));
        const initStr = this.formatExpression(initFiltered);
        const condStr = this.formatExpression(condTokens);
        const stepStr = this.formatExpression(stepTokens);

        return {
            type: 'for',
            init: initStr,
            condition: condStr,
            step: stepStr,
            body
        };
    }

    parseDoWhile() {
        this.expect('IDENTIFIER', 'do');
        let body = null;
        if (this.match('SYMBOL', '{')) {
            body = this.parseBlock();
        } else {
            const s = this.parseStatement();
            body = s ? (Array.isArray(s) ? s : [s]) : [];
        }

        this.expect('IDENTIFIER', 'while');
        this.expect('SYMBOL', '(');

        let parenCount = 1;
        const condTokens = [];
        while (this.pos < this.tokens.length && parenCount > 0) {
            const t = this.consume();
            if (t.value === '(') parenCount++;
            else if (t.value === ')') {
                parenCount--;
                if (parenCount === 0) break;
            }
            condTokens.push(t);
        }

        if (this.match('SYMBOL', ';')) this.consume();

        return {
            type: 'do_while',
            condition: this.formatExpression(condTokens),
            body
        };
    }

    parseSwitch() {
        this.expect('IDENTIFIER', 'switch');
        this.expect('SYMBOL', '(');
        let parenCount = 1;
        const condTokens = [];
        while (this.pos < this.tokens.length && parenCount > 0) {
            const t = this.consume();
            if (t.value === '(') parenCount++;
            else if (t.value === ')') {
                parenCount--;
                if (parenCount === 0) break;
            }
            condTokens.push(t);
        }
        const switchVar = this.formatExpression(condTokens);
        this.expect('SYMBOL', '{');

        const cases = [];
        let defaultBranch = [];

        while (this.pos < this.tokens.length && !this.match('SYMBOL', '}')) {
            if (this.match('IDENTIFIER', 'case')) {
                const caseVals = [];
                while (this.match('IDENTIFIER', 'case')) {
                    this.consume();
                    const valTokens = [];
                    while (this.pos < this.tokens.length && !this.match('SYMBOL', ':')) {
                        valTokens.push(this.consume());
                    }
                    if (this.match('SYMBOL', ':')) this.consume();
                    caseVals.push(this.formatExpression(valTokens));
                }

                const caseStmts = [];
                while (this.pos < this.tokens.length &&
                       !this.match('IDENTIFIER', 'case') &&
                       !this.match('IDENTIFIER', 'default') &&
                       !this.match('SYMBOL', '}')) {
                    if (this.match('IDENTIFIER', 'break')) {
                        this.consume();
                        if (this.match('SYMBOL', ';')) this.consume();
                        continue;
                    }
                    const s = this.parseStatement();
                    if (s) {
                        if (Array.isArray(s)) caseStmts.push(...s);
                        else caseStmts.push(s);
                    }
                }
                const cond = caseVals.map(v => `${switchVar} == ${v}`).join(' || ');
                cases.push({ condition: cond, thenBranch: caseStmts });
            } else if (this.match('IDENTIFIER', 'default')) {
                this.consume();
                if (this.match('SYMBOL', ':')) this.consume();
                const defStmts = [];
                while (this.pos < this.tokens.length &&
                       !this.match('IDENTIFIER', 'case') &&
                       !this.match('IDENTIFIER', 'default') &&
                       !this.match('SYMBOL', '}')) {
                    if (this.match('IDENTIFIER', 'break')) {
                        this.consume();
                        if (this.match('SYMBOL', ';')) this.consume();
                        continue;
                    }
                    const s = this.parseStatement();
                    if (s) {
                        if (Array.isArray(s)) defStmts.push(...s);
                        else defStmts.push(s);
                    }
                }
                defaultBranch = defStmts;
            } else {
                this.consume();
            }
        }
        if (this.match('SYMBOL', '}')) this.consume();

        if (cases.length === 0) return null;

        let rootIf = null;
        let currentIf = null;

        for (const c of cases) {
            const ifNode = {
                type: 'if',
                condition: c.condition,
                thenBranch: c.thenBranch,
                elseBranch: null
            };
            if (!rootIf) {
                rootIf = ifNode;
                currentIf = ifNode;
            } else {
                currentIf.elseBranch = [ifNode];
                currentIf = ifNode;
            }
        }
        if (defaultBranch.length > 0 && currentIf) {
            currentIf.elseBranch = defaultBranch;
        }

        return rootIf;
    }

    parseReturn() {
        this.expect('IDENTIFIER', 'return');
        const retTokens = [];
        while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) {
            retTokens.push(this.consume());
        }
        if (this.match('SYMBOL', ';')) this.consume();

        const formatted = this.formatExpression(retTokens);
        const isMainZero = formatted === '0' || formatted === '';

        return {
            type: 'return',
            raw: `return ${formatted};`,
            text: formatted ? `return ${formatted}` : 'return',
            value: formatted,
            isMainZero
        };
    }

    parseExpressionStatement() {
        const tokens = [];
        while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) {
            // Stop gracefully if an unexpected closing brace appears in malformed input
            if (this.match('SYMBOL', '}')) break;
            tokens.push(this.consume());
        }
        if (this.match('SYMBOL', ';')) this.consume();

        if (tokens.length === 0) return null;

        const exprText = this.formatExpression(tokens);

        let eqIdx = -1;
        let pDepth = 0;
        for (let i = 0; i < tokens.length; i++) {
            const v = tokens[i].value;
            if (v === '(' || v === '[' || v === '{') pDepth++;
            else if (v === ')' || v === ']' || v === '}') pDepth--;
            else if (v === '=' && pDepth === 0) {
                eqIdx = i;
                break;
            }
        }

        let target = '';
        let expr = '';
        let simplifiedText = exprText;

        if (eqIdx > 0) {
            const typeKeywords = new Set(['const', 'constexpr', 'double', 'float', 'int', 'long', 'short', 'auto', 'char', 'bool', 'unsigned', 'signed', 'size_t']);
            const targetTokens = tokens.slice(0, eqIdx).filter(t => !typeKeywords.has(t.value));
            target = targetTokens.map(t => t.value).join('');
            const exprTokens = tokens.slice(eqIdx + 1);
            expr = exprTokens.map(t => t.value).join('');

            if (target === 'A') {
                simplifiedText = 'A = вираз_A';
            } else if (target === 'B') {
                const normalizedExpr = exprTokens.map(t => t.value).join('');
                if (!this.exprMap.has(normalizedExpr)) {
                    this.exprMap.set(normalizedExpr, this.exprCounter++);
                }
                const idx = this.exprMap.get(normalizedExpr);
                simplifiedText = `B = вираз_${idx}`;
            } else {
                simplifiedText = `${target} = ${this.formatExpression(exprTokens)}`;
            }
        }

        const cleanText = target ? `${target} = ${this.formatExpression(tokens.slice(eqIdx + 1))}` : exprText;

        return {
            type: 'process',
            raw: exprText + ';',
            target,
            expr,
            text: cleanText,
            simplifiedText
        };
    }

    /**
     * Identify template/cast angle bracket pairs `<...>` (e.g. `static_cast<int>(...)`, `Create<double>(...)`)
     * so they format tightly instead of getting relational comparison spaces.
     */
    findTemplateAngleIndices(tokens) {
        const anglePairs = new Set();
        const castWords = new Set(['static_cast', 'dynamic_cast', 'const_cast', 'reinterpret_cast']);
        for (let i = 0; i < tokens.length; i++) {
            if (tokens[i].value !== '<') continue;
            const prev = i > 0 ? tokens[i - 1] : null;
            if (!prev || prev.type !== 'IDENTIFIER') continue;

            const isCast = castWords.has(prev.value);
            let depth = 1;
            let closeIdx = -1;
            let validTemplateContent = true;
            for (let j = i + 1; j < tokens.length; j++) {
                const v = tokens[j].value;
                if (v === '<') depth++;
                else if (v === '>') {
                    depth--;
                    if (depth === 0) {
                        closeIdx = j;
                        break;
                    }
                } else if ([';', '{', '}', '=', '&&', '||', '==', '!=', '<=', '>='].includes(v)) {
                    validTemplateContent = false;
                    break;
                }
            }
            if (!validTemplateContent || closeIdx === -1) continue;
            const afterClose = tokens[closeIdx + 1];
            const looksLikeTypeArg = isCast || (afterClose && afterClose.value === '(' && (
                CPP_TYPE_WORDS.has(tokens[i + 1]?.value) ||
                (closeIdx === i + 2 && tokens[i + 1]?.type === 'IDENTIFIER' && /^[A-Z]/.test(tokens[i + 1].value))
            ));
            if (looksLikeTypeArg) {
                anglePairs.add(i);
                anglePairs.add(closeIdx);
            }
        }
        return anglePairs;
    }

    formatExpression(tokens) {
        const templateAngles = this.findTemplateAngleIndices(tokens);
        let res = '';
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            const next = i + 1 < tokens.length ? tokens[i + 1] : null;
            const prev = i > 0 ? tokens[i - 1] : null;

            res += t.value;

            if (next) {
                // Tight scope/member/template operators
                if (t.value === '::' || next.value === '::' || t.value === '.' || next.value === '.' || t.value === '->' || next.value === '->') {
                    continue;
                }
                if (templateAngles.has(i) || templateAngles.has(i + 1)) {
                    continue;
                }
                // Keep increment/decrement tight: i++ or ++i
                if (t.value === '++' || t.value === '--' || next.value === '++' || next.value === '--') {
                    continue;
                }
                // No space before opening paren '(' for identifiers
                if (t.type === 'IDENTIFIER' && next.value === '(') {
                    continue;
                }
                // No space after '(' or '[' or before ')' or ']'
                if (t.value === '(' || next.value === ')' || t.value === '[' || next.value === ']') {
                    continue;
                }
                // delete[] ptr
                if (t.value === ']' && next.type === 'IDENTIFIER') {
                    res += ' ';
                    continue;
                }
                // Unary operators (-, +, !, *, &)
                if (['-', '+', '!'].includes(t.value)) {
                    const isUnary = !prev || ['(', '[', ',', ';', '=', '+=', '-=', '*=', '/=', '%=', '&&', '||', '<', '>', '<=', '>=', '==', '!=', '?', ':'].includes(prev.value);
                    if (isUnary) {
                        continue;
                    }
                }
                // Logical operators
                if (['&&', '||'].includes(t.value) || ['&&', '||'].includes(next.value)) {
                    res += ' ';
                }
                // Relational comparisons (<=, >=, ==, !=, <, >)
                else if (['<=', '>=', '==', '!=', '<', '>'].includes(t.value) || ['<=', '>=', '==', '!=', '<', '>'].includes(next.value)) {
                    res += ' ';
                }
                // Assignment operators
                else if (['=', '+=', '-=', '*=', '/=', '%='].includes(t.value) || ['=', '+=', '-=', '*=', '/=', '%='].includes(next.value)) {
                    res += ' ';
                }
                // Basic arithmetic (+, -, *, /, %)
                else if (['+', '-', '*', '/', '%'].includes(t.value) || ['+', '-', '*', '/', '%'].includes(next.value)) {
                    res += ' ';
                }
                // Ternary (? and :)
                else if (t.value === '?' || next.value === '?' || t.value === ':' || next.value === ':') {
                    res += ' ';
                }
                // Stream operators (<<, >>)
                else if (['<<', '>>'].includes(t.value) || ['<<', '>>'].includes(next.value)) {
                    res += ' ';
                }
                // Adjacent identifiers / keywords / numbers / strings
                else if ((t.type === 'IDENTIFIER' || t.type === 'KEYWORD') &&
                         (next.type === 'IDENTIFIER' || next.type === 'KEYWORD' || next.type === 'NUMBER' || next.type === 'STRING')) {
                    res += ' ';
                } else if (t.type === 'STRING' && (next.type === 'IDENTIFIER' || next.type === 'KEYWORD')) {
                    res += ' ';
                } else if (t.value === ',' || t.value === ';') {
                    res += ' ';
                }
            }
        }
        return res;
    }

    cleanStatements(stmts) {
        if (!Array.isArray(stmts)) return stmts;

        // 1. Recursively clean nested control structures
        for (const s of stmts) {
            if (!s) continue;
            if (s.type === 'if') {
                if (s.thenBranch) s.thenBranch = this.cleanStatements(s.thenBranch);
                if (s.elseBranch) s.elseBranch = this.cleanStatements(s.elseBranch);
            } else if (s.type === 'while' || s.type === 'do_while' || s.type === 'do-while' || s.type === 'for') {
                if (s.body) s.body = this.cleanStatements(s.body);
            }
        }

        // 2. Remove prompt outputs that immediately precede an input
        const afterPrompts = [];
        for (let i = 0; i < stmts.length; i++) {
            const curr = stmts[i];
            const next = i + 1 < stmts.length ? stmts[i + 1] : null;

            if (curr && curr.type === 'output' && next && next.type === 'input') {
                const isExplicitResult = /(?:результат|result|відповідь|answer)/i.test(curr.text || curr.raw || '');
                if (curr.isPromptCandidate || !isExplicitResult) {
                    continue;
                }
            }

            if (curr) afterPrompts.push(curr);
        }

        // 2b. Remove dead dummy zero declaration assignments before input/loops if reassigned before read
        const activeStmts = [];
        for (let i = 0; i < afterPrompts.length; i++) {
            const curr = afterPrompts[i];
            if (curr && curr.type === 'process' && curr.isDeclarationAssignment && ['0', '0.0', '0.f', 'NULL', 'nullptr'].includes(curr.expr?.trim())) {
                const targetVar = curr.target;
                if (targetVar) {
                    let isReassignedBeforeRead = false;
                    for (let k = i + 1; k < afterPrompts.length; k++) {
                        const nextS = afterPrompts[k];
                        if (nextS.type === 'input' && nextS.variables && nextS.variables.includes(targetVar)) {
                            isReassignedBeforeRead = true;
                            break;
                        }
                        if (nextS.type === 'while' || nextS.type === 'for' || nextS.type === 'do_while') {
                            const body = nextS.body || [];
                            const reassign = body.some(b => b.type === 'process' && b.target === targetVar && !b.raw?.includes('+=') && !b.raw?.includes('-=') && !b.raw?.includes('*=') && !b.raw?.includes('/='));
                            if (reassign) {
                                isReassignedBeforeRead = true;
                                break;
                            }
                        }
                    }
                    if (isReassignedBeforeRead) {
                        continue;
                    }
                }
            }
            activeStmts.push(curr);
        }

        // 2c. Normalize if-returns without else (canonical in recursion: if (cond) return A; return B;)
        const afterEarlyReturns = [];
        for (let i = 0; i < activeStmts.length; i++) {
            const curr = activeStmts[i];
            if (curr && curr.type === 'if' && (!curr.elseBranch || curr.elseBranch.length === 0)) {
                const thenLast = curr.thenBranch && curr.thenBranch[curr.thenBranch.length - 1];
                if (thenLast && thenLast.type === 'return' && i + 1 < activeStmts.length) {
                    const remaining = activeStmts.slice(i + 1);
                    curr.elseBranch = this.cleanStatements(remaining);
                    afterEarlyReturns.push(curr);
                    break;
                }
            }
            afterEarlyReturns.push(curr);
        }

        // 3. Merge consecutive input statements into a single input node
        const merged = [];
        let i = 0;
        while (i < afterEarlyReturns.length) {
            const curr = afterEarlyReturns[i];
            if (curr.type === 'input') {
                const combinedVars = [];
                if (curr.variables && curr.variables.length > 0) {
                    combinedVars.push(...curr.variables);
                } else if (curr.text) {
                    combinedVars.push(...curr.text.split(',').map(s => s.trim()).filter(Boolean));
                }

                let j = i + 1;
                while (j < afterEarlyReturns.length && afterEarlyReturns[j].type === 'input') {
                    const nextInput = afterEarlyReturns[j];
                    if (nextInput.variables && nextInput.variables.length > 0) {
                        combinedVars.push(...nextInput.variables);
                    } else if (nextInput.text) {
                        combinedVars.push(...nextInput.text.split(',').map(s => s.trim()).filter(Boolean));
                    }
                    j++;
                }

                if (j === i + 1) {
                    merged.push(curr);
                } else {
                    const varList = combinedVars.join(', ');
                    merged.push({
                        type: 'input',
                        raw: `cin >> ${combinedVars.join(' >> ')};`,
                        variables: combinedVars,
                        text: varList,
                        umlText: `ввід ${varList}`
                    });
                }
                i = j;
            } else {
                merged.push(curr);
                i++;
            }
        }

        return merged;
    }
}

/* ============================================================================
 * Multi-File / Multi-Module Project Resolution & Dependency Analysis
 * ========================================================================== */

function splitFilePath(fileName) {
    const normalized = String(fileName || 'main.cpp').replace(/\\/g, '/');
    const slashIdx = normalized.lastIndexOf('/');
    const dir = slashIdx !== -1 ? normalized.slice(0, slashIdx) : '';
    const base = slashIdx !== -1 ? normalized.slice(slashIdx + 1) : normalized;
    const dotIdx = base.lastIndexOf('.');
    const stem = dotIdx !== -1 ? base.slice(0, dotIdx) : base;
    const ext = dotIdx !== -1 ? base.slice(dotIdx).toLowerCase() : '';
    return { normalized, dir, base, stem, ext };
}

function resolveIncludeFile(fromFileName, rawTarget, projectFileNames) {
    const cleanTarget = String(rawTarget || '').replace(/\\/g, '/').replace(/^\.\//, '');
    if (!cleanTarget) return null;

    if (projectFileNames.includes(cleanTarget)) return cleanTarget;

    const fromDir = splitFilePath(fromFileName).dir;
    if (fromDir) {
        const joined = `${fromDir}/${cleanTarget}`;
        if (projectFileNames.includes(joined)) return joined;
    }

    const targetBase = splitFilePath(cleanTarget).base;
    const baseMatch = projectFileNames.find(name => splitFilePath(name).base === targetBase);
    return baseMatch || null;
}

/**
 * Collect all transitive included header filenames for `startFile`.
 */
function getTransitiveHeaders(startFile, includesList) {
    const visited = new Set();
    const queue = [startFile];
    while (queue.length > 0) {
        const cur = queue.shift();
        for (const inc of includesList) {
            if (inc.fromFile === cur && inc.toFile && !visited.has(inc.toFile)) {
                visited.add(inc.toFile);
                queue.push(inc.toFile);
            }
        }
    }
    return Array.from(visited);
}

/**
 * Resolve a call identifier (qualified or unqualified) to a project function.
 */
function resolveProjectFunction(calleeChain, hasTemplateArgs, callerFn, fileSummary, allFunctions) {
    const isQualified = calleeChain.includes('::');
    const shortName = isQualified ? calleeChain.split('::').pop() : calleeChain;

    const matchesTemplatePref = (fn) => {
        if (hasTemplateArgs) return fn.isTemplate;
        return !fn.isTemplate;
    };

    const pickBest = (candidates) => {
        if (!candidates || candidates.length === 0) return null;
        const impls = candidates.filter(f => !f.isDeclaration);
        const pool = impls.length > 0 ? impls : candidates;
        const exactTmpl = pool.filter(matchesTemplatePref);
        if (exactTmpl.length > 0) return exactTmpl[0];
        return pool[0];
    };

    if (isQualified) {
        const exact = allFunctions.filter(f =>
            f.qualifiedName === calleeChain ||
            (f.namespace && `${f.namespace}::${f.baseName}` === calleeChain)
        );
        return pickBest(exact);
    }

    // 1. Same namespace as caller
    if (callerFn.namespace) {
        const sameNs = allFunctions.filter(f => f.namespace === callerFn.namespace && f.baseName === shortName);
        const hit = pickBest(sameNs);
        if (hit) return hit;
    }

    // 2. Explicit `using ns::fn;` declaration in file
    if (fileSummary.usingDeclarations && fileSummary.usingDeclarations.has(shortName)) {
        const targetQual = fileSummary.usingDeclarations.get(shortName);
        const hit = pickBest(allFunctions.filter(f => f.qualifiedName === targetQual || `${f.namespace}::${f.baseName}` === targetQual));
        if (hit) return hit;
    }

    // 3. `using namespace ns;` in file
    if (fileSummary.usingNamespaces && fileSummary.usingNamespaces.length > 0) {
        for (const ns of fileSummary.usingNamespaces) {
            if (ns === 'std') continue;
            const nsMatches = allFunctions.filter(f => f.namespace === ns && f.baseName === shortName);
            const hit = pickBest(nsMatches);
            if (hit) return hit;
        }
    }

    // 4. Same file (global or matching name)
    const sameFile = allFunctions.filter(f => f.file === callerFn.file && f.baseName === shortName);
    const sameFileHit = pickBest(sameFile);
    if (sameFileHit) return sameFileHit;

    // 5. Global namespace across project
    const globalNs = allFunctions.filter(f => !f.namespace && f.baseName === shortName);
    const globalHit = pickBest(globalNs);
    if (globalHit) return globalHit;

    // 6. Unambiguous match across any namespace in project
    const anyMatch = allFunctions.filter(f => f.baseName === shortName);
    return pickBest(anyMatch);
}

/**
 * Inspect a token array for user function calls, stdlib calls, and header macro usages.
 */
function scanTokensForCallsAndMacros({
    tokens,
    callerFn,
    fileSummary,
    allFunctions,
    visibleMacrosMap
}) {
    const userCalls = [];
    const stdCalls = [];
    const macroHits = [];

    const scanList = (tokList) => {
        for (let i = 0; i < tokList.length; i++) {
            const tok = tokList[i];
            if (tok.type === 'DIRECTIVE') {
                if (['if', 'elif', 'ifdef', 'ifndef'].includes(tok.directiveKind) && tok.condition) {
                    const condToks = new CppTokenizer(tok.condition).tokenize();
                    scanList(condToks);
                }
                continue;
            }
            if (tok.type !== 'IDENTIFIER') continue;

            const prev = i > 0 ? tokList[i - 1] : null;
            const next = i + 1 < tokList.length ? tokList[i + 1] : null;

            // Member method calls: obj.method(...) or ptr->method(...)
            if (prev && (prev.value === '.' || prev.value === '->')) {
                if (next && next.value === '(') {
                    const objName = i >= 2 ? tokList[i - 2]?.value : '';
                    if (objName === 'cin' && tok.value === 'getline') {
                        stdCalls.push({ name: 'cin.getline', qualified: 'std::cin.getline', header: '<iostream>' });
                    } else if (STRING_MEMBER_METHODS.has(tok.value)) {
                        stdCalls.push({ name: `string::${tok.value}`, qualified: `std::string::${tok.value}`, header: '<string>' });
                    }
                }
                continue;
            }

            // Skip namespace prefix identifiers when followed by '::' (handled at final name)
            if (next && next.value === '::') continue;

            // Build qualified name if preceded by `ns::`
            let qIdx = i;
            const qParts = [tok.value];
            while (qIdx >= 2 && tokList[qIdx - 1]?.value === '::' && tokList[qIdx - 2]?.type === 'IDENTIFIER') {
                qParts.unshift(tokList[qIdx - 2].value);
                qIdx -= 2;
            }
            const calleeChain = qParts.join('::');
            const isQualified = qParts.length > 1;

            // Check optional `<templateArgs>` followed by `(`
            let afterIdx = i + 1;
            let hasTemplateArgs = false;
            if (tokList[afterIdx]?.value === '<') {
                let aDepth = 1;
                let scan = afterIdx + 1;
                while (scan < tokList.length && aDepth > 0) {
                    const v = tokList[scan].value;
                    if (v === '<') aDepth++;
                    else if (v === '>') aDepth--;
                    else if ([';', '{', '}', '&&', '||'].includes(v)) {
                        scan = -1;
                        break;
                    }
                    scan++;
                }
                if (scan !== -1 && aDepth === 0 && tokList[scan]?.value === '(') {
                    hasTemplateArgs = true;
                    afterIdx = scan;
                }
            }

            const isCallExpr = tokList[afterIdx]?.value === '(';

            // 1. Check visible header macros (unqualified only, not shadowed by local var/param)
            if (!isQualified && visibleMacrosMap.has(tok.value) && !(callerFn.localVarNames && callerFn.localVarNames.has(tok.value))) {
                const mInfo = visibleMacrosMap.get(tok.value);
                if (mInfo.params !== null) {
                    if (isCallExpr) {
                        macroHits.push({ macroName: mInfo.name, toHeader: mInfo.toHeader });
                    }
                    // Function-like macro handled; skip treating it as a function call
                    if (isCallExpr) continue;
                } else {
                    macroHits.push({ macroName: mInfo.name, toHeader: mInfo.toHeader });
                    continue;
                }
            }

            if (!isCallExpr) continue;
            if (CPP_CONTROL_KEYWORDS.has(tok.value)) continue;

            // 2. Check user-defined project functions (skip `std::...`)
            if (qParts[0] !== 'std') {
                const targetFn = resolveProjectFunction(calleeChain, hasTemplateArgs, callerFn, fileSummary, allFunctions);
                if (targetFn) {
                    userCalls.push(targetFn);
                    continue;
                }
            }

            // 3. Check standard library functions
            const shortName = qParts[qParts.length - 1];
            if (STDLIB_FUNCTION_HEADERS[shortName]) {
                stdCalls.push({
                    name: shortName,
                    qualified: `std::${shortName}`,
                    header: STDLIB_FUNCTION_HEADERS[shortName]
                });
            }
        }
    };

    scanList(tokens);
    return { userCalls, stdCalls, macroHits };
}

/**
 * Tag AST statement nodes recursively with call & macro metadata and deterministic IDs.
 */
function tagAstStatements(stmtsList, callerFn, fileSummary, allFunctions, visibleMacrosMap, prefix = 'node') {
    if (!Array.isArray(stmtsList)) return;

    stmtsList.forEach((s, idx) => {
        if (!s) return;
        const safeCaller = (callerFn.qualifiedName || callerFn.name || 'global').replace(/[^a-zA-Z0-9_]/g, '_');
        const nodeId = `${prefix}_${safeCaller}_${idx}`;
        if (!s.id) s.id = nodeId;
        if (!s.calledFunctions) s.calledFunctions = new Set();

        const snippets = [s.text, s.raw, s.expr, s.value, s.condition, s.init, s.step]
            .filter(Boolean)
            .join(' ');
        if (snippets) {
            const toks = new CppTokenizer(snippets).tokenize();
            const { userCalls, macroHits } = scanTokensForCallsAndMacros({
                tokens: toks,
                callerFn,
                fileSummary,
                allFunctions,
                visibleMacrosMap
            });

            for (const targetFn of userCalls) {
                s.isFunctionCall = true;
                s.isPredefined = true;
                s.calledFunction = targetFn.name;
                s.calledQualified = targetFn.qualifiedName;
                s.calledFile = targetFn.file;
                s.calledFunctions.add(targetFn.name);
                if (targetFn.qualifiedName === callerFn.qualifiedName && targetFn.file === callerFn.file) {
                    s.isRecursive = true;
                }
            }

            if (macroHits.length > 0) {
                s.macroCalls = Array.from(new Set(macroHits.map(m => m.macroName)));
            }
        }

        if (s.thenBranch) tagAstStatements(s.thenBranch, callerFn, fileSummary, allFunctions, visibleMacrosMap, `${nodeId}_then`);
        if (s.elseBranch) tagAstStatements(s.elseBranch, callerFn, fileSummary, allFunctions, visibleMacrosMap, `${nodeId}_else`);
        if (s.body) tagAstStatements(s.body, callerFn, fileSummary, allFunctions, visibleMacrosMap, `${nodeId}_body`);
    });
}

function selectActiveFunction(functionsPool, targetFunction) {
    if (!functionsPool || functionsPool.length === 0) return null;
    if (!targetFunction) {
        return functionsPool.find(f => f.isMain) || functionsPool[0];
    }

    const rawTarget = String(targetFunction).trim();
    const norm = rawTarget.replace(/\s*::\s*/g, '::');
    const stripParens = (v) => v.replace(/\([^)]*\)$/, '').trim();
    const bareTarget = stripParens(rawTarget);
    const bareNorm = stripParens(norm);

    return (
        functionsPool.find(f => f.label === rawTarget) ||
        functionsPool.find(f => `${f.file}::${f.qualifiedName}` === norm || `${f.file}::${f.qualifiedSignature}` === norm) ||
        functionsPool.find(f => `${f.file}::${f.name}` === norm || `${f.file}::${f.signature}` === norm) ||
        functionsPool.find(f => f.qualifiedSignature === rawTarget || f.qualifiedSignature === norm) ||
        functionsPool.find(f => f.signature === rawTarget) ||
        functionsPool.find(f => f.qualifiedName === rawTarget || f.qualifiedName === norm) ||
        functionsPool.find(f => f.name === rawTarget || f.baseName === rawTarget) ||
        functionsPool.find(f => stripParens(f.label) === bareTarget || `${f.file}::${f.qualifiedName}` === bareNorm || f.qualifiedName === bareNorm || f.name === bareTarget) ||
        functionsPool.find(f => f.isMain) ||
        functionsPool[0]
    );
}

/**
 * Assemble complete project metadata, call graph, macro usages, and final AST result array.
 */
function assembleProjectResult(fileSummaries, isMultiFile, options = {}) {
    const projectFileNames = fileSummaries.map(f => f.fileName);

    // 1. Build project include graph
    const projectIncludes = [];
    for (const fs of fileSummaries) {
        for (const inc of fs.includes) {
            const toFile = resolveIncludeFile(fs.fileName, inc.target, projectFileNames);
            projectIncludes.push({
                fromFile: fs.fileName,
                toFile,
                rawTarget: inc.target,
                isLocal: inc.isLocal
            });
        }
    }

    // 2. Collect all parsed functions across files, excluding forward declarations when an implementation exists
    const allParsedFunctions = fileSummaries.flatMap(fs => fs.functions);
    const implementedKeys = new Set();
    allParsedFunctions.forEach(f => {
        if (!f.isDeclaration) {
            implementedKeys.add(f.qualifiedName);
            implementedKeys.add(`${f.namespace || ''}::${f.baseName}`);
            implementedKeys.add(f.name);
        }
    });

    const activeFunctions = allParsedFunctions.filter(f => {
        if (!f.isDeclaration) return true;
        return !implementedKeys.has(f.qualifiedName) &&
               !implementedKeys.has(`${f.namespace || ''}::${f.baseName}`) &&
               !implementedKeys.has(f.name);
    });

    // Assign human-readable labels
    activeFunctions.forEach(f => {
        f.label = isMultiFile
            ? `${f.file} :: ${f.qualifiedSignature}`
            : f.qualifiedSignature;
    });

    // 3. Map header macros by file for macroUsages detection
    const macrosByFile = new Map();
    for (const fs of fileSummaries) {
        const meta = splitFilePath(fs.fileName);
        const isHeader = HEADER_EXTENSIONS.has(meta.ext);
        macrosByFile.set(fs.fileName, { isHeader, macros: fs.macros });
    }

    const getVisibleMacrosForFile = (fileName) => {
        const visible = new Map();
        const transitiveHeaders = getTransitiveHeaders(fileName, projectIncludes);
        for (const hFile of transitiveHeaders) {
            const info = macrosByFile.get(hFile);
            if (!info) continue;
            for (const m of info.macros) {
                visible.set(m.name, { ...m, toHeader: hFile });
            }
        }
        return visible;
    };

    // 4. Tag AST statements, build cross-file callGraph and macroUsages
    const callGraph = [];
    const callEdgeKeys = new Set();
    const macroUsages = [];
    const macroUsageKeys = new Set();

    const fileSummaryMap = new Map(fileSummaries.map(fs => [fs.fileName, fs]));

    for (const fn of activeFunctions) {
        const fileSummary = fileSummaryMap.get(fn.file);
        const visibleMacrosMap = getVisibleMacrosForFile(fn.file);

        if (fn.body && fn.body.length > 0) {
            tagAstStatements(fn.body, fn, fileSummary, activeFunctions, visibleMacrosMap);
        }

        const scanToks = fn.rawBodyTokens && fn.rawBodyTokens.length > 0 ? fn.rawBodyTokens : [];
        const { userCalls, stdCalls, macroHits } = scanTokensForCallsAndMacros({
            tokens: scanToks,
            callerFn: fn,
            fileSummary,
            allFunctions: activeFunctions,
            visibleMacrosMap
        });

        for (const targetFn of userCalls) {
            const edgeKey = `${fn.qualifiedName}@${fn.file}->${targetFn.qualifiedName}@${targetFn.file}`;
            if (!callEdgeKeys.has(edgeKey)) {
                callEdgeKeys.add(edgeKey);
                callGraph.push({
                    from: fn.name,
                    fromQualified: fn.qualifiedName,
                    fromFile: fn.file,
                    to: targetFn.name,
                    toQualified: targetFn.qualifiedName,
                    toFile: targetFn.file,
                    isRecursive: fn.qualifiedName === targetFn.qualifiedName && fn.file === targetFn.file,
                    isStdLib: false
                });
            }
        }

        for (const stdCall of stdCalls) {
            const edgeKey = `${fn.qualifiedName}@${fn.file}->${stdCall.qualified}@${stdCall.header}`;
            if (!callEdgeKeys.has(edgeKey)) {
                callEdgeKeys.add(edgeKey);
                callGraph.push({
                    from: fn.name,
                    fromQualified: fn.qualifiedName,
                    fromFile: fn.file,
                    to: stdCall.name,
                    toQualified: stdCall.qualified,
                    toFile: stdCall.header,
                    isRecursive: false,
                    isStdLib: true
                });
            }
        }

        for (const hit of macroHits) {
            const mKey = `${fn.qualifiedName}@${fn.file}->${hit.toHeader}:${hit.macroName}`;
            if (!macroUsageKeys.has(mKey)) {
                macroUsageKeys.add(mKey);
                macroUsages.push({
                    fromFunction: fn.name,
                    fromQualified: fn.qualifiedName,
                    fromFile: fn.file,
                    toHeader: hit.toHeader,
                    macroName: hit.macroName
                });
            }
        }
    }

    // Tag snippet globalStmts if no functions exist
    if (activeFunctions.length === 0) {
        for (const fs of fileSummaries) {
            if (fs.globalStmts && fs.globalStmts.length > 0) {
                const dummyCaller = { name: 'global', qualifiedName: 'global', file: fs.fileName, namespace: null, localVarNames: new Set() };
                tagAstStatements(fs.globalStmts, dummyCaller, fs, activeFunctions, getVisibleMacrosForFile(fs.file));
            }
        }
    }

    // 5. Build structured `files` metadata
    const filesMeta = fileSummaries.map(fs => {
        const meta = splitFilePath(fs.fileName);
        return {
            name: fs.fileName,
            stem: meta.stem,
            ext: meta.ext,
            moduleName: meta.stem,
            isHeader: HEADER_EXTENSIONS.has(meta.ext),
            includes: fs.includes.map(i => i.target),
            namespaces: [...fs.namespaces],
            usingNamespaces: [...fs.usingNamespaces],
            macros: fs.macros.map(m => ({ ...m })),
            globals: fs.globals.map(g => ({ ...g })),
            functions: fs.functions.map(fn => ({
                name: fn.name,
                qualifiedName: fn.qualifiedName,
                signature: fn.signature,
                qualifiedSignature: fn.qualifiedSignature,
                namespace: fn.namespace,
                file: fn.file,
                isMain: fn.isMain,
                isDeclaration: fn.isDeclaration,
                isTemplate: fn.isTemplate
            }))
        };
    });

    // 6. Group files into `modules` (paired .h + .cpp sharing same directory+stem, plus standalone files)
    const moduleGroupMap = new Map();
    for (const fm of filesMeta) {
        const meta = splitFilePath(fm.name);
        const groupKey = meta.dir ? `${meta.dir}/${meta.stem}` : meta.stem;
        if (!moduleGroupMap.has(groupKey)) {
            moduleGroupMap.set(groupKey, {
                name: meta.stem,
                headerFile: null,
                sourceFile: null,
                files: [],
                isPaired: false,
                namespaces: [],
                macros: [],
                globals: [],
                functions: []
            });
        }
        const mod = moduleGroupMap.get(groupKey);
        mod.files.push(fm.name);
        if (HEADER_EXTENSIONS.has(meta.ext) && !mod.headerFile) {
            mod.headerFile = fm.name;
        } else if (SOURCE_EXTENSIONS.has(meta.ext) && !mod.sourceFile) {
            mod.sourceFile = fm.name;
        }
        for (const ns of fm.namespaces) {
            if (!mod.namespaces.includes(ns)) mod.namespaces.push(ns);
        }
        mod.macros.push(...fm.macros);
        mod.globals.push(...fm.globals);
        mod.functions.push(...fm.functions.filter(f => !f.isDeclaration));
    }

    const modules = Array.from(moduleGroupMap.values()).map(mod => {
        mod.isPaired = Boolean(mod.headerFile && mod.sourceFile);
        const dedupGlobals = new Map();
        for (const g of mod.globals) {
            const key = `${g.namespace || ''}::${g.name}`;
            const prev = dedupGlobals.get(key);
            if (!prev || (prev.isExtern && !g.isExtern)) {
                dedupGlobals.set(key, g);
            }
        }
        mod.globals = Array.from(dedupGlobals.values());
        return mod;
    });

    // 7. Select active target function AST
    const activeFunc = selectActiveFunction(activeFunctions, options.targetFunction);
    const fallbackGlobalStmts = fileSummaries.flatMap(fs => fs.globalStmts || []);
    const resultStmts = activeFunc ? activeFunc.body : fallbackGlobalStmts;

    // 8. Attach full backward-compatible + multi-module metadata onto resultStmts
    resultStmts.isMultiFile = Boolean(isMultiFile);
    resultStmts.functions = activeFunctions.map(f => ({
        name: f.name,
        qualifiedName: f.qualifiedName,
        signature: f.signature,
        qualifiedSignature: f.qualifiedSignature,
        file: f.file,
        namespace: f.namespace,
        isMain: f.isMain,
        isTemplate: f.isTemplate,
        label: f.label
    }));
    resultStmts.allFunctions = activeFunctions;
    resultStmts.functionName = activeFunc ? activeFunc.name : 'main';
    resultStmts.functionQualifiedName = activeFunc ? activeFunc.qualifiedName : 'main';
    resultStmts.functionSignature = activeFunc ? activeFunc.qualifiedSignature : 'main()';
    resultStmts.functionFile = activeFunc ? activeFunc.file : (filesMeta[0]?.name || 'main.cpp');
    resultStmts.functionLabel = activeFunc ? activeFunc.label : 'main()';
    resultStmts.isMain = activeFunc ? activeFunc.isMain : true;
    resultStmts.files = filesMeta;
    resultStmts.modules = modules;
    resultStmts.includes = projectIncludes;
    resultStmts.callGraph = callGraph;
    resultStmts.macroUsages = macroUsages;

    return resultStmts;
}

function finalizeSingleFileResult(fileSummary, options = {}) {
    return assembleProjectResult([fileSummary], false, options);
}

/**
 * Multi-file / Multi-module C++ Project Parser
 * @param {Array<{ name: string, content: string }>} files
 * @param {object} options
 */
function parseCppProject(files, options = {}) {
    const inputFiles = Array.isArray(files) && files.length > 0
        ? files.map((f, idx) => ({
            name: String(f?.name || `file_${idx + 1}.cpp`),
            content: String(f?.content ?? '')
        }))
        : [{ name: 'main.cpp', content: '' }];

    const isMultiFile = inputFiles.length > 1;
    const projectFileNames = inputFiles.map(f => f.name);

    // Pre-tokenize all files so #include directives can evaluate/import macros from header files
    const tokenizedByFile = new Map();
    for (const f of inputFiles) {
        const toks = new CppTokenizer(f.content).tokenize();
        tokenizedByFile.set(f.name, toks);
    }

    const resolveIncludeMacros = (fromFile, visitedHeaders = new Set()) => (target, _isLocal, callerMacros) => {
        const resolved = resolveIncludeFile(fromFile, target, projectFileNames);
        if (!resolved || visitedHeaders.has(resolved)) return null;

        visitedHeaders.add(resolved);
        const headerTokens = tokenizedByFile.get(resolved);
        if (!headerTokens) return null;

        const headerParser = new CppParser(headerTokens, {
            ...options,
            fileName: resolved,
            definedMacros: new Map(callerMacros || []),
            resolveInclude: resolveIncludeMacros(resolved, visitedHeaders),
            deferDependencyResolution: true
        });
        const headerSummary = headerParser.parse();
        return headerSummary.definedMacros;
    };

    const fileSummaries = inputFiles.map(f => {
        const toks = tokenizedByFile.get(f.name) || [];
        const parser = new CppParser(toks, {
            ...options,
            fileName: f.name,
            resolveInclude: resolveIncludeMacros(f.name, new Set([f.name])),
            deferDependencyResolution: true
        });
        return parser.parse();
    });

    return assembleProjectResult(fileSummaries, isMultiFile, options);
}

/**
 * High-level parser function (supports both single-file C++ string and multi-file array)
 */
function parseCppCode(source, options = {}) {
    if (Array.isArray(source)) {
        return parseCppProject(source, options);
    }
    const fileName = options.fileName || 'main.cpp';
    const lexer = new CppTokenizer(source || '');
    const tokens = lexer.tokenize();
    const parser = new CppParser(tokens, { ...options, fileName });
    return parser.parse();
}

export { CppTokenizer, CppParser, parseCppCode, parseCppProject };
export default parseCppCode;
