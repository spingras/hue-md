#define UNICODE
#define _UNICODE
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <string>
#include <vector>
#include <fstream>
#include <sstream>

typedef intptr_t sptr_t;
typedef uintptr_t uptr_t;
typedef intptr_t Sci_Position;

struct NppData {
    HWND _nppHandle;
    HWND _scintillaMainHandle;
    HWND _scintillaSecondHandle;
};

struct Sci_NotifyHeader {
    void *hwndFrom;
    uptr_t idFrom;
    unsigned int code;
};

struct SCNotification {
    Sci_NotifyHeader nmhdr;
    Sci_Position position;
    int ch;
    int modifiers;
    int modificationType;
    const char *text;
    Sci_Position length;
    Sci_Position linesAdded;
    int message;
    uptr_t wParam;
    sptr_t lParam;
    Sci_Position line;
    int foldLevelNow;
    int foldLevelPrev;
    int margin;
    int listType;
    int x;
    int y;
    int token;
    Sci_Position annotationLinesAdded;
    int updated;
    int listCompletionMethod;
    int characterSource;
};

#define NPPN_READY              1001
#define SCI_GETLENGTH           2006
#define SCI_STYLEGETBACK        2482
#define SCI_SETINDICATORCURRENT 2500
#define SCI_SETINDICATORVALUE   2502
#define SCI_INDICATORFILLRANGE  2504
#define SCI_INDICATORCLEARRANGE 2505
#define SCI_GETCHARACTERPOINTER 2520

struct FillRecord {
    int indicator;
    Sci_Position start;
    Sci_Position length;
    std::string snippet;
};

static std::string g_docBuffer;
static int g_currentIndic = 0;
static std::vector<FillRecord> g_fills;
static HWND g_registeredPanel = nullptr;
static int g_showRequests = 0;
static bool g_rightDock = false;

static LRESULT CALLBACK MockSciWndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        // Notepad++ public docking ABI; independent of plugin definitions.
        case WM_USER + 1000 + 33:
            {
                struct DockPrefix { HWND client; const wchar_t *name; int id; UINT mask; };
                auto data = reinterpret_cast<DockPrefix*>(lParam);
                g_rightDock = (data->mask & 0x70000000) == 0x10000000;
            }
            g_registeredPanel = *reinterpret_cast<HWND*>(lParam);
            return TRUE;
        case WM_USER + 1000 + 30:
            if (reinterpret_cast<HWND>(lParam) == g_registeredPanel) ++g_showRequests;
            return TRUE;
        case SCI_GETLENGTH:
            return (LRESULT)g_docBuffer.size();
        case SCI_GETCHARACTERPOINTER:
            return (LRESULT)g_docBuffer.c_str();
        case SCI_STYLEGETBACK:
            return (LRESULT)RGB(255, 255, 255); // Light mode
        case SCI_SETINDICATORCURRENT:
            g_currentIndic = (int)wParam;
            return 0;
        case SCI_INDICATORFILLRANGE: {
            Sci_Position start = (Sci_Position)wParam;
            Sci_Position len = (Sci_Position)lParam;
            std::string sub;
            if (start >= 0 && start + len <= (Sci_Position)g_docBuffer.size()) {
                sub = g_docBuffer.substr((size_t)start, (size_t)len);
            }
            g_fills.push_back({ g_currentIndic, start, len, sub });
            return 0;
        }
        default:
            return ::DefWindowProcW(hwnd, msg, wParam, lParam);
    }
}

