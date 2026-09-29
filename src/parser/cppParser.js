/**
 * C++ Lexer and AST Parser for Algorithm Flowcharts & UML Activity Diagrams
 * Tailored for university programming courses and labs.
 */

class CppTokenizer {
    constructor(source) {
        this.source = source;
        this.pos = 0;
        this.len = source.length;
    }

    tokenize() {
        const tokens = [];
        while (this.pos < this.len) {
            this.skipWhitespace();
            if (this.pos >= this.len) break;

            const char = this.source[this.pos];
            const nextChar = this.pos + 1 < this.len ? this.source[this.pos + 1] : '';

            // Comments
            if (char === '/' && nextChar === '/') {
                const start = this.pos;
                this.pos += 2;
                while (this.pos < this.len && this.source[this.pos] !== '\n') {
                    this.pos++;
                }
                const text = this.source.slice(start, this.pos).trim();
                tokens.push({ type: 'COMMENT', value: text });
                continue;
            }

            if (char === '/' && nextChar === '*') {
                const start = this.pos;
                this.pos += 2;
                while (this.pos < this.len && !(this.source[this.pos] === '*' && this.source[this.pos + 1] === '/')) {
                    this.pos++;
                }
                this.pos += 2;
                const text = this.source.slice(start, this.pos).trim();
                tokens.push({ type: 'COMMENT_BLOCK', value: text });
                continue;
            }

            // Preprocessor directives (#include, #define)
            if (char === '#') {
                const start = this.pos;
                while (this.pos < this.len && this.source[this.pos] !== '\n') {
                    this.pos++;
                }
                const text = this.source.slice(start, this.pos).trim();
                tokens.push({ type: 'DIRECTIVE', value: text });
                continue;
            }

            // String literals
            if (char === '"' || char === '\'') {
                const quote = char;
                const start = this.pos;
                this.pos++;
                let escaped = false;
                while (this.pos < this.len) {
                    if (escaped) {
                        escaped = false;
                        this.pos++;
                        continue;
                    }
                    if (this.source[this.pos] === '\\') {
                        escaped = true;
                        this.pos++;
                        continue;
                    }
                    if (this.source[this.pos] === quote) {
                        this.pos++;
                        break;
                    }
                    this.pos++;
                }
                tokens.push({ type: 'STRING', value: this.source.slice(start, this.pos) });
                continue;
            }

            // Numbers
            if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(nextChar))) {
                const start = this.pos;
                while (this.pos < this.len && /[0-9a-zA-Z._]/.test(this.source[this.pos])) {
                    this.pos++;
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

            // Multi-char operators
            const twoChar = char + nextChar;
            if (['<<', '>>', '==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/='].includes(twoChar)) {
                tokens.push({ type: 'OPERATOR', value: twoChar });
                this.pos += 2;
                continue;
            }

            // Single char symbols
            tokens.push({ type: 'SYMBOL', value: char });
            this.pos++;
        }

        return tokens;
    }

    skipWhitespace() {
        while (this.pos < this.len && /\s/.test(this.source[this.pos])) {
            this.pos++;
        }
    }
}

class CppParser {
    constructor(tokens, options = {}) {
        this.tokens = tokens.filter(t => t.type !== 'COMMENT' && t.type !== 'COMMENT_BLOCK' && t.type !== 'DIRECTIVE');
        this.pos = 0;
        this.options = Object.assign({
            simplifyExpressions: false, // Convert x*x -> вираз_A, sin(x) -> вираз_1 etc.
            showDeclarations: false,    // Include variable declaration blocks
            expressionStyle: 'original' // 'original' or 'lecture'
        }, options);
        this.exprCounter = 1;
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

    parse() {
        this.skipUsings();
        const stmts = this.parseProgram();
        return this.cleanStatements(stmts);
    }

    skipUsings() {
        while (this.pos < this.tokens.length) {
            if (this.match('IDENTIFIER', 'using')) {
                while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) {
                    this.consume();
                }
                if (this.match('SYMBOL', ';')) this.consume();
            } else {
                break;
            }
        }
    }

