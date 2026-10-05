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
                const splitMatch = text.match(/^\/\/\s*(?:\[\s*(?:split|col|column|connector|page|з'єднувач|з’єднувач|розділ|розрив)(?::\s*([^\]]+))?\s*\]|@(?:split|connector|page)\s*(\S+)?|---\s*(?:split|break)\s*---)/i);
                if (splitMatch) {
                    tokens.push({ type: 'SPLIT_DIRECTIVE', label: (splitMatch[1] || splitMatch[2] || '').trim() || null });
                } else {
                    tokens.push({ type: 'COMMENT', value: text });
                }
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
                const splitMatch = text.match(/^\/\*\s*\[\s*(?:split|col|column|connector|page|з'єднувач|з’єднувач|розділ|розрив)(?::\s*([^\]]+))?\s*\]\s*\*\/$/i);
                if (splitMatch) {
                    tokens.push({ type: 'SPLIT_DIRECTIVE', label: (splitMatch[1] || '').trim() || null });
                } else {
                    tokens.push({ type: 'COMMENT_BLOCK', value: text });
                }
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
        return this.parseProgram();
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

    isFunctionHeader() {
        let idx = this.pos;
        const typeModifiers = ['unsigned', 'signed', 'short', 'long', 'static', 'inline', 'const'];
        while (idx < this.tokens.length && typeModifiers.includes(this.tokens[idx].value)) {
            idx++;
        }
        const types = ['int', 'void', 'double', 'float', 'char', 'bool', 'auto', 'long', 'string', 'size_t'];
        if (idx < this.tokens.length && (types.includes(this.tokens[idx].value) || this.tokens[idx].type === 'IDENTIFIER')) {
            idx++;
            while (idx < this.tokens.length && (this.tokens[idx].value === '*' || this.tokens[idx].value === '&')) {
                idx++;
            }
            if (idx < this.tokens.length && this.tokens[idx].type === 'IDENTIFIER') {
                idx++;
                if (idx < this.tokens.length && this.tokens[idx].value === '(') {
                    return true;
                }
            }
        }
        return false;
    }

    parseFunctionDefinitionOrPrototype() {
        const typeModifiers = ['unsigned', 'signed', 'short', 'long', 'static', 'inline', 'const'];
        const returnTypeTokens = [];
        while (this.pos < this.tokens.length && typeModifiers.includes(this.peek()?.value)) {
            returnTypeTokens.push(this.consume().value);
        }
        if (this.pos < this.tokens.length) {
            returnTypeTokens.push(this.consume().value);
        }
        while (this.pos < this.tokens.length && (this.peek()?.value === '*' || this.peek()?.value === '&')) {
            returnTypeTokens.push(this.consume().value);
        }

        const nameToken = this.consume();
        const funcName = nameToken ? nameToken.value : '';

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

        // Prototype declaration: ends with ';'
        if (this.match('SYMBOL', ';')) {
            this.consume();
            return { isPrototype: true, name: funcName };
        }

        // Function definition with block body: '{ ... }'
        if (this.match('SYMBOL', '{')) {
            const body = this.parseBlock();
            const cleanedBody = this.cleanStatements(body);

            // Extract parameter names for diagram header (e.g. "f(n)", "Create(a, size, Low, High)")
            const paramNames = [];
            for (let i = 0; i < paramTokens.length; i++) {
                const tok = paramTokens[i];
                if (tok.type === 'IDENTIFIER') {
                    const next = paramTokens[i + 1];
                    if (!next || next.value === ',' || next.value === ')') {
                        paramNames.push(tok.value);
                    }
                }
            }
            const sig = paramNames.length > 0 ? `${funcName}(${paramNames.join(', ')})` : `${funcName}()`;

            return {
                name: funcName,
                returnType: returnTypeTokens.join(' '),
                signature: sig,
                isMain: funcName === 'main',
                body: cleanedBody
            };
        }

        return null;
    }

    parseProgram() {
        this.functions = [];
        const globalStmts = [];
        this.exprMap = new Map();

        while (this.pos < this.tokens.length) {
            if (this.isFunctionHeader()) {
                const func = this.parseFunctionDefinitionOrPrototype();
                if (func && !func.isPrototype && func.body) {
                    this.functions.push(func);
                }
            } else {
                const stmt = this.parseStatement();
                if (stmt) {
                    if (Array.isArray(stmt)) {
                        globalStmts.push(...stmt);
                    } else {
                        globalStmts.push(stmt);
                    }
                }
            }
        }

        let activeFunc = null;
        if (this.functions.length > 0) {
            if (this.options.targetFunction) {
                activeFunc = this.functions.find(f => f.name === this.options.targetFunction) || null;
            }
            if (!activeFunc) {
                activeFunc = this.functions.find(f => f.isMain) || this.functions[0];
            }
        }

        const resultStmts = activeFunc ? activeFunc.body : this.cleanStatements(globalStmts);
        resultStmts.functions = this.functions.map(f => ({
            name: f.name,
            signature: f.signature,
            isMain: f.isMain
        }));
        resultStmts.functionName = activeFunc ? activeFunc.name : 'main';
        resultStmts.functionSignature = activeFunc ? activeFunc.signature : 'main()';
        resultStmts.isMain = activeFunc ? activeFunc.isMain : true;

        return resultStmts;
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

        if (t.type === 'SPLIT_DIRECTIVE') {
            this.consume();
            return {
                type: 'split',
                label: t.label || null
            };
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

        // cin helper methods: cin.get(), cin.sync(), cin.ignore(), cin.clear()
        if (t.type === 'IDENTIFIER' && t.value === 'cin' && this.peek(1)?.value === '.') {
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

        if (t.value === 'getline' || (t.value === 'std' && this.peek(1)?.value === '::' && this.peek(2)?.value === 'getline')) {
            return this.parseGetline();
        }

        if (t.value === 'cin' || (t.value === 'std' && this.peek(1)?.value === '::' && this.peek(2)?.value === 'cin')) {
            return this.parseCin();
        }

        if (['cout', 'cerr', 'clog'].includes(t.value) || (t.value === 'std' && this.peek(1)?.value === '::' && ['cout', 'cerr', 'clog'].includes(this.peek(2)?.value))) {
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

        // Split by comma at top-level paren/bracket depth
        const declarators = [];
        let cur = [];
        let parenDepth = 0;
        for (const t of declTokens) {
            if (['(', '{', '['].includes(t.value)) parenDepth++;
            else if ([')', '}', ']'].includes(t.value)) parenDepth--;
            else if (t.value === ',' && parenDepth === 0) {
                if (cur.length > 0) declarators.push(cur);
                cur = [];
                continue;
            }
            cur.push(t);
        }
        if (cur.length > 0) declarators.push(cur);

        const assignments = [];
        for (const decl of declarators) {
            const eqIdx = decl.findIndex(t => t.value === '=');
            if (eqIdx !== -1) {
                const varTokens = decl.slice(0, eqIdx);
                const exprTokens = decl.slice(eqIdx + 1);
                const varName = varTokens.map(t => t.value).join('');
                const exprText = this.formatExpression(exprTokens);
                assignments.push({ varName, exprText, decl });
            }
        }

        if (assignments.length === 0) {
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

        // If declaration mixes uninitialized variables with dummy initializations (e.g. double xp, xk, x, dx, eps, a=0, R=0, S=0),
        // the uninitialized variables prove it is a variable declaration list, and dummy 0 initializations are C++ boilerplate.
        const hasUninitialized = declarators.some(d => !d.some(t => t.value === '='));
        const allDummyZero = assignments.every(a => ['0', '0.0', '0.f', 'NULL', 'nullptr', '""', "''"].includes(a.exprText.trim()));
        if (hasUninitialized && allDummyZero) {
            return null;
        }

        const processNodes = assignments.map(a => {
            const cleanText = `${a.varName} = ${a.exprText}`;
            return {
                type: 'process',
                raw: `${cleanText};`,
                target: a.varName,
                expr: a.exprText,
                text: cleanText,
                simplifiedText: cleanText,
                isDeclarationAssignment: true
            };
        });

        return processNodes.length === 1 ? processNodes[0] : processNodes;
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

        while (this.pos < this.tokens.length && !this.match('SYMBOL', ';')) {
            this.consume();
        }
        if (this.match('SYMBOL', ';')) this.consume();

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

        // Check if there are non-string expressions in this cout statement
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

            // Skip single manipulators: endl, fixed, scientific, etc.
            if (p.length - firstIdx === 1 && manipulators.has(leadVal)) {
                continue;
            }

            // Skip parameterized manipulators: setw(5), setprecision(2), etc.
            if (p.length - firstIdx >= 3 && paramManipulators.has(leadVal) && p[firstIdx + 1]?.value === '(') {
                hasTableFormatting = true;
                continue;
            }

            // String literals
            if (p.length === 1 && p[0].type === 'STRING') {
                const strVal = p[0].value;
                const inner = strVal.slice(1, -1).trim();
                // Skip purely decorative table dividers: "----------------", "|", "  |"
                if (/^[-=*#|+_~]+$/.test(inner) || inner === '') {
                    hasTableFormatting = true;
                    continue;
                }
                // Skip prompt label prefix if followed by non-string expressions (e.g. "x = ", "S = ")
                if (hasUpcomingNonString && (inner.endsWith('=') || inner.endsWith(':'))) {
                    continue;
                }
                orderedItems.push(p[0].value);
                continue;
            }

            // Expressions (variables, math, function calls)
            const exprText = this.formatExpression(p);
            if (exprText) {
                orderedItems.push(exprText);
                hasNonString = true;
            }
        }

        if (orderedItems.length === 0) {
            return null;
        }

        if (!hasNonString && hasTableFormatting) {
            return null;
        }

        const simpleText = orderedItems.join(', ');

        return {
            type: 'output',
            raw: `cout << ...;`,
            text: simpleText,
            umlText: `вивід ${simpleText}`,
            fullText: simpleText,
            isPromptCandidate: !hasNonString
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
                cases.push({
                    condition: cond,
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

        const formatted = this.formatExpression(retTokens);
        const isMainZero = formatted === '0' || formatted === '';

        return {
            type: 'return',
            raw: `return ${formatted};`,
            text: formatted ? `return ${formatted}` : 'return',
            value: formatted,
            isMainZero: isMainZero
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
            const prev = i > 0 ? tokens[i - 1] : null;

            res += t.value;

            if (next) {
                // Keep increment/decrement tight: i++ or ++i
                if (t.value === '++' || t.value === '--' || next.value === '++' || next.value === '--') {
                    continue;
                }
                // No space before opening paren '(' only for identifiers: sin(x), atan(1.0), pow(x, 2)
                if (t.type === 'IDENTIFIER' && next.value === '(') {
                    continue;
                }
                // No space after opening paren '(' or before closing paren ')'
                if (t.value === '(' || next.value === ')') {
                    continue;
                }
                // Unary operators (-, +, !)
                if (['-', '+', '!'].includes(t.value)) {
                    const isUnary = !prev || ['(', ',', ';', '=', '+=', '-=', '*=', '/=', '&&', '||', '<', '>', '<=', '>=', '==', '!='].includes(prev.value);
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
                // Assignment operators (=, +=, -=, *=, /=)
                else if (['=', '+=', '-=', '*=', '/='].includes(t.value) || ['=', '+=', '-=', '*=', '/='].includes(next.value)) {
                    res += ' ';
                }
                // Basic arithmetic (+, -, *, /, %)
                else if (['+', '-', '*', '/', '%'].includes(t.value) || ['+', '-', '*', '/', '%'].includes(next.value)) {
                    res += ' ';
                }
                // Stream operators (<<, >>)
                else if (['<<', '>>'].includes(t.value) || ['<<', '>>'].includes(next.value)) {
                    res += ' ';
                }
                // Adjacent identifiers / keywords / numbers / strings (e.g. ifstream f, new Pracivnyk)
                else if ((t.type === 'IDENTIFIER' || t.type === 'KEYWORD') &&
                         (next.type === 'IDENTIFIER' || next.type === 'KEYWORD' || next.type === 'NUMBER' || next.type === 'STRING')) {
                    res += ' ';
                }
                else if (t.type === 'STRING' && (next.type === 'IDENTIFIER' || next.type === 'KEYWORD')) {
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
        if (!Array.isArray(stmts)) return stmts;

        // 1. Recursively clean nested control structures (if, while, do-while, for)
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

            // If prompt output is immediately followed by input, skip the prompt output
            if (curr && curr.type === 'output' && curr.isPromptCandidate && next && next.type === 'input') {
                continue;
            }

            if (curr) {
                afterPrompts.push(curr);
            }
        }

        // 2b. Remove dead declaration assignments before input/loops if reassigned before read
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

        // 3. Merge consecutive input statements into a single input node ("ввід a, b, c, d")
        const merged = [];
        let i = 0;
        while (i < activeStmts.length) {
            const curr = activeStmts[i];
            if (curr.type === 'input') {
                const combinedVars = [];
                if (curr.variables && curr.variables.length > 0) {
                    combinedVars.push(...curr.variables);
                } else if (curr.text) {
                    combinedVars.push(...curr.text.split(',').map(s => s.trim()).filter(Boolean));
                }

                let j = i + 1;
                while (j < activeStmts.length && activeStmts[j].type === 'input') {
                    const nextInput = activeStmts[j];
                    if (nextInput.variables && nextInput.variables.length > 0) {
                        combinedVars.push(...nextInput.variables);
                    } else if (nextInput.text) {
                        combinedVars.push(...nextInput.text.split(',').map(s => s.trim()).filter(Boolean));
                    }
                    j++;
                }

                if (j === i + 1) {
                    // Only one standalone input
                    merged.push(curr);
                } else {
                    // Multiple consecutive inputs: merge variables into a single block
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
