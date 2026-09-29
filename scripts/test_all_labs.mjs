import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { parseCppCode } from '../src/parser/cppParser.js';
import { FlowchartRenderer } from '../src/renderers/flowchartRenderer.js';
import { UmlRenderer } from '../src/renderers/umlRenderer.js';

const outDir = '/tmp/lab_tests';
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

const testCases = [
    {
        id: 'lab2_1_variant16',
        name: 'Lab 2.1 Variant 16 (Linear program with roots and fractions)',
        code: `#include <iostream>
#include <cmath>
using namespace std;

int main() {
    double a;
    double z1;
    double z2;

    cout << "a = "; cin >> a;

    z1 = (cos(a) + sin(a)) / (cos(a) - sin(a));
    z2 = tan(2 * a) + 1.0 / cos(2 * a);

    cout << "z1 = " << z1 << endl;
    cout << "z2 = " << z2 << endl;

    return 0;
}`
    },
    {
        id: 'lab3_3_variant1',
        name: 'Lab 3.3 Variant 1 (Branching with 4 conditions and circle curve)',
        code: `#include <iostream>
#include <cmath>
using namespace std;

int main() {
    double x;
    double R;
    double y;

    cout << "R = "; cin >> R;
    cout << "x = "; cin >> x;

    if (x <= -4)
        y = -R;
    else if (x <= 0)
        y = -R + (x + 4) * R / 4;
    else if (x <= 2 * R)
        y = sqrt(R * R - (x - 2 * R) * (x - 2 * R));
    else
        y = R;

    cout << "y = " << y << endl;
    return 0;
}`
    },
    {
        id: 'lab4_2_variant0',
        name: 'Lab 4.2 Variant 0 (While loop tabulation with table header and if-else)',
        code: `#include <iostream>
#include <iomanip>
#include <cmath>
using namespace std;

int main() {
    double xp, xk, dx, x, A, B, y;

    cout << "xp = "; cin >> xp;
    cout << "xk = "; cin >> xk;
    cout << "dx = "; cin >> dx;

    cout << fixed;
    cout << "---------------------------" << endl;
    cout << "|" << setw(5) << "x" << "     |"
         << setw(7) << "y" << "       |" << endl;
    cout << "---------------------------" << endl;

    x = xp;
    while (x <= xk) {
        A = 2.5 * x;
        if (x < 0)
            B = sin(x);
        else if (x <= 1)
            B = cos(x);
        else
            B = exp(x);

        y = A + B;
        cout << "|" << setw(7) << setprecision(2) << x
             << " |" << setw(9) << setprecision(3) << y
             << " |" << endl;
        x += dx;
    }
    cout << "---------------------------" << endl;

    return 0;
}`
    },
    {
        id: 'lab5_1_variant0',
        name: 'Lab 5.1 Variant 0 (Functions: h function with fraction and main calling h)',
        code: `#include <iostream>
#include <cmath>
using namespace std;

double h(const double x, const double y, const double z) {
    return (x + y + z) / (x * x + y * y);
}

int main() {
    double s, t;
    cout << "s = "; cin >> s;
    cout << "t = "; cin >> t;

    double c = (h(s, t, 1) + h(1, s, t)) / (1 + h(s * t, 1, 1));

    cout << "c = " << c << endl;
    return 0;
}`
    }
];

for (const tc of testCases) {
    console.log(`Processing: ${tc.name}`);
    const initialAst = parseCppCode(tc.code);

    const funcNames = (initialAst.functions && initialAst.functions.length > 0)
        ? initialAst.functions.map(f => f.name)
        : [initialAst.functionName || 'main'];

    for (const fName of funcNames) {
        const funcAst = parseCppCode(tc.code, { targetFunction: fName });
        const funcSuffix = fName !== 'main' ? `_func_${fName}` : '';
        const baseName = `${tc.id}${funcSuffix}`;

        console.log(`  Generating diagrams for function: ${fName} (${funcAst.length} statements)`);

        // Flowchart Math mode
        const fcRenderer = new FlowchartRenderer(funcAst, {
            expressionMode: 'math',
            branchLabels: 'plus_minus',
            outputShape: 'document',
            theme: 'light'
        });
        const fcResult = fcRenderer.render();
        const fcSvgPath = path.join(outDir, `${baseName}_fc.svg`);
        const fcPngPath = path.join(outDir, `${baseName}_fc.png`);
        fs.writeFileSync(fcSvgPath, fcResult.svg);
        try {
            execSync(`/opt/homebrew/bin/rsvg-convert "${fcSvgPath}" -o "${fcPngPath}"`);
        } catch (e) {
            console.error('Error converting FC SVG to PNG:', e);
        }

        // UML Math mode
        const umlRenderer = new UmlRenderer(funcAst, {
            expressionMode: 'math',
            theme: 'light'
        });
        const umlResult = umlRenderer.render();
        const umlSvgPath = path.join(outDir, `${baseName}_uml.svg`);
        const umlPngPath = path.join(outDir, `${baseName}_uml.png`);
        fs.writeFileSync(umlSvgPath, umlResult.svg);
        try {
            execSync(`/opt/homebrew/bin/rsvg-convert "${umlSvgPath}" -o "${umlPngPath}"`);
        } catch (e) {
            console.error('Error converting UML SVG to PNG:', e);
        }
    }
}

console.log('All test diagrams generated successfully!');
