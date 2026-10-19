import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { parseCppCode } from '../src/parser/cppParser.js';
import { FlowchartRenderer } from '../src/renderers/flowchartRenderer.js';
import { UmlRenderer } from '../src/renderers/umlRenderer.js';
import { StructureChartRenderer } from '../src/renderers/structureChartRenderer.js';

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
        id: 'lab3_4_variant23',
        name: 'Lab 3.4 Variant 23 (Long condition with 2D area checks)',
        code: `#include <iostream>
using namespace std;

int main()
{
    double x;
    double y;
    double R;

    cout << "R = "; cin >> R;
    cout << "x = "; cin >> x;
    cout << "y = "; cin >> y;

    if ((x >= 0 && x <= R && y >= 0 && y <= R) ||
        (x >= -R && x <= 0 && y >= -R && y <= 0) ||
        (x >= -R && x <= 0 && y >= 0 && y <= R && ((x + R) * (x + R) + (y - R) * (y - R) >= R * R)))
    {
        cout << "так" << endl;
    }
    else
    {
        cout << "ні" << endl;
    }

    cin.get();
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
}
`
    },
    {
        id: 'lab5_2_variant0',
        name: 'Lab 5.2 Variant 0 (Taylor Series with void functions and reference parameters)',
        code: `#include <iostream>
#include <cmath>
using namespace std;

void S(const double x, const double eps, int &n, double &s);
void A(const double x, const int n, double &a);

int main() {
    double xp, xk, eps, s = 0;
    int n = 0;
    cout << "xp = "; cin >> xp;
    cout << "xk = "; cin >> xk;
    cout << "eps = "; cin >> eps;

    S(xp, eps, n, s);
    cout << "s = " << s << endl;
    return 0;
}

void S(const double x, const double eps, int &n, double &s) {
    n = 0;
    double a = -x * x / 2;
    s = a;
    do {
        n++;
        A(x, n, a);
        s += a;
    } while (abs(a) >= eps);
}

void A(const double x, const int n, double &a) {
    double R = -x * x / ((2 * n) * (2 * n + 1));
    a *= R;
}`
    },
    {
        id: 'lab5_3_variant0',
        name: 'Lab 5.3 Variant 0 (Tabulation with helper function called in while loop)',
        code: `#include <iostream>
#include <cmath>
using namespace std;

double p(const double x);

int main() {
    double gp, gk, z;
    int n;
    cout << "gp = "; cin >> gp;
    cout << "gk = "; cin >> gk;
    cout << "n = "; cin >> n;

    double dg = (gk - gp) / n;
    double g = gp;

    while (g <= gk) {
        z = p(1 - g * g) + pow(p(1 + g), 2);
        cout << "z = " << z << endl;
        g += dg;
    }
    return 0;
}

double p(const double x) {
    if (x >= 0)
        return exp(x) + sin(x);
    else
        return exp(-x) + cos(x);
}`
    },
    {
        id: 'lab5_4_variant0',
        name: 'Lab 5.4 Variant 0 (Official Textbook Example with 5 functions: S0 iterative, S1-S4 recursive)',
        code: `#include <iostream>
#include <cmath>
using namespace std;

double S0(const int K, const int N) {
    double s = 0;
    for (int i = K; i <= N; i++)
        s += sin(1. * i);
    return s;
}

double S1(const int K, const int N, const int i) {
    if (i > N)
        return 0;
    else
        return sin(1. * i) + S1(K, N, i + 1);
}

double S2(const int K, const int N, const int i) {
    if (i < K)
        return 0;
    else
        return sin(1. * i) + S2(K, N, i - 1);
}

double S3(const int K, const int N, const int i, double t) {
    t = t + sin(1. * i);
    if (i >= N)
        return t;
    else
        return S3(K, N, i + 1, t);
}

double S4(const int K, const int N, const int i, double t) {
    t = t + sin(1. * i);
    if (i <= K)
        return t;
    else
        return S4(K, N, i - 1, t);
}

int main() {
    int K, N;
    cout << "K = "; cin >> K;
    cout << "N = "; cin >> N;

    cout << "(iter)        S0 = " << S0(K, N)       << endl;
    cout << "(rec up ++)   S1 = " << S1(K, N, K)    << endl;
    cout << "(rec up --)   S2 = " << S2(K, N, N)    << endl;
    cout << "(rec down ++) S3 = " << S3(K, N, K, 0) << endl;
    cout << "(rec down --) S4 = " << S4(K, N, N, 0) << endl;
    return 0;
}`
    },
    {
        id: 'lab5_5_variant1_digits',
        name: 'Lab 5.5 Variant 1 (Sum of digits with level and reference depth parameter)',
        code: `#include <iostream>
using namespace std;

int f(int n, int level, int &depth) {
    if (level > depth)
        depth = level;
    cout << "level = " << level << endl;
    if (n == 0)
        return 0;
    else
        return (n % 10) + f(n / 10, level + 1, depth);
}

int main() {
    int n;
    cout << "n = "; cin >> n;
    int depth = 0;
    int s = f(n, 1, depth);
    cout << "Sum = " << s << endl;
    cout << "Depth = " << depth << endl;
    return 0;
}`
    },
    {
        id: 'lab5_5_variant3_fibonacci',
        name: 'Lab 5.5 Variant 3 (Fibonacci with multi-call and recursion depth)',
        code: `#include <iostream>
using namespace std;

int fib(int n, int level, int &depth) {
    if (level > depth)
        depth = level;
    cout << "level = " << level << endl;
    if (n <= 0)
        return 0;
    if (n == 1)
        return 1;
    return fib(n - 1, level + 1, depth) + fib(n - 2, level + 1, depth);
}

int main() {
    int n;
    cout << "n = "; cin >> n;
    int depth = 0;
    int res = fib(n, 1, depth);
    cout << "F(" << n << ") = " << res << endl;
    cout << "depth = " << depth << endl;
    return 0;
}`
    },
    {
        id: 'lab5_5_variant4_ackermann',
        name: 'Lab 5.5 Variant 4 (Ackermann function with nested recursion)',
        code: `#include <iostream>
using namespace std;

int A(int m, int n, int level, int &depth) {
    if (level > depth)
        depth = level;
    if (m == 0)
        return n + 1;
    else if (n == 0)
        return A(m - 1, 1, level + 1, depth);
    else
        return A(m - 1, A(m, n - 1, level + 1, depth), level + 1, depth);
}

int main() {
    int m, n;
    cout << "m = "; cin >> m;
    cout << "n = "; cin >> n;
    int depth = 0;
    int res = A(m, n, 1, depth);
    cout << "A(" << m << ", " << n << ") = " << res << endl;
    cout << "depth = " << depth << endl;
    return 0;
}`
    },
    {
        id: 'karatsuba_complex',
        name: 'Karatsuba Complex Multiplication (Multi-word types, recursion, and multiple subroutines)',
        code: `#include <iostream>
#include <cmath>
#include <algorithm>
#include <string>
using namespace std;
int max_depth = 0;

// 1. РЕКУРСИВНА ФУНКЦІЯ КАРАЦУБИ ДЛЯ МНОЖЕННЯ ДВОХ ЦІЛИХ ЧИСЕЛ
long long karatsuba(long long X, long long Y, int level) {
    if (level > max_depth) {
        max_depth = level;
    }

    if (abs(X) < 10 || abs(Y) < 10) {
        return X * Y;
    }

    int n = max(to_string(abs(X)).length(), to_string(abs(Y)).length());
    int half = n / 2;

    long long t = pow(10, half);

    long long a1 = X / t;
    long long a0 = X % t;
    long long b1 = Y / t;
    long long b0 = Y % t;

    long long D0 = karatsuba(a0, b0, level + 1);
    long long D1 = karatsuba(a1, b1, level + 1);
    long long D2 = karatsuba(a1 + a0, b1 + b0, level + 1);

    return D1 * t * t + (D2 - D0 - D1) * t + D0;
}

// 2. ФУНКЦІЯ ДЛЯ КОМПЛЕКСНОГО МНОЖЕННЯ
void multiplyComplex(long long a, long long b, long long c, long long d) {
    max_depth = 0;
    long long ac = karatsuba(a, c, 0);
    long long bd = karatsuba(b, d, 0);
    long long ad = karatsuba(a, d, 0);
    long long bc = karatsuba(b, c, 0);

    long long r = ac - bd;
    long long s = ad + bc;

    cout << "\n--- РЕЗУЛЬТАТ ---" << endl;
    cout << "r = " << r << endl;
    cout << "s = " << s << endl;
    cout << "Глибина рекурсії = " << max_depth << endl;
}

int main() {
    long long a, b, c, d;
    cout << "Введіть дійсні та уявні частини чисел." << endl;
    cout << "Перше число (a + ib):" << endl;
    cout << "a = "; cin >> a;
    cout << "b = "; cin >> b;

    cout << "Друге число (c + id):" << endl;
    cout << "c = "; cin >> c;
    cout << "d = "; cin >> d;

    multiplyComplex(a, b, c, d);

    return 0;
}`
    }
];

for (const tc of testCases) {
    console.log(`Processing: ${tc.name}`);
    const initialAst = parseCppCode(tc.code);

    // Generate Structure Chart for multi-function programs
    if (initialAst.functions && initialAst.functions.length > 1) {
        const scRenderer = new StructureChartRenderer(initialAst);
        const scResult = scRenderer.render();
        const scSvgPath = path.join(outDir, `${tc.id}_sc.svg`);
        fs.writeFileSync(scSvgPath, scResult.svg);
        console.log(`  Structure Chart: ${tc.id}_sc.svg`);
    }

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
