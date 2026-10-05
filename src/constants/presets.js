/**
 * Presets and templates for University Programming Labs (Algorithms & Programming, Lviv Polytechnic / Hryhorovych)
 * Covers all tasks 4.1 to 4.7 for Lab 4 (Loops), as well as classic tasks for Labs 2, 3, 5.
 */

export const PRESETS = [
  {
    id: "lab4_1",
    label: "4.1. Цикли (4 способи)",
    title: "ЛР 4.1: Обчислення виразу 4-ма способами (while, do-while, for++, for--)",
    category: "Лабораторна робота № 4 (Цикли)",
    code: `#include <iostream>
#include <cmath>

using namespace std;

int main()
{
    int k, N, i;
    double S;

    cout << "k = "; cin >> k;
    cout << "N = "; cin >> N;

    // 1) спосіб: цикл while (з перед-умовою)
    S = 0;
    i = k;
    while (i <= N)
    {
        S += sin(1. * i);
        i++;
    }
    cout << S << endl;

    // 2) спосіб: цикл do..while (з після-умовою)
    S = 0;
    i = k;
    do {
        S += sin(1. * i);
        i++;
    } while (i <= N);
    cout << S << endl;

    // 3) спосіб: цикл for (з лічильником i++)
    S = 0;
    for (i = k; i <= N; i++)
    {
        S += sin(1. * i);
    }
    cout << S << endl;

    // 4) спосіб: цикл for (з лічильником i--)
    S = 0;
    for (i = N; i >= k; i--)
    {
        S += sin(1. * i);
    }
    cout << S << endl;

    return 0;
}`
  },
  {
    id: "lab4_1_var6",
    label: "4.1. Вар 6 (добуток P, 4 цикли)",
    title: "ЛР 4.1 (Вар 6): Добуток P від N до 19 чотирма способами (while, do-while, for++, for--)",
    category: "Лабораторна робота № 4 (Цикли)",
    code: `#include <iostream>

using namespace std;

int main() {
    int N;
    int k;
    double P;

    cout << "Введіть ціле число N (рекомендовано N <= 19): ";
    cin >> N;

    // Спосіб 1: Цикл while (із перед-умовою)
    P = 1.0;
    k = N;
    while (k <= 19) {
        P *= (double)(k - N) / (k + N) + 1.0;
        k++;
    }
    cout << "Результат (while):    P = " << P << endl;

    // Спосіб 2: Цикл do...while (з після-умовою)
    P = 1.0;
    k = N;
    do {
        P *= (double)(k - N) / (k + N) + 1.0;
        k++;
    } while (k <= 19);
    cout << "Результат (do-while): P = " << P << endl;

    // Спосіб 3: Цикл for (із кроком k++)
    P = 1.0;
    for (k = N; k <= 19; k++) {
        P *= (double)(k - N) / (k + N) + 1.0;
    }
    cout << "Результат (for k++):  P = " << P << endl;

    // Спосіб 4: Цикл for (із кроком k--)
    P = 1.0;
    for (k = 19; k >= N; k--) {
        P *= (double)(k - N) / (k + N) + 1.0;
    }
    cout << "Результат (for k--):  P = " << P << endl;

    return 0;
}`
  },
  {
    id: "lab4_2",
    label: "4.2. Табуляція (одна змінна)",
    title: "ЛР 4.2: Табуляція кусково-заданої функції однієї змінної з форматною таблицею",
    category: "Лабораторна робота № 4 (Цикли)",
    code: `#include <iostream>
#include <iomanip>
#include <cmath>

using namespace std;

int main()
{
    double x, xp, xk, dx, A, B, y;

    cout << "xp = "; cin >> xp;
    cout << "xk = "; cin >> xk;
    cout << "dx = "; cin >> dx;

    cout << fixed;
    cout << "---------------------------" << endl;
    cout << "|" << setw(5) << "x" << "     |"
         << setw(7) << "y" << "       |" << endl;
    cout << "---------------------------" << endl;

    x = xp;
    while (x <= xk)
    {
        A = 2.5 * x;
        if (x < 0)
            B = sin(x);
        else if (x <= 1)
            B = cos(x);
        else
            B = exp(x);
        y = A + B;
        cout << "|" << setw(7) << setprecision(2) << x
             << "   |" << setw(10) << setprecision(3) << y
             << "    |" << endl;
        x += dx;
    }
    cout << "---------------------------" << endl;

    return 0;
}`
  },
  {
    id: "lab4_3",
    label: "4.3. Табуляція (з параметрами)",
    title: "ЛР 4.3: Табуляція функції з вхідними параметрами a, b, c",
    category: "Лабораторна робота № 4 (Цикли)",
    code: `#include <iostream>
#include <iomanip>
#include <cmath>

using namespace std;

int main()
{
    double a, b, c, xp, xk, dx, x, F;

    cout << "a = "; cin >> a;
    cout << "b = "; cin >> b;
    cout << "c = "; cin >> c;
    cout << "xp = "; cin >> xp;
    cout << "xk = "; cin >> xk;
    cout << "dx = "; cin >> dx;

    cout << fixed;
    cout << "---------------------------" << endl;
    cout << "|" << setw(7) << "x" << "     |"
         << setw(10) << "F" << "        |" << endl;
    cout << "---------------------------" << endl;

    x = xp;
    while (x <= xk)
    {
        if (x < 0 && b != 0)
            F = a - x / (10 + b);
        else if (x > 0 && b == 0)
            F = (x - a) / (x - c);
        else
            F = 3 * x + 2 / c;

        cout << "|" << setw(9) << setprecision(2) << x
             << "   |" << setw(12) << setprecision(3) << F
             << "    |" << endl;
        x += dx;
    }
    cout << "---------------------------" << endl;

    return 0;
}`
  },
  {
    id: "lab4_4",
    label: "4.4. Табуляція (за графіком)",
    title: "ЛР 4.4: Табуляція кусочно-заданої функції за графіком",
    category: "Лабораторна робота № 4 (Цикли)",
    code: `#include <iostream>
#include <iomanip>
#include <cmath>

using namespace std;

int main()
{
    double R, xp, xk, dx, x, y;

    cout << "R = "; cin >> R;
    cout << "xp = "; cin >> xp;
    cout << "xk = "; cin >> xk;
    cout << "dx = "; cin >> dx;

    cout << fixed;
    cout << "---------------------------" << endl;
    cout << "|" << setw(7) << "x" << "     |"
         << setw(10) << "y" << "        |" << endl;
    cout << "---------------------------" << endl;

    x = xp;
    while (x <= xk)
    {
        if (x <= -6)
            y = -R;
        else if (x <= -R)
            y = -R + (x + 6) * R / (6 - R);
        else if (x <= 0)
            y = sqrt(R * R - x * x);
        else if (x <= 3)
            y = R - x * R / 3;
        else
            y = (x - 3) * R / 6;

        cout << "|" << setw(9) << setprecision(2) << x
             << "   |" << setw(12) << setprecision(3) << y
             << "    |" << endl;
        x += dx;
    }
    cout << "---------------------------" << endl;

    return 0;
}`
  },
  {
    id: "lab4_5",
    label: "4.5. «Попадання» у фігуру",
    title: "ЛР 4.5: Визначення попадання в плоску фігуру двома способами (клавіатура та rand())",
    category: "Лабораторна робота № 4 (Цикли)",
    code: `#include <iostream>
#include <iomanip>
#include <time.h>

using namespace std;

int main()
{
    double x, y;

    // 1 спосіб: введення координат 10 пострілів з клавіатури
    for (int i = 0; i < 10; i++)
    {
        cout << "x = "; cin >> x;
        cout << "y = "; cin >> y;

        if ((y >= 1 && y <= 3 && x >= -1 && x <= 1) ||
            (x * x + y * y <= 1) ||
            (y >= -2 && y <= x - 1 && y <= -x - 1))
            cout << "yes" << endl;
        else
            cout << "no" << endl;
    }

    cout << endl << fixed;

    // 2 спосіб: генерація 10 пострілів з випадковими координатами
    srand((unsigned) time(NULL));
    for (int i = 0; i < 10; i++)
    {
        x = 6. * rand() / RAND_MAX - 3;
        y = 6. * rand() / RAND_MAX - 3;

        if ((y >= 1 && y <= 3 && x >= -1 && x <= 1) ||
            (x * x + y * y <= 1) ||
            (y >= -2 && y <= x - 1 && y <= -x - 1))
            cout << setw(8) << setprecision(4) << x << "  "
                 << setw(8) << setprecision(4) << y << "  " << "yes" << endl;
        else
            cout << setw(8) << setprecision(4) << x << "  "
                 << setw(8) << setprecision(4) << y << "  " << "no" << endl;
    }

    return 0;
}`
  },
  {
    id: "lab4_6",
    label: "4.6. Вкладені цикли",
    title: "ЛР 4.6: Вкладені цикли (вкладені while, do-while, for++, for--)",
    category: "Лабораторна робота № 4 (Цикли)",
    code: `#include <iostream>
#include <cmath>

using namespace std;

int main()
{
    double P, S;
    int n, i;

    // 1) спосіб: while всередині while
    P = 1;
    n = 1;
    while (n <= 10)
    {
        S = 0;
        i = 1;
        while (i <= n)
        {
            S += sin(1. * i) * sin(1. * i);
            i++;
        }
        P *= sqrt(S) / (1 + S);
        n++;
    }
    cout << P << endl;

    // 2) спосіб: do..while всередині do..while
    P = 1;
    n = 1;
    do {
        S = 0;
        i = 1;
        do {
            S += sin(1. * i) * sin(1. * i);
            i++;
        } while (i <= n);
        P *= sqrt(S) / (1 + S);
        n++;
    } while (n <= 10);
    cout << P << endl;

    // 3) спосіб: for++ всередині for++
    P = 1;
    for (n = 1; n <= 10; n++)
    {
        S = 0;
        for (i = 1; i <= n; i++)
        {
            S += sin(1. * i) * sin(1. * i);
        }
        P *= sqrt(S) / (1 + S);
    }
    cout << P << endl;

    // 4) спосіб: for-- всередині for--
    P = 1;
    for (n = 10; n >= 1; n--)
    {
        S = 0;
        for (i = n; i >= 1; i--)
        {
            S += sin(1. * i) * sin(1. * i);
        }
        P *= sqrt(S) / (1 + S);
    }
    cout << P << endl;

    return 0;
}`
  },
  {
    id: "lab4_7",
    label: "4.7. Ряд Тейлора (рекурентність)",
    title: "ЛР 4.7: Обчислення суми ряду Тейлора за допомогою ітераційних циклів та рекурентних співвідношень",
    category: "Лабораторна робота № 4 (Цикли)",
    code: `#include <iostream>
#include <iomanip>
#include <cmath>

using namespace std;

int main()
{
    double xp, xk, x, dx, eps, a = 0, R = 0, S = 0;
    int n = 0;

    cout << "xp = "; cin >> xp;
    cout << "xk = "; cin >> xk;
    cout << "dx = "; cin >> dx;
    cout << "eps = "; cin >> eps;

    cout << fixed;
    cout << "-------------------------------------------------" << endl;
    cout << "|" << setw(5) << "x" << "     |"
         << setw(10) << "exp(x)" << "   |"
         << setw(7) << "S" << "      |"
         << setw(5) << "n" << "   |"
         << endl;
    cout << "-------------------------------------------------" << endl;

    x = xp;
    while (x <= xk)
    {
        n = 0;
        a = 1;
        S = a;
        do {
            n++;
            R = x / n;
            a *= R;
            S += a;
        } while (abs(a) >= eps);

        cout << "|" << setw(7) << setprecision(2) << x << "   |"
             << setw(10) << setprecision(5) << exp(x) << "   |"
             << setw(10) << setprecision(5) << S << "   |"
             << setw(5) << n << "   |"
             << endl;
        x += dx;
    }
    cout << "-------------------------------------------------" << endl;

    return 0;
}`
  },
  {
    id: "lab3_3",
    label: "3.3. Розгалуження (if-else)",
    title: "ЛР 3: Розгалуження в повній та скороченій формах",
    category: "Інші лабораторні роботи",
    code: `#include <iostream>
#include <cmath>

using namespace std;

int main()
{
    double x;
    double y;
    double A;
    double B;

    cout << "x = "; cin >> x;

    A = 2.5 * x;

    if (x < 0)
        B = sin(x);
    else if (x <= 1)
        B = exp(x);
    else
        B = cos(x);

    y = A + B;

    cout << "y = " << y << endl;
    return 0;
}`
  },
  {
    id: "lab2_1",
    label: "2.1. Лінійні програми (дроби)",
    title: "ЛР 2: Лінійні програми з математичними функціями та дробами",
    category: "Інші лабораторні роботи",
    code: `#include <iostream>
#include <cmath>

using namespace std;

int main()
{
    double a, z1, z2;

    cout << "a = "; cin >> a;

    z1 = (cos(a) + sin(a)) / (cos(a) - sin(a));
    z2 = tan(2 * a) + 1.0 / cos(2 * a);

    cout << "z1 = " << z1 << endl;
    cout << "z2 = " << z2 << endl;

    return 0;
}`
  },
  {
    id: "lab5_1",
    label: "5.1. Функції користувача",
    title: "ЛР 5: Підпрограми та функції користувача",
    category: "Інші лабораторні роботи",
    code: `#include <iostream>
#include <cmath>

using namespace std;

double h(const double x, const double y, const double z)
{
    return (x + y + z) / (x * x + y * y);
}

int main()
{
    double s, t;
    cout << "s = "; cin >> s;
    cout << "t = "; cin >> t;

    double c = (h(s, t, 1) + h(1, s, t)) / (1 + h(s * t, 1, 1));

    cout << "c = " << c << endl;
    return 0;
}`
  }
];

export const DEFAULT_PRESET_ID = "lab4_1";
export const DEFAULT_CODE = PRESETS[0].code;