int wmain(int argc, wchar_t **argv) {
    if (argc < 3) {
        printf("Usage: test_plugin <HueMarkdown.dll> <demo.hue.md>\n");
        return 1;
    }

    std::ifstream ifs(argv[2], std::ios::binary);
    if (!ifs) {
        printf("Failed to read input file\n");
        return 1;
    }
    std::ostringstream oss;
    oss << ifs.rdbuf();
    g_docBuffer = oss.str();

    HMODULE hDll = ::LoadLibraryW(argv[1]);
    if (!hDll) {
        printf("Failed to load DLL (err=%lu)\n", ::GetLastError());
        return 1;
    }

    typedef BOOL (__cdecl *PFN_isUnicode)();
    typedef const wchar_t* (__cdecl *PFN_getName)();
    typedef void* (__cdecl *PFN_getFuncsArray)(int*);
    typedef void (__cdecl *PFN_setInfo)(NppData);
    typedef void (__cdecl *PFN_beNotified)(SCNotification*);

    auto pIsUnicode = (PFN_isUnicode)::GetProcAddress(hDll, "isUnicode");
    auto pGetName = (PFN_getName)::GetProcAddress(hDll, "getName");
    auto pGetFuncs = (PFN_getFuncsArray)::GetProcAddress(hDll, "getFuncsArray");
    auto pSetInfo = (PFN_setInfo)::GetProcAddress(hDll, "setInfo");
    auto pBeNotified = (PFN_beNotified)::GetProcAddress(hDll, "beNotified");

    if (!pIsUnicode || !pGetName || !pGetFuncs || !pSetInfo || !pBeNotified) {
        printf("Missing required Notepad++ plugin export\n");
        return 1;
    }

    if (!pIsUnicode()) {
        printf("isUnicode() returned FALSE\n");
        return 1;
    }

    int nbF = 0;
    pGetFuncs(&nbF);
    wprintf(L"Loaded plugin: \"%s\" with %d menu commands\n", pGetName(), nbF);

    WNDCLASSW wc = { 0 };
    wc.lpfnWndProc = MockSciWndProc;
    wc.hInstance = ::GetModuleHandleW(nullptr);
    wc.lpszClassName = L"MockScintilla";
    ::RegisterClassW(&wc);

    HWND hSci = ::CreateWindowW(L"MockScintilla", L"", 0, 0, 0, 100, 100, nullptr, nullptr, wc.hInstance, nullptr);
    NppData nppData = { hSci, hSci, hSci };
    pSetInfo(nppData);

    SCNotification scn = { 0 };
    scn.nmhdr.code = NPPN_READY;
    pBeNotified(&scn);

    if (!g_registeredPanel || !IsWindow(g_registeredPanel) || !g_rightDock) {
        printf("TEST FAILED: preview panel was not registered with Notepad++\n");
        return 1;
    }
    struct CommandPrefix { wchar_t name[64]; void (__cdecl *invoke)(); };
    auto previewCommand = reinterpret_cast<CommandPrefix*>(pGetFuncs(&nbF));
    previewCommand->invoke();
    if (g_showRequests != 1) {
        printf("TEST FAILED: preview command did not request its registered panel\n");
        return 1;
    }
    printf("Preview registration and show command passed\n");

    printf("Total indicator fills on demo.hue.md: %zu\n", g_fills.size());
    bool foundPassing = false, foundWarn = false, foundBlocked = false, foundFalsePositive = false;
    for (const auto &f : g_fills) {
        if (f.snippet == "passing" && f.indicator == 11) foundPassing = true; // 8 + HUE_GREEN(3) = 11
        if (f.snippet == "71%" && f.indicator == 9) foundWarn = true;         // 8 + HUE_ORANGE(1) = 9
        if (f.snippet == "blocked" && f.indicator == 8) foundBlocked = true;  // 8 + HUE_RED(0) = 8
        if (f.snippet == "1" || f.snippet == "value") foundFalsePositive = true;
    }

    printf("Checks: passing(green)=%d, 71%%(orange)=%d, blocked(red)=%d, falsePositive=%d\n",
           foundPassing, foundWarn, foundBlocked, foundFalsePositive);

    if (!foundPassing || !foundWarn || !foundBlocked || foundFalsePositive) {
        printf("TEST FAILED\n");
        return 1;
    }
    printf("ALL PLUGIN TESTS PASSED\n");
    return 0;
}