    parseProgram() {
        const statements = [];
        this.exprMap = new Map(); // expr -> index

        while (this.pos < this.tokens.length) {
            if (this.isFunctionHeader()) {
                const funcStmts = this.parseFunction();
                statements.push(...funcStmts);
            } else {
                const stmt = this.parseStatement();
                if (stmt) {
                    if (Array.isArray(stmt)) {
                        statements.push(...stmt);
                    } else {
                        statements.push(stmt);
                    }
                }
            }
        }

        return statements;
    }

    isFunctionHeader() {
        let idx = this.pos;
        const types = ['int', 'void', 'double', 'float', 'char', 'bool', 'auto', 'long'];
        if (idx < this.tokens.length && types.includes(this.tokens[idx].value)) {
            idx++;
            if (idx < this.tokens.length && this.tokens[idx].type === 'IDENTIFIER') {
                idx++;
                if (idx < this.tokens.length && this.tokens[idx].value === '(') {
                    return true;
                }
            }
        }
        return false;
    }

    parseFunction() {
        this.consume(); // type
        this.consume(); // name

        this.expect('SYMBOL', '(');
        while (this.pos < this.tokens.length && !this.match('SYMBOL', ')')) {
            this.consume();
        }
        this.expect('SYMBOL', ')');

        if (this.match('SYMBOL', '{')) {
            return this.parseBlock();
        }
        return [];
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
        this.expect('SYMBOL', '}');
        return stmts;
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

        // cin.get() or system("pause") / getch() - skip helper
        if (t.type === 'IDENTIFIER' && (t.value === 'cin' || ['system', 'getch', '_getch'].includes(t.value))) {
            if (t.value === 'cin' && this.peek(1)?.value === '.' && this.peek(2)?.value === 'get') {
                while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) this.consume();
                if (this.match('SYMBOL', ';')) this.consume();
                return null;
            } else if (t.value !== 'cin') {
                while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) this.consume();
                if (this.match('SYMBOL', ';')) this.consume();
                return null;
            }
        }

        // Constants (const / constexpr) - ignore compile-time constant definitions in algorithm diagram
        if (t.type === 'IDENTIFIER' && ['const', 'constexpr'].includes(t.value)) {
            while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) {
                this.consume();
            }
            if (this.match('SYMBOL', ';')) this.consume();
            return null;
        }

        const typeModifiers = ['unsigned', 'signed', 'short', 'static'];
        while (this.pos < this.tokens.length && typeModifiers.includes(this.peek()?.value)) {
            this.consume();
        }

        const types = ['int', 'double', 'float', 'char', 'bool', 'long', 'string', 'auto', 'size_t'];
        const currentToken = this.peek();
        if (currentToken && types.includes(currentToken.value)) {
            return this.parseDeclaration();
        }

        if (t.value === 'cin' || (t.value === 'std' && this.peek(1)?.value === '::' && this.peek(2)?.value === 'cin')) {
            return this.parseCin();
        }

        if (t.value === 'cout' || (t.value === 'std' && this.peek(1)?.value === '::' && this.peek(2)?.value === 'cout')) {
            return this.parseCout();
        }

        return this.parseExpressionStatement();
    }

    parseDeclaration() {
        const typeToken = this.consume();
        const declTokens = [];
        while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) {
            declTokens.push(this.consume());
        }
        if (this.match('SYMBOL', ';')) this.consume();

        const hasAssignment = declTokens.some(t => t.value === '=');
        if (hasAssignment) {
            const formatted = this.formatExpression(declTokens);
            return {
                type: 'process',
                raw: `${typeToken.value} ${formatted};`,
                text: formatted,
                simplifiedText: formatted
            };
        }

        if (this.options.showDeclarations) {
            const vars = declTokens.filter(t => t.type === 'IDENTIFIER').map(t => t.value);
            return {
                type: 'process',
                raw: `${typeToken.value} ${vars.join(', ')};`,
                text: `${typeToken.value} ${vars.join(', ')}`,
                simplifiedText: `${typeToken.value} ${vars.join(', ')}`
            };
        }

        return null;
    }

    parseCin() {
        while (this.peek()?.value === 'std' || this.peek()?.value === '::' || this.peek()?.value === 'cin') {
            this.consume();
        }

        const vars = [];
        while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) {
            if (this.match('OPERATOR', '>>')) {
                this.consume();
                if (this.peek() && this.peek().type === 'IDENTIFIER') {
                    vars.push(this.consume().value);
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
        while (this.peek()?.value === 'std' || this.peek()?.value === '::' || this.peek()?.value === 'cout') {
            this.consume();
        }

        const parts = [];
        let curPart = [];

        while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) {
            if (this.match('OPERATOR', '<<')) {
                this.consume();
                if (curPart.length > 0) {
                    parts.push(curPart);
                    curPart = [];
                }
            } else {
                curPart.push(this.consume());
            }
        }
        if (curPart.length > 0) parts.push(curPart);
        if (this.match('SYMBOL', ';')) this.consume();

        const meaningfulParts = [];
        const vars = [];
        let hasStringOnly = true;

        for (const p of parts) {
            const str = p.map(t => t.value).join('');
            if (str === 'endl' || str === 'std::endl' || str === '"\\n"') {
                continue;
            }
            if (p.length === 1 && p[0].type === 'IDENTIFIER') {
                vars.push(p[0].value);
                meaningfulParts.push(p[0].value);
                hasStringOnly = false;
            } else if (p.length === 1 && p[0].type === 'STRING') {
                meaningfulParts.push(p[0].value);
            } else {
                meaningfulParts.push(p.map(t => t.value).join(' '));
                hasStringOnly = false;
            }
        }

        if (meaningfulParts.length === 0) {
            return null;
        }

        let simpleText = '';
        if (vars.length > 0) {
            simpleText = vars.join(', ');
        } else {
            simpleText = meaningfulParts.join(', ');
        }

        return {
            type: 'output',
            raw: `cout << ...;`,
            text: simpleText,
            umlText: `вивід ${simpleText}`,
            fullText: meaningfulParts.join(' '),
            isPromptCandidate: hasStringOnly
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
            condition: condition,
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
            condition: condition,
            body: body
        };
    }

    parseFor() {
        this.expect('IDENTIFIER', 'for');
        this.expect('SYMBOL', '(');

        const initTokens = [];
        while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) {
            initTokens.push(this.consume());
        }
        this.expect('SYMBOL', ';');

        const condTokens = [];
        while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) {
            condTokens.push(this.consume());
        }
        this.expect('SYMBOL', ';');

        const stepTokens = [];
        while (this.pos < this.tokens.length && !this.match('SYMBOL', ')')) {
            stepTokens.push(this.consume());
        }
        this.expect('SYMBOL', ')');

        let body = null;
        if (this.match('SYMBOL', '{')) {
            body = this.parseBlock();
        } else {
            const s = this.parseStatement();
            body = s ? (Array.isArray(s) ? s : [s]) : [];
        }

        const initStr = this.formatExpression(initTokens.filter(t => !['int', 'double', 'float'].includes(t.value)));
        const condStr = this.formatExpression(condTokens);
        const stepStr = this.formatExpression(stepTokens);

        return {
            type: 'for',
            init: initStr,
            condition: condStr,
            step: stepStr,
            body: body
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
            body: body
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
                this.consume();
                const valTokens = [];
                while (this.pos < this.tokens.length && !this.match('SYMBOL', ':')) {
                    valTokens.push(this.consume());
                }
                if (this.match('SYMBOL', ':')) this.consume();
                const caseVal = this.formatExpression(valTokens);

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
                cases.push({
                    condition: `${switchVar} == ${caseVal}`,
                    thenBranch: caseStmts
                });
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

        for (let i = 0; i < cases.length; i++) {
            const c = cases[i];
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

        return {
            type: 'return',
            raw: `return ${retTokens.map(t => t.value).join(' ')};`
        };
    }

    parseExpressionStatement() {
        const tokens = [];
        while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) {
            tokens.push(this.consume());
        }
        if (this.match('SYMBOL', ';')) this.consume();

        if (tokens.length === 0) return null;

        const exprText = this.formatExpression(tokens);

        const eqIdx = tokens.findIndex(t => t.value === '=');
        let target = '';
        let expr = '';
        let simplifiedText = exprText;

        if (eqIdx > 0) {
            const typeKeywords = ['const', 'constexpr', 'double', 'float', 'int', 'long', 'short', 'auto', 'char', 'bool', 'unsigned', 'signed', 'size_t'];
            const targetTokens = tokens.slice(0, eqIdx).filter(t => !typeKeywords.includes(t.value));
            target = targetTokens.map(t => t.value).join('');
            const exprTokens = tokens.slice(eqIdx + 1);
            expr = exprTokens.map(t => t.value).join('');

            if (target === 'A') {
                simplifiedText = 'A = вираз_A';
            } else if (target === 'B') {
                // Deduplicate expressions! e.g. sin(x) -> вираз_1, exp(x) -> вираз_2, cos(x) -> вираз_3
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
            target: target,
            expr: expr,
            text: cleanText,
            simplifiedText: simplifiedText
        };
    }

    formatExpression(tokens) {
        let res = '';
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            const next = i + 1 < tokens.length ? tokens[i + 1] : null;

            res += t.value;

            if (next) {
                // Keep increment/decrement tight: i++ or ++i
                if (t.value === '++' || t.value === '--' || next.value === '++' || next.value === '--') {
                    continue;
                }
                // No space before opening paren '(' for function calls: atan(1.0), sin(x)
                if (next.value === '(') {
                    continue;
                }
                // No space after opening paren '(' or before closing paren ')'
                if (t.value === '(' || next.value === ')') {
                    continue;
                }
                // Logical operators
                if (['&&', '||'].includes(t.value) || ['&&', '||'].includes(next.value)) {
                    res += ' ';
                }
                // Relational comparisons (<=, >=, ==, !=, <, >)
                else if (['<=', '>=', '==', '!=', '<', '>'].includes(t.value) || ['<=', '>=', '==', '!=', '<', '>'].includes(next.value)) {
                    res += ' ';
                }
                // Assignment operators (=, +=, -=, *=, /=)
                else if (['=', '+=', '-=', '*=', '/='].includes(t.value) || ['=', '+=', '-=', '*=', '/='].includes(next.value)) {
                    res += ' ';
                }
                // Basic arithmetic (+, -, *, /, %)
                else if (['+', '-', '*', '/', '%'].includes(t.value) || ['+', '-', '*', '/', '%'].includes(next.value)) {
                    res += ' ';
                }
                // Delimiters
                else if (t.value === ',' || t.value === ';') {
                    res += ' ';
                }
            }
        }
        return res;
    }

    cleanStatements(stmts) {
        const cleaned = [];
        for (let i = 0; i < stmts.length; i++) {
            const curr = stmts[i];
            const next = i + 1 < stmts.length ? stmts[i + 1] : null;

            // If prompt output is immediately followed by input, skip the prompt output
            if (curr.type === 'output' && curr.isPromptCandidate && next && next.type === 'input') {
                // Merge/skip prompt to match academic Slide 7 diagram
                continue;
            }

            cleaned.push(curr);
        }
        return cleaned;
    }
}

/**
 * High-level parser function
 */
function parseCppCode(source, options = {}) {
    const lexer = new CppTokenizer(source);
    const tokens = lexer.tokenize();
    const parser = new CppParser(tokens, options);
    return parser.parse();
}

export { CppTokenizer, CppParser, parseCppCode };
export default parseCppCode;
