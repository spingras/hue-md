// HueMarkdownPlugin.cpp
// Native x64 Notepad++ Plugin for Hue Markdown (.hue.md)
// Provides:
// 1. Live in-editor Scintilla coloring for Hue inline spans and drawn boxes.
// 2. Embedded Docked Side-by-Side Live Preview Panel (MDHero / VS Code style)
//    docked directly inside Notepad++ on the right side!
// 3. Plugins -> Hue Markdown menu:
//    - Toggle Docked Live Preview (Ctrl+Shift+H)
//    - Open HTML Preview in External Browser
//    - Auto-Update Preview on Save
//    - Downgrade Current Buffer to GitHub Markdown (New Tab) (Ctrl+Shift+G)
//    - Enable In-Editor Hue Syntax Coloring
//    - Open Hue Demo Document (demo.hue.md)
//    - About Hue Markdown

#define UNICODE
#define _UNICODE
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <ole2.h>
#include <exdisp.h>
#include <mshtml.h>
#include <shellapi.h>
#include <shlwapi.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <string>
#include <vector>
#include <algorithm>

#pragma comment(lib, "user32.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "gdi32.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "oleaut32.lib")
#pragma comment(lib, "advapi32.lib")

// ---------------------------------------------------------------------------
// Notepad++ & Scintilla ABI definitions (x64 Unicode)
// ---------------------------------------------------------------------------

typedef intptr_t sptr_t;
typedef uintptr_t uptr_t;
typedef intptr_t Sci_Position;

struct NppData {
    HWND _nppHandle;
    HWND _scintillaMainHandle;
    HWND _scintillaSecondHandle;
};

struct ShortcutKey {
    bool _isCtrl;
    bool _isAlt;
    bool _isShift;
    UCHAR _key;
};

typedef void (__cdecl *PFUNCPLUGINCMD)();

const int nbChar = 64;
struct FuncItem {
    wchar_t _itemName[nbChar];
    PFUNCPLUGINCMD _pFunc;
    int _cmdID;
    bool _init2Check;
    ShortcutKey *_pShKey;
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

// Notepad++ messages & notifications
#define NPPMSG                    (WM_USER + 1000)
#define NPPM_GETCURRENTSCINTILLA  (NPPMSG + 4)
#define NPPM_DMMREGASDCKDLG       (NPPMSG + 33)
#define NPPM_DMMSHOW              (NPPMSG + 30)
#define NPPM_DMMHIDE              (NPPMSG + 31)
#define NPPM_DMMUPDATEDISPINFO    (NPPMSG + 32)
#define NPPM_SETMENUITEMCHECK     (NPPMSG + 40)
#define NPPM_MENUCOMMAND          (NPPMSG + 48)
#define NPPM_DOOPEN               (NPPMSG + 77)

#define RUNCOMMAND_USER           (WM_USER + 3000)
#define FULL_CURRENT_PATH         1
#define NPPM_GETFULLCURRENTPATH   (RUNCOMMAND_USER + FULL_CURRENT_PATH)

#define IDM                       40000
#define IDM_FILE                  (IDM + 1000)
#define IDM_FILE_NEW              (IDM_FILE + 1)

#define NPPN_FIRST                1000
#define NPPN_READY                (NPPN_FIRST + 1)
#define NPPN_TBMODIFICATION       (NPPN_FIRST + 2)
#define NPPN_FILEOPENED           (NPPN_FIRST + 4)
#define NPPN_FILESAVED            (NPPN_FIRST + 8)
#define NPPN_SHUTDOWN             (NPPN_FIRST + 9)
#define NPPN_BUFFERACTIVATED      (NPPN_FIRST + 10)
#define NPPN_WORDSTYLESUPDATED    (NPPN_FIRST + 12)
#define NPPN_DARKMODECHANGED      (NPPN_FIRST + 27)

// Docking masks
#define DWS_ICONTAB               0x00000001
#define DWS_ICONBAR               0x00000002
#define DWS_ADDINFO               0x00000004
#define DWS_PARAMSALL             (DWS_ICONTAB | DWS_ICONBAR | DWS_ADDINFO)
#define DWS_DF_CONT_LEFT          0x00000000
#define DWS_DF_CONT_RIGHT         0x10000000
#define DWS_DF_CONT_TOP           0x20000000
#define DWS_DF_CONT_BOTTOM        0x30000000
#define DWS_DF_FLOATING           0x80000000

struct tTbData {
    HWND hClient;
    const wchar_t *pszName;
    int dlgID;
    UINT uMask;
    HICON hIconTab;
    const wchar_t *pszAddInfo;
    RECT rcFloat;
    int iPrevCont;
    const wchar_t *pszModuleName;
};

// Scintilla messages & notifications
#define SCN_UPDATEUI              2007
#define SCN_MODIFIED              2008
#define SC_MOD_INSERTTEXT         0x01
#define SC_MOD_DELETETEXT         0x02

#define SCI_GETLENGTH             2006
#define SCI_REPLACESEL            2170
#define SCI_SETTEXT               2181
#define SCI_STYLEGETBACK          2482
#define SCI_SETINDICATORCURRENT   2500
#define SCI_SETINDICATORVALUE     2502
#define SCI_INDICATORFILLRANGE    2504
#define SCI_INDICATORCLEARRANGE   2505
#define SCI_INDICSETUNDER         2510
#define SCI_GETCHARACTERPOINTER   2520
#define SCI_INDICSETALPHA         2523
#define SCI_INDICSETOUTLINEALPHA  2558
#define SCI_INDICSETSTYLE         2080
#define SCI_INDICSETFORE          2082
#define SCI_INDICSETFLAGS         2684

#define STYLE_DEFAULT             32
#define INDIC_ROUNDBOX            7
#define INDIC_FULLBOX             16
#define INDIC_TEXTFORE            17
#define SC_INDICVALUEBIT          0x1000000
#define SC_INDICFLAG_VALUEFORE    1

// ---------------------------------------------------------------------------
// Hue Palette (exact match with src/palette.js)
// ---------------------------------------------------------------------------

enum HueColorId {
    HUE_NONE = -1,
    HUE_RED = 0,
    HUE_ORANGE = 1,
    HUE_YELLOW = 2,
    HUE_GREEN = 3,
    HUE_BLUE = 4,
    HUE_PURPLE = 5,
    HUE_GRAY = 6,
    HUE_COLOR_COUNT = 7
};

static inline COLORREF HexToBgr(uint32_t rgb) {
    uint32_t r = (rgb >> 16) & 0xFF;
    uint32_t g = (rgb >> 8) & 0xFF;
    uint32_t b = rgb & 0xFF;
    return RGB(r, g, b);
}

struct PaletteEntry {
    const char *name;
    uint32_t lightFg;
    uint32_t lightBg;
    uint32_t darkFg;
    uint32_t darkBg;
};

static const PaletteEntry kPalette[HUE_COLOR_COUNT] = {
    { "red",    0xb42318, 0xfde8e7, 0xff7b72, 0x3d1614 },
    { "orange", 0xb54708, 0xfdeedc, 0xffa657, 0x3b2410 },
    { "yellow", 0x7a5a00, 0xfdf6d3, 0xe3b341, 0x362b0a },
    { "green",  0x067647, 0xdcf5e7, 0x3fb950, 0x0f2e1c },
    { "blue",   0x175cd3, 0xe0ecfd, 0x58a6ff, 0x0f2444 },
    { "purple", 0x6941c6, 0xefe7fd, 0xd2a8ff, 0x2a1b45 },
    { "gray",   0x57606a, 0xeef0f2, 0x8b949e, 0x21262d }
};

#define INDIC_HUE_FG_BASE   8
#define INDIC_HUE_BG_BASE   15
#define INDIC_HUE_HEX_FG    22
#define INDIC_HUE_HEX_BG    23
#define INDIC_HUE_BODY_FG   24
#define INDIC_HUE_FIRST     8
#define INDIC_HUE_LAST      24

// ---------------------------------------------------------------------------
// Embedded WebHost for Docked Side-by-Side Live Preview
// ---------------------------------------------------------------------------

class WebHost : public IOleClientSite, public IOleInPlaceSite, public IOleInPlaceFrame {
    friend struct WebHostTestAccess;
    LONG m_cRef;
    HWND m_hWnd;
    IOleObject *m_pOleObj;
    IWebBrowser2 *m_pWebBrowser;

public:
    WebHost(HWND hWnd) : m_cRef(1), m_hWnd(hWnd), m_pOleObj(nullptr), m_pWebBrowser(nullptr) {}
    ~WebHost() { Close(); }

    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void **ppvObject) override {
        if (!ppvObject) return E_POINTER;
        if (riid == IID_IUnknown || riid == IID_IOleClientSite) *ppvObject = static_cast<IOleClientSite*>(this);
        else if (riid == IID_IOleInPlaceSite || riid == IID_IOleWindow) *ppvObject = static_cast<IOleInPlaceSite*>(this);
        else if (riid == IID_IOleInPlaceFrame || riid == IID_IOleInPlaceUIWindow) *ppvObject = static_cast<IOleInPlaceFrame*>(this);
        else { *ppvObject = nullptr; return E_NOINTERFACE; }
        AddRef();
        return S_OK;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return InterlockedIncrement(&m_cRef); }
    ULONG STDMETHODCALLTYPE Release() override {
        LONG res = InterlockedDecrement(&m_cRef);
        if (res == 0) delete this;
        return res;
    }

    HRESULT STDMETHODCALLTYPE SaveObject() override { return S_OK; }
    HRESULT STDMETHODCALLTYPE GetMoniker(DWORD, DWORD, IMoniker**) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE GetContainer(IOleContainer**) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE ShowObject() override { return S_OK; }
    HRESULT STDMETHODCALLTYPE OnShowWindow(BOOL) override { return S_OK; }
    HRESULT STDMETHODCALLTYPE RequestNewObjectLayout() override { return E_NOTIMPL; }

    HRESULT STDMETHODCALLTYPE GetWindow(HWND *phwnd) override { *phwnd = m_hWnd; return S_OK; }
    HRESULT STDMETHODCALLTYPE ContextSensitiveHelp(BOOL) override { return E_NOTIMPL; }

    HRESULT STDMETHODCALLTYPE CanInPlaceActivate() override { return S_OK; }
    HRESULT STDMETHODCALLTYPE OnInPlaceActivate() override { return S_OK; }
    HRESULT STDMETHODCALLTYPE OnUIActivate() override { return S_OK; }
    HRESULT STDMETHODCALLTYPE GetWindowContext(IOleInPlaceFrame **ppFrame, IOleInPlaceUIWindow **ppDoc, LPRECT lprcPosRect, LPRECT lprcClipRect, LPOLEINPLACEFRAMEINFO lpFrameInfo) override {
        *ppFrame = static_cast<IOleInPlaceFrame*>(this);
        (*ppFrame)->AddRef();
        *ppDoc = nullptr;
        GetClientRect(m_hWnd, lprcPosRect);
        GetClientRect(m_hWnd, lprcClipRect);
        lpFrameInfo->fMDIApp = FALSE;
        lpFrameInfo->hwndFrame = m_hWnd;
        lpFrameInfo->haccel = nullptr;
        lpFrameInfo->cAccelEntries = 0;
        return S_OK;
    }
    HRESULT STDMETHODCALLTYPE Scroll(SIZE) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE OnUIDeactivate(BOOL) override { return S_OK; }
    HRESULT STDMETHODCALLTYPE OnInPlaceDeactivate() override { return S_OK; }
    HRESULT STDMETHODCALLTYPE DiscardUndoState() override { return S_OK; }
    HRESULT STDMETHODCALLTYPE DeactivateAndUndo() override { return S_OK; }
    HRESULT STDMETHODCALLTYPE OnPosRectChange(LPCRECT) override { return S_OK; }

    HRESULT STDMETHODCALLTYPE GetBorder(LPRECT) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE RequestBorderSpace(LPCBORDERWIDTHS) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE SetBorderSpace(LPCBORDERWIDTHS) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE SetActiveObject(IOleInPlaceActiveObject*, LPCOLESTR) override { return S_OK; }
    HRESULT STDMETHODCALLTYPE InsertMenus(HMENU, LPOLEMENUGROUPWIDTHS) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE SetMenu(HMENU, HOLEMENU, HWND) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE RemoveMenus(HMENU) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE SetStatusText(LPCOLESTR) override { return S_OK; }
    HRESULT STDMETHODCALLTYPE EnableModeless(BOOL) override { return S_OK; }
    HRESULT STDMETHODCALLTYPE TranslateAccelerator(LPMSG, WORD) override { return S_FALSE; }

    bool CreateBrowser() {
        IStorage *pStorage = nullptr;
        HRESULT hr = StgCreateDocfile(nullptr, STGM_READWRITE | STGM_SHARE_EXCLUSIVE | STGM_CREATE | STGM_DIRECT, 0, &pStorage);
        if (FAILED(hr)) return false;

        hr = OleCreate(CLSID_WebBrowser, IID_IOleObject, OLERENDER_DRAW, 0, this, pStorage, (void**)&m_pOleObj);
        pStorage->Release();
        if (FAILED(hr)) return false;

        hr = OleSetContainedObject(m_pOleObj, TRUE);
        if (FAILED(hr)) return false;
        RECT rc;
        GetClientRect(m_hWnd, &rc);
        hr = m_pOleObj->DoVerb(OLEIVERB_INPLACEACTIVATE, nullptr, this, 0, m_hWnd, &rc);
        if (FAILED(hr)) return false;
        hr = m_pOleObj->QueryInterface(IID_IWebBrowser2, (void**)&m_pWebBrowser);
        if (SUCCEEDED(hr)) m_pWebBrowser->put_Visible(VARIANT_TRUE);
        return SUCCEEDED(hr);
    }

    void Resize(int w, int h) {
        if (!m_pOleObj) return;
        IOleInPlaceObject *pInPlace = nullptr;
        if (SUCCEEDED(m_pOleObj->QueryInterface(IID_IOleInPlaceObject, (void**)&pInPlace))) {
            RECT rc = {0, 0, w, h};
            pInPlace->SetObjectRects(&rc, &rc);
            pInPlace->Release();
        }
    }

    HRESULT Navigate(const wchar_t *url) {
        if (!m_pWebBrowser) return E_UNEXPECTED;
        BSTR bstr = SysAllocString(url);
        VARIANT vEmpty;
        VariantInit(&vEmpty);
        HRESULT hr = m_pWebBrowser->Navigate(bstr, &vEmpty, &vEmpty, &vEmpty, &vEmpty);
        SysFreeString(bstr);
        return hr;
    }

    void Close() {
        if (m_pOleObj) {
            m_pOleObj->Close(OLECLOSE_NOSAVE);
            m_pOleObj->Release();
            m_pOleObj = nullptr;
        }
        if (m_pWebBrowser) {
            m_pWebBrowser->Release();
            m_pWebBrowser = nullptr;
        }
    }
};

// ---------------------------------------------------------------------------
// Global Plugin State
// ---------------------------------------------------------------------------

static HMODULE g_hModule = nullptr;
static NppData g_nppData = { nullptr, nullptr, nullptr };
static HWND g_hDockWnd = nullptr;
static WebHost *g_pWebHost = nullptr;
static bool g_coloringEnabled = true;
static bool g_autoPreviewOnSave = true;
static std::string g_lastRenderedContent;

// Where the hue-md CLI and the demo file live, in this order:
//   1. HUE_MD_ROOT, a clone of the hue-md repository (for development);
//   2. next to this DLL: hue-md.cjs and demo.hue.md ship in the release zip;
//   3. the hue-md npm package, through npx.
static std::wstring dllDir() {
    wchar_t path[MAX_PATH] = { 0 };
    ::GetModuleFileNameW(g_hModule, path, MAX_PATH);
    ::PathRemoveFileSpecW(path);
    return std::wstring(path);
}

static std::wstring hueRootFromEnv() {
    wchar_t buf[MAX_PATH] = { 0 };
    DWORD n = ::GetEnvironmentVariableW(L"HUE_MD_ROOT", buf, MAX_PATH);
    return (n > 0 && n < MAX_PATH) ? std::wstring(buf) : std::wstring();
}

static std::wstring hueCliCommand() {
    std::wstring root = hueRootFromEnv();
    if (!root.empty()) {
        std::wstring cli = root + L"\\packages\\md-hue\\bin\\md-hue.js";
        if (::PathFileExistsW(cli.c_str())) return L"node.exe \"" + cli + L"\"";
    }
    std::wstring bundled = dllDir() + L"\\hue-md.cjs";
    if (::PathFileExistsW(bundled.c_str())) return L"node.exe \"" + bundled + L"\"";
    return L"cmd.exe /c npx --yes hue-md";
}

static std::wstring demoFilePath() {
    std::wstring root = hueRootFromEnv();
    if (!root.empty()) {
        std::wstring demo = root + L"\\demo\\demo.hue.md";
        if (::PathFileExistsW(demo.c_str())) return demo;
    }
    return dllDir() + L"\\demo.hue.md";
}

enum MenuIndex {
    CMD_TOGGLE_DOCK_PREVIEW = 0,
    CMD_OPEN_BROWSER = 1,
    CMD_AUTO_PREVIEW_SAVE = 2,
    CMD_DOWNGRADE_GITHUB = 3,
    CMD_INSERT_INFO_BOX = 4,
    CMD_INSERT_WARN_BOX = 5,
    CMD_INSERT_OK_BOX = 6,
    CMD_INSERT_NOTE_BOX = 7,
    CMD_TOGGLE_COLORING = 8,
    CMD_OPEN_DEMO = 9,
    CMD_ABOUT = 10,
    CMD_COUNT = 11
};

static FuncItem g_funcItems[CMD_COUNT];
static ShortcutKey g_previewShortcut = { true, false, true, 'H' };   // Ctrl+Shift+H -> Side-by-Side Docked Preview
static ShortcutKey g_downgradeShortcut = { true, false, true, 'G' }; // Ctrl+Shift+G -> Downgrade to GitHub

// Forward declarations
void __cdecl cmdToggleDockPreview();
void __cdecl cmdOpenBrowserPreview();
void __cdecl cmdToggleAutoPreview();
void __cdecl cmdDowngradeToGitHub();
void __cdecl cmdInsertInfoBox();
void __cdecl cmdInsertWarnBox();
void __cdecl cmdInsertOkBox();
void __cdecl cmdInsertNoteBox();
void __cdecl cmdToggleColoring();
void __cdecl cmdOpenDemo();
void __cdecl cmdAbout();
void updateDockedPreview(bool force = false);

static HWND getCurrentScintilla() {
    if (!g_nppData._nppHandle) return nullptr;
    int which = 0;
    ::SendMessage(g_nppData._nppHandle, NPPM_GETCURRENTSCINTILLA, 0, (LPARAM)&which);
    return (which == 0) ? g_nppData._scintillaMainHandle : g_nppData._scintillaSecondHandle;
}

static bool isEditorDark(HWND sci) {
    COLORREF bg = (COLORREF)::SendMessage(sci, SCI_STYLEGETBACK, STYLE_DEFAULT, 0);
    int r = GetRValue(bg);
    int g = GetGValue(bg);
    int b = GetBValue(bg);
    return (r + g + b) < 384;
}

static void setupIndicators(HWND sci) {
    if (!sci) return;
    bool dark = isEditorDark(sci);

    for (int i = 0; i < HUE_COLOR_COUNT; ++i) {
        int fgInd = INDIC_HUE_FG_BASE + i;
        uint32_t fgRgb = dark ? kPalette[i].darkFg : kPalette[i].lightFg;
        ::SendMessage(sci, SCI_INDICSETSTYLE, fgInd, INDIC_TEXTFORE);
        ::SendMessage(sci, SCI_INDICSETFORE,  fgInd, HexToBgr(fgRgb));
        ::SendMessage(sci, SCI_INDICSETUNDER, fgInd, 1);

        int bgInd = INDIC_HUE_BG_BASE + i;
        uint32_t bgRgb = dark ? kPalette[i].darkBg : kPalette[i].lightBg;
        ::SendMessage(sci, SCI_INDICSETSTYLE, bgInd, INDIC_ROUNDBOX);
        ::SendMessage(sci, SCI_INDICSETFORE,  bgInd, HexToBgr(bgRgb));
        ::SendMessage(sci, SCI_INDICSETALPHA, bgInd, dark ? 180 : 220);
        ::SendMessage(sci, SCI_INDICSETOUTLINEALPHA, bgInd, dark ? 80 : 100);
        ::SendMessage(sci, SCI_INDICSETUNDER, bgInd, 1);
    }

    ::SendMessage(sci, SCI_INDICSETSTYLE, INDIC_HUE_HEX_FG, INDIC_TEXTFORE);
    ::SendMessage(sci, SCI_INDICSETFLAGS, INDIC_HUE_HEX_FG, SC_INDICFLAG_VALUEFORE);
    ::SendMessage(sci, SCI_INDICSETUNDER, INDIC_HUE_HEX_FG, 1);

    ::SendMessage(sci, SCI_INDICSETSTYLE, INDIC_HUE_HEX_BG, INDIC_ROUNDBOX);
    ::SendMessage(sci, SCI_INDICSETFLAGS, INDIC_HUE_HEX_BG, SC_INDICFLAG_VALUEFORE);
    ::SendMessage(sci, SCI_INDICSETALPHA, INDIC_HUE_HEX_BG, 200);
    ::SendMessage(sci, SCI_INDICSETOUTLINEALPHA, INDIC_HUE_HEX_BG, 90);
    ::SendMessage(sci, SCI_INDICSETUNDER, INDIC_HUE_HEX_BG, 1);

    COLORREF bodyFg = dark ? RGB(230, 237, 243) : RGB(31, 35, 40);
    ::SendMessage(sci, SCI_INDICSETSTYLE, INDIC_HUE_BODY_FG, INDIC_TEXTFORE);
    ::SendMessage(sci, SCI_INDICSETFORE,  INDIC_HUE_BODY_FG, bodyFg);
    ::SendMessage(sci, SCI_INDICSETUNDER, INDIC_HUE_BODY_FG, 1);
}

static void clearAllHueIndicators(HWND sci, Sci_Position len) {
    if (!sci || len <= 0) return;
    for (int ind = INDIC_HUE_FIRST; ind <= INDIC_HUE_LAST; ++ind) {
        ::SendMessage(sci, SCI_SETINDICATORCURRENT, ind, 0);
        ::SendMessage(sci, SCI_INDICATORCLEARRANGE, 0, len);
    }
}

static inline bool isWordChar(char c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_';
}

static inline bool isHexDigit(char c) {
    return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
}

static int resolveColorName(const std::string &name) {
    if (name == "red"    || name == "danger" || name == "!") return HUE_RED;
    if (name == "orange" || name == "warn")                  return HUE_ORANGE;
    if (name == "yellow")                                    return HUE_YELLOW;
    if (name == "green"  || name == "ok")                    return HUE_GREEN;
    if (name == "blue"   || name == "info")                  return HUE_BLUE;
    if (name == "purple" || name == "note")                  return HUE_PURPLE;
    if (name == "gray"   || name == "grey"  || name == "muted") return HUE_GRAY;
    return HUE_NONE;
}

static bool parseHex6(const std::string &s, uint32_t &outRgb) {
    if (s.size() != 6) return false;
    uint32_t val = 0;
    for (char c : s) {
        if (!isHexDigit(c)) return false;
        val <<= 4;
        if (c >= '0' && c <= '9') val |= (c - '0');
        else if (c >= 'a' && c <= 'f') val |= (c - 'a' + 10);
        else if (c >= 'A' && c <= 'F') val |= (c - 'A' + 10);
    }
    outRgb = val;
    return true;
}

static bool parseColorToken(const std::string &tok, int &fgId, int &bgId, uint32_t &hexFg, uint32_t &hexBg) {
    fgId = HUE_NONE;
    bgId = HUE_NONE;
    hexFg = 0;
    hexBg = 0;

    // Inline diff spans: {+: added} (green) and {-: removed} (red)
    if (tok == "+") {
        fgId = HUE_GREEN;
        bgId = HUE_GREEN;
        return true;
    }
    if (tok == "-") {
        fgId = HUE_RED;
        bgId = HUE_RED;
        return true;
    }

    std::vector<std::string> parts;
    std::string cur;
    for (char c : tok) {
        if (c == ' ' || c == '\t') {
            if (!cur.empty()) { parts.push_back(cur); cur.clear(); }
        } else {
            cur.push_back(c);
        }
    }
    if (!cur.empty()) parts.push_back(cur);
    if (parts.empty()) return false;

    for (const auto &p : parts) {
        if (p.rfind("bg-", 0) == 0) {
            std::string sub = p.substr(3);
            if (!sub.empty() && sub[0] == '#') {
                uint32_t rgb = 0;
                if (parseHex6(sub.substr(1), rgb)) {
                    hexBg = rgb;
                } else {
                    return false;
                }
            } else {
                int cId = resolveColorName(sub);
                if (cId == HUE_NONE) return false;
                bgId = cId;
            }
        } else if (p[0] == '#') {
            uint32_t rgb = 0;
            if (parseHex6(p.substr(1), rgb)) {
                hexFg = rgb;
            } else {
                return false;
            }
        } else {
            int cId = resolveColorName(p);
            if (cId == HUE_NONE) return false;
            fgId = cId;
        }
    }

    return (fgId != HUE_NONE) || (bgId != HUE_NONE) || (hexFg != 0) || (hexBg != 0);
}

struct SpanMatch {
    Sci_Position openPos;
    Sci_Position closePos;
    Sci_Position colonPos;
    Sci_Position contentStart;
    Sci_Position contentLen;
    int fgId;
    int bgId;
    uint32_t hexFg;
    uint32_t hexBg;
};

static void parseInlineTags(const char *buf, Sci_Position len, std::vector<SpanMatch> &spans) {
    Sci_Position i = 0;
    while (i < len) {
        if (buf[i] != '{') { i++; continue; }
        Sci_Position openPos = i;
        i++;
        while (i < len && (buf[i] == ' ' || buf[i] == '\t')) i++;
        Sci_Position tokStart = i;
        while (i < len && buf[i] != ':' && buf[i] != '}' && buf[i] != '\n' && buf[i] != '\r') i++;
        if (i >= len || buf[i] != ':') { continue; }
        Sci_Position tokEnd = i;
        while (tokEnd > tokStart && (buf[tokEnd - 1] == ' ' || buf[tokEnd - 1] == '\t')) tokEnd--;
        if (tokEnd <= tokStart) { i++; continue; }
        std::string tag(buf + tokStart, tokEnd - tokStart);

        int fgId = HUE_NONE, bgId = HUE_NONE;
        uint32_t hexFg = 0, hexBg = 0;
        if (!parseColorToken(tag, fgId, bgId, hexFg, hexBg)) {
            i++;
            continue;
        }

        Sci_Position colonPos = i;
        i++;
        int depth = 1;
        Sci_Position closePos = -1;
        while (i < len) {
            char c = buf[i];
            if (c == '\n' || c == '\r') break;
            if (c == '{') depth++;
            else if (c == '}') {
                depth--;
                if (depth == 0) {
                    closePos = i;
                    break;
                }
            }
            i++;
        }

        if (closePos != -1 && closePos > colonPos) {
            Sci_Position cStart = colonPos + 1;
            while (cStart < closePos && (buf[cStart] == ' ' || buf[cStart] == '\t')) cStart++;
            Sci_Position cEnd = closePos;
            while (cEnd > cStart && (buf[cEnd - 1] == ' ' || buf[cEnd - 1] == '\t')) cEnd--;

            SpanMatch sm;
            sm.openPos = openPos;
            sm.colonPos = colonPos;
            sm.closePos = closePos;
            sm.contentStart = cStart;
            sm.contentLen = (cEnd > cStart) ? (cEnd - cStart) : 0;
            sm.fgId = fgId;
            sm.bgId = bgId;
            sm.hexFg = hexFg;
            sm.hexBg = hexBg;
            spans.push_back(sm);
            i = closePos + 1;
        }
    }
}

struct BoxMatch {
    Sci_Position startPos;
    Sci_Position endPos;
    int colorId;
};

static int extractBoxHeaderColor(const std::string &seg) {
    size_t p = 0;
    while (p < seg.size() && (seg[p] == '+' || seg[p] == '-' || seg[p] == '=' || (unsigned char)seg[p] >= 0x80)) p++;
    while (p < seg.size() && (seg[p] == ' ' || seg[p] == '\t')) p++;
    std::string rem = seg.substr(p);
    std::string firstWord;
    size_t sp = rem.find_first_of(" \t-\r\n+");
    if (sp != std::string::npos) firstWord = rem.substr(0, sp);
    else firstWord = rem;

    int colorId = resolveColorName(firstWord);
    return (colorId != HUE_NONE) ? colorId : HUE_GRAY;
}

static bool isTopHeaderStart(const std::string &s, size_t pos = 0) {
    if (pos >= s.size()) return false;
    std::string sub = s.substr(pos);
    return (sub.rfind("┌", 0) == 0 || sub.rfind("╭", 0) == 0 || sub.rfind("+--", 0) == 0 || sub.rfind("+==", 0) == 0);
}

static bool isBottomBorderStart(const std::string &s) {
    size_t p = 0;
    while (p < s.size() && (s[p] == ' ' || s[p] == '\t')) p++;
    if (p >= s.size()) return false;
    std::string sub = s.substr(p);
    return (sub.rfind("└", 0) == 0 || sub.rfind("╰", 0) == 0 || sub.rfind("+--", 0) == 0 || sub.rfind("+==", 0) == 0);
}

static void findDrawnBoxes(const char *buf, Sci_Position len, std::vector<BoxMatch> &boxes) {
    std::vector<std::pair<Sci_Position, Sci_Position>> lines;
    Sci_Position lineStart = 0;
    for (Sci_Position i = 0; i <= len; ++i) {
        if (i == len || buf[i] == '\n') {
            Sci_Position lineEnd = i;
            if (lineEnd > lineStart && buf[lineEnd - 1] == '\r') lineEnd--;
            lines.push_back({ lineStart, lineEnd });
            lineStart = i + 1;
        }
    }

    size_t nLines = lines.size();
    size_t idx = 0;
    while (idx < nLines) {
        Sci_Position s = lines[idx].first;
        Sci_Position e = lines[idx].second;
        if (e - s < 3) { idx++; continue; }

        std::string l(buf + s, e - s);
        if (isTopHeaderStart(l, 0)) {
            std::vector<size_t> colStarts = { 0 };
            for (size_t pos = 3; pos + 3 <= l.size(); ++pos) {
                if (l[pos] != ' ' && l[pos - 1] == ' ' && l[pos - 2] == ' ' && isTopHeaderStart(l, pos)) {
                    colStarts.push_back(pos);
                }
            }

            std::vector<int> colColors;
            for (size_t c = 0; c < colStarts.size(); ++c) {
                size_t cStart = colStarts[c];
                size_t cEnd = (c + 1 < colStarts.size()) ? colStarts[c + 1] : l.size();
                colColors.push_back(extractBoxHeaderColor(l.substr(cStart, cEnd - cStart)));
            }

            size_t botIdx = idx + 1;
            bool foundBottom = false;
            while (botIdx < nLines && (botIdx - idx) < 200) {
                Sci_Position bs = lines[botIdx].first;
                Sci_Position be = lines[botIdx].second;
                std::string bl(buf + bs, be - bs);
                if (isBottomBorderStart(bl)) {
                    foundBottom = true;
                    break;
                }
                botIdx++;
            }

            if (foundBottom) {
                if (colStarts.size() == 1) {
                    BoxMatch bm;
                    bm.startPos = lines[idx].first;
                    bm.endPos = lines[botIdx].second;
                    bm.colorId = colColors[0];
                    boxes.push_back(bm);
                } else {
                    for (size_t row = idx; row <= botIdx; ++row) {
                        Sci_Position rs = lines[row].first;
                        Sci_Position re = lines[row].second;
                        size_t rowLen = (size_t)(re - rs);
                        for (size_t c = 0; c < colStarts.size(); ++c) {
                            size_t cStart = colStarts[c];
                            if (cStart >= rowLen) continue;
                            size_t cEnd = (c + 1 < colStarts.size()) ? std::min(rowLen, colStarts[c + 1] - 2) : rowLen;
                            while (cEnd > cStart && (buf[rs + cEnd - 1] == ' ' || buf[rs + cEnd - 1] == '\t')) cEnd--;
                            if (cEnd > cStart) {
                                BoxMatch bm;
                                bm.startPos = rs + (Sci_Position)cStart;
                                bm.endPos = rs + (Sci_Position)cEnd;
                                bm.colorId = colColors[c];
                                boxes.push_back(bm);
                            }
                        }
                    }
                }
                idx = botIdx + 1;
                continue;
            }
        }
        idx++;
    }
}

static void colorAccConstructs(HWND sci, const char *buf, Sci_Position len) {
    Sci_Position i = 0;
    while (i < len) {
        if ((i == 0 || buf[i - 1] == '\n') && i + 5 < len) {
            Sci_Position p = i;
            while (p < len && (buf[p] == ' ' || buf[p] == '\t')) p++;
            if (p < len && (buf[p] == '-' || buf[p] == '*' || buf[p] == '+') && (buf[p + 1] == ' ' || buf[p + 1] == '\t')) {
                p += 2;
                while (p < len && (buf[p] == ' ' || buf[p] == '\t')) p++;
                if (p + 3 < len && buf[p] == '[' && buf[p + 2] == ']' && (buf[p + 3] == ' ' || buf[p + 3] == '\t')) {
                    char m = buf[p + 1];
                    int cId = HUE_NONE;
                    if (m == 'x' || m == 'X') cId = HUE_GREEN;
                    else if (m == '-') cId = HUE_BLUE;
                    else if (m == '!') cId = HUE_RED;
                    else if (m == '?') cId = HUE_PURPLE;
                    else if (m == ' ') cId = HUE_GRAY;
                    if (cId != HUE_NONE) {
                        ::SendMessage(sci, SCI_SETINDICATORCURRENT, INDIC_HUE_BG_BASE + cId, 0);
                        ::SendMessage(sci, SCI_INDICATORFILLRANGE, p, 3);
                        ::SendMessage(sci, SCI_SETINDICATORCURRENT, INDIC_HUE_FG_BASE + cId, 0);
                        ::SendMessage(sci, SCI_INDICATORFILLRANGE, p, 3);
                    }
                }
            }
        }

        if (i + 4 < len && buf[i] == '[' && buf[i + 1] == '[') {
            Sci_Position close = i + 2;
            while (close + 1 < len && close - i < 34 && buf[close] != '\n' && buf[close] != '\r' && buf[close] != '[' && !(buf[close] == ']' && buf[close + 1] == ']')) {
                close++;
            }
            if (close + 1 < len && buf[close] == ']' && buf[close + 1] == ']' && close > i + 2) {
                Sci_Position kLen = (close + 2) - i;
                ::SendMessage(sci, SCI_SETINDICATORCURRENT, INDIC_HUE_BG_BASE + HUE_GRAY, 0);
                ::SendMessage(sci, SCI_INDICATORFILLRANGE, i, kLen);
                ::SendMessage(sci, SCI_SETINDICATORCURRENT, INDIC_HUE_FG_BASE + HUE_BLUE, 0);
                ::SendMessage(sci, SCI_INDICATORFILLRANGE, i + 2, close - (i + 2));
                i = close + 2;
                continue;
            }
        }

        if (buf[i] == '[' && (i == 0 || buf[i - 1] != '[')) {
            Sci_Position p = i + 1;
            int filled = 0, empty = 0;
            while (p < len && (buf[p] == '=' || buf[p] == '#')) { filled++; p++; }
            while (p < len && (buf[p] == '.' || buf[p] == '-' || buf[p] == '_')) { empty++; p++; }
            int total = filled + empty;
            if (total >= 4 && total <= 40 && p < len && buf[p] == ']') {
                p++;
                while (p < len && buf[p] == ' ') p++;
                Sci_Position numStart = p;
                int pct = 0;
                while (p < len && buf[p] >= '0' && buf[p] <= '9') {
                    pct = pct * 10 + (buf[p] - '0');
                    p++;
                }
                if (p > numStart && p < len && buf[p] == '%' && pct >= 0 && pct <= 100) {
                    int cId = (pct >= 100) ? HUE_GREEN : (pct >= 50) ? HUE_BLUE : (pct >= 25) ? HUE_ORANGE : HUE_RED;
                    ::SendMessage(sci, SCI_SETINDICATORCURRENT, INDIC_HUE_BG_BASE + cId, 0);
                    ::SendMessage(sci, SCI_INDICATORFILLRANGE, i, (p + 1) - i);
                    if (filled > 0) {
                        ::SendMessage(sci, SCI_SETINDICATORCURRENT, INDIC_HUE_FG_BASE + cId, 0);
                        ::SendMessage(sci, SCI_INDICATORFILLRANGE, i + 1, filled);
                    }
                    ::SendMessage(sci, SCI_SETINDICATORCURRENT, INDIC_HUE_FG_BASE + cId, 0);
                    ::SendMessage(sci, SCI_INDICATORFILLRANGE, numStart, (p + 1) - numStart);
                    i = p + 1;
                    continue;
                }
            }
        }

        i++;
    }
}

static void refreshHueColoring(bool forceReconfig = false) {
    if (!g_coloringEnabled) return;
    HWND sci = getCurrentScintilla();
    if (!sci) return;

    if (forceReconfig) {
        setupIndicators(sci);
    }

    Sci_Position len = (Sci_Position)::SendMessage(sci, SCI_GETLENGTH, 0, 0);
    if (len <= 0) return;

    const char *buf = (const char *)::SendMessage(sci, SCI_GETCHARACTERPOINTER, 0, 0);
    if (!buf) return;

    clearAllHueIndicators(sci, len);

    std::vector<BoxMatch> boxes;
    findDrawnBoxes(buf, len, boxes);
    for (const auto &box : boxes) {
        if (box.endPos <= box.startPos) continue;
        int bgInd = INDIC_HUE_BG_BASE + box.colorId;
        ::SendMessage(sci, SCI_SETINDICATORCURRENT, bgInd, 0);
        ::SendMessage(sci, SCI_INDICATORFILLRANGE, box.startPos, box.endPos - box.startPos);
    }

    colorAccConstructs(sci, buf, len);

    std::vector<SpanMatch> spans;
    parseInlineTags(buf, len, spans);
    for (const auto &sp : spans) {
        Sci_Position spanLen = sp.closePos - sp.openPos + 1;
        if (spanLen <= 0) continue;

        if (sp.hexBg != 0) {
            ::SendMessage(sci, SCI_SETINDICATORCURRENT, INDIC_HUE_HEX_BG, 0);
            ::SendMessage(sci, SCI_SETINDICATORVALUE, (LPARAM)(HexToBgr(sp.hexBg) | SC_INDICVALUEBIT), 0);
            ::SendMessage(sci, SCI_INDICATORFILLRANGE, sp.openPos, spanLen);
        } else if (sp.bgId != HUE_NONE) {
            int bgInd = INDIC_HUE_BG_BASE + sp.bgId;
            ::SendMessage(sci, SCI_SETINDICATORCURRENT, bgInd, 0);
            ::SendMessage(sci, SCI_INDICATORFILLRANGE, sp.openPos, spanLen);
        }

        if (sp.hexFg != 0 && sp.contentLen > 0) {
            ::SendMessage(sci, SCI_SETINDICATORCURRENT, INDIC_HUE_HEX_FG, 0);
            ::SendMessage(sci, SCI_SETINDICATORVALUE, (LPARAM)(HexToBgr(sp.hexFg) | SC_INDICVALUEBIT), 0);
            ::SendMessage(sci, SCI_INDICATORFILLRANGE, sp.contentStart, sp.contentLen);
        } else if (sp.fgId != HUE_NONE && sp.contentLen > 0) {
            int fgInd = INDIC_HUE_FG_BASE + sp.fgId;
            ::SendMessage(sci, SCI_SETINDICATORCURRENT, fgInd, 0);
            ::SendMessage(sci, SCI_INDICATORFILLRANGE, sp.contentStart, sp.contentLen);
        } else if (sp.bgId != HUE_NONE || sp.hexBg != 0) {
            ::SendMessage(sci, SCI_SETINDICATORCURRENT, INDIC_HUE_BODY_FG, 0);
            ::SendMessage(sci, SCI_INDICATORFILLRANGE, sp.openPos, spanLen);
        }
    }
}

// ---------------------------------------------------------------------------
// HTML Generation & Live Docked Preview
// ---------------------------------------------------------------------------

static std::string getBufferUtf8(HWND sci) {
    if (!sci) return "";
    Sci_Position len = (Sci_Position)::SendMessage(sci, SCI_GETLENGTH, 0, 0);
    if (len <= 0) return "";
    std::string str;
    str.resize(len);
    const char *ptr = (const char *)::SendMessage(sci, SCI_GETCHARACTERPOINTER, 0, 0);
    if (ptr) {
        memcpy(&str[0], ptr, len);
    }
    return str;
}

static bool writeUtf8File(const std::wstring &path, const std::string &content) {
    FILE *f = nullptr;
    errno_t err = _wfopen_s(&f, path.c_str(), L"wb");
    if (err != 0 || !f) return false;
    fwrite(content.data(), 1, content.size(), f);
    fclose(f);
    return true;
}

static bool readUtf8File(const std::wstring &path, std::string &content) {
    FILE *f = nullptr;
    errno_t err = _wfopen_s(&f, path.c_str(), L"rb");
    if (err != 0 || !f) return false;
    fseek(f, 0, SEEK_END);
    long sz = ftell(f);
    fseek(f, 0, SEEK_SET);
    content.resize(sz);
    if (sz > 0) {
        fread(&content[0], 1, sz, f);
    }
    fclose(f);
    return true;
}

static bool runProcessHidden(const std::wstring &cmdLine) {
    STARTUPINFOW si = { sizeof(si) };
    si.dwFlags = STARTF_USESHOWWINDOW;
    si.wShowWindow = SW_HIDE;
    PROCESS_INFORMATION pi = { 0 };
    std::vector<wchar_t> cmdBuf(cmdLine.begin(), cmdLine.end());
    cmdBuf.push_back(0);

    BOOL ok = ::CreateProcessW(
        nullptr, cmdBuf.data(), nullptr, nullptr, FALSE,
        CREATE_NO_WINDOW, nullptr, nullptr, &si, &pi
    );
    if (!ok) return false;
    ::WaitForSingleObject(pi.hProcess, 5000);
    DWORD exitCode = 1;
    ::GetExitCodeProcess(pi.hProcess, &exitCode);
    ::CloseHandle(pi.hProcess);
    ::CloseHandle(pi.hThread);
    return (exitCode == 0);
}

void updateDockedPreview(bool force) {
    if (!g_hDockWnd) return;
    // Activate the OLE control only after docking has reparented and shown it.
    if (!g_pWebHost) {
        g_pWebHost = new WebHost(g_hDockWnd);
        if (!g_pWebHost->CreateBrowser()) {
            delete g_pWebHost;
            g_pWebHost = nullptr;
            ::MessageBoxW(g_nppData._nppHandle, L"The embedded browser could not be initialized. Use Plugins > Hue Markdown > Open HTML Preview in Browser.", L"Hue Markdown preview error", MB_OK | MB_ICONERROR);
            return;
        }
    }
    HWND sci = getCurrentScintilla();
    if (!sci) return;

    std::string content = getBufferUtf8(sci);
    if (!force && content == g_lastRenderedContent) {
        return;
    }
    g_lastRenderedContent = content;

    wchar_t tempDir[MAX_PATH] = { 0 };
    ::GetTempPathW(MAX_PATH, tempDir);
    std::wstring inFile = std::wstring(tempDir) + L"hue-dock-preview-in.hue.md";
    std::wstring outFile = std::wstring(tempDir) + L"hue-dock-preview.html";

    if (!writeUtf8File(inFile, content)) return;

    std::wstring cmd = hueCliCommand() + L" html \"" + inFile + L"\" --standalone -o \"" + outFile + L"\"";

    bool renderedWithNode = runProcessHidden(cmd);
    std::string htmlContent;
    if (renderedWithNode && readUtf8File(outFile, htmlContent)) {
        // Inject IE-edge meta and static fallback styling for embedded WebBrowser
        std::string injectMeta = "<meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">\n"
            "<style>\n"
            "body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 18px; margin: 0; line-height: 1.6; }\n"
            ".hue-box { border-left: 4px solid #57606a; background: #f6f8fa; padding: 10px 14px; margin: 14px 0; border-radius: 6px; }\n"
            ".hue-box p { white-space: pre-line; }\n"
            ".hue-box-title { font-weight: 600; margin-bottom: 6px; }\n"
            ".hue-red { color: #b42318; font-weight: 600; }\n"
            ".hue-bg-red { background: #fde8e7; color: #1f2328; padding: 2px 6px; border-radius: 4px; }\n"
            ".hue-box-red { border-left: 4px solid #b42318; background: #fde8e7; }\n"
            ".hue-box-red > .hue-box-title { color: #b42318; }\n"
            ".hue-orange { color: #b54708; font-weight: 600; }\n"
            ".hue-bg-orange { background: #fdeedc; color: #1f2328; padding: 2px 6px; border-radius: 4px; }\n"
            ".hue-box-orange { border-left: 4px solid #b54708; background: #fdeedc; }\n"
            ".hue-box-orange > .hue-box-title { color: #b54708; }\n"
            ".hue-yellow { color: #7a5a00; font-weight: 600; }\n"
            ".hue-bg-yellow { background: #fdf6d3; color: #1f2328; padding: 2px 6px; border-radius: 4px; }\n"
            ".hue-box-yellow { border-left: 4px solid #7a5a00; background: #fdf6d3; }\n"
            ".hue-box-yellow > .hue-box-title { color: #7a5a00; }\n"
            ".hue-green { color: #067647; font-weight: 600; }\n"
            ".hue-bg-green { background: #dcf5e7; color: #1f2328; padding: 2px 6px; border-radius: 4px; }\n"
            ".hue-box-green { border-left: 4px solid #067647; background: #dcf5e7; }\n"
            ".hue-box-green > .hue-box-title { color: #067647; }\n"
            ".hue-blue { color: #175cd3; font-weight: 600; }\n"
            ".hue-bg-blue { background: #e0ecfd; color: #1f2328; padding: 2px 6px; border-radius: 4px; }\n"
            ".hue-box-blue { border-left: 4px solid #175cd3; background: #e0ecfd; }\n"
            ".hue-box-blue > .hue-box-title { color: #175cd3; }\n"
            ".hue-purple { color: #6941c6; font-weight: 600; }\n"
            ".hue-bg-purple { background: #efe7fd; color: #1f2328; padding: 2px 6px; border-radius: 4px; }\n"
            ".hue-box-purple { border-left: 4px solid #6941c6; background: #efe7fd; }\n"
            ".hue-box-purple > .hue-box-title { color: #6941c6; }\n"
            ".hue-gray { color: #57606a; font-weight: 600; }\n"
            ".hue-bg-gray { background: #eef0f2; color: #1f2328; padding: 2px 6px; border-radius: 4px; }\n"
            ".hue-box-gray { border-left: 4px solid #57606a; background: #eef0f2; }\n"
            ".hue-box-gray > .hue-box-title { color: #57606a; }\n"
            "</style>\n";

        size_t headPos = htmlContent.find("<head>");
        if (headPos != std::string::npos) {
            htmlContent.insert(headPos + 6, "\n" + injectMeta);
        }
        writeUtf8File(outFile, htmlContent);
    } else {
        std::string escaped;
        escaped.reserve(content.size());
        for (char c : content) {
            switch (c) {
                case '&': escaped += "&amp;"; break;
                case '<': escaped += "&lt;"; break;
                case '>': escaped += "&gt;"; break;
                case '"': escaped += "&quot;"; break;
                default:  escaped.push_back(c); break;
            }
        }
        std::string fallback = "<!doctype html><html><head><meta charset=\"utf-8\"><meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\"><title>Hue Preview</title><style>body{font-family:sans-serif;padding:16px;}</style></head><body><pre>" + escaped + "</pre></body></html>";
        writeUtf8File(outFile, fallback);
    }

    if (FAILED(g_pWebHost->Navigate(outFile.c_str()))) {
        ::MessageBoxW(g_nppData._nppHandle, L"The embedded browser could not open the rendered HTML file.", L"Hue Markdown preview error", MB_OK | MB_ICONERROR);
    }
}

// ---------------------------------------------------------------------------
// Menu Commands
// ---------------------------------------------------------------------------

void __cdecl cmdToggleDockPreview() {
    if (!g_hDockWnd) return;
    if (::IsWindowVisible(g_hDockWnd)) {
        ::SendMessage(g_nppData._nppHandle, NPPM_DMMHIDE, 0, (LPARAM)g_hDockWnd);
    } else {
        ::SendMessage(g_nppData._nppHandle, NPPM_DMMSHOW, 0, (LPARAM)g_hDockWnd);
        updateDockedPreview(true);
    }
}

void __cdecl cmdOpenBrowserPreview() {
    HWND sci = getCurrentScintilla();
    if (!sci) return;
    std::string content = getBufferUtf8(sci);
    wchar_t tempDir[MAX_PATH] = { 0 };
    ::GetTempPathW(MAX_PATH, tempDir);
    std::wstring inFile = std::wstring(tempDir) + L"hue-browser-preview-in.hue.md";
    std::wstring outFile = std::wstring(tempDir) + L"hue-browser-preview.html";

    if (!writeUtf8File(inFile, content)) return;

    std::wstring cmd = hueCliCommand() + L" html \"" + inFile + L"\" --standalone -o \"" + outFile + L"\"";
    runProcessHidden(cmd);

    ::ShellExecuteW(g_nppData._nppHandle, L"open", outFile.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
}

void __cdecl cmdToggleAutoPreview() {
    g_autoPreviewOnSave = !g_autoPreviewOnSave;
    ::SendMessage(g_nppData._nppHandle, NPPM_SETMENUITEMCHECK, g_funcItems[CMD_AUTO_PREVIEW_SAVE]._cmdID, g_autoPreviewOnSave ? TRUE : FALSE);
}

void __cdecl cmdDowngradeToGitHub() {
    HWND sci = getCurrentScintilla();
    if (!sci) return;

    std::string content = getBufferUtf8(sci);
    wchar_t tempDir[MAX_PATH] = { 0 };
    ::GetTempPathW(MAX_PATH, tempDir);
    std::wstring inFile = std::wstring(tempDir) + L"hue-npp-downgrade-in.hue.md";
    std::wstring outFile = std::wstring(tempDir) + L"hue-npp-downgrade-out.md";

    if (!writeUtf8File(inFile, content)) return;

    std::wstring cmd = hueCliCommand() + L" downgrade \"" + inFile + L"\" -o \"" + outFile + L"\"";

    if (runProcessHidden(cmd)) {
        std::string downgraded;
        if (readUtf8File(outFile, downgraded)) {
            ::SendMessage(g_nppData._nppHandle, NPPM_MENUCOMMAND, 0, IDM_FILE_NEW);
            HWND newSci = getCurrentScintilla();
            if (newSci) {
                ::SendMessage(newSci, SCI_SETTEXT, 0, (LPARAM)downgraded.c_str());
            }
        }
    } else {
        ::MessageBoxW(g_nppData._nppHandle, L"Could not run md-hue downgrade. Make sure Node.js is installed.", L"Hue Markdown", MB_OK | MB_ICONWARNING);
    }
}

void __cdecl cmdInsertInfoBox() {
    HWND sci = getCurrentScintilla();
    if (!sci) return;
    const char *snippet = "+-- info Pro Tip\n| First point\n| Second point\n+--\n";
    ::SendMessage(sci, SCI_REPLACESEL, 0, (LPARAM)snippet);
    refreshHueColoring(false);
}

void __cdecl cmdInsertWarnBox() {
    HWND sci = getCurrentScintilla();
    if (!sci) return;
    const char *snippet = "+-- warn Heads Up\n| Important warning\n+--\n";
    ::SendMessage(sci, SCI_REPLACESEL, 0, (LPARAM)snippet);
    refreshHueColoring(false);
}

void __cdecl cmdInsertOkBox() {
    HWND sci = getCurrentScintilla();
    if (!sci) return;
    const char *snippet = "+-- ok Success\n| Operation completed\n+--\n";
    ::SendMessage(sci, SCI_REPLACESEL, 0, (LPARAM)snippet);
    refreshHueColoring(false);
}

void __cdecl cmdInsertNoteBox() {
    HWND sci = getCurrentScintilla();
    if (!sci) return;
    const char *snippet = "+-- note Important\n| Remember this detail\n+--\n";
    ::SendMessage(sci, SCI_REPLACESEL, 0, (LPARAM)snippet);
    refreshHueColoring(false);
}

void __cdecl cmdToggleColoring() {
    g_coloringEnabled = !g_coloringEnabled;
    ::SendMessage(g_nppData._nppHandle, NPPM_SETMENUITEMCHECK, g_funcItems[CMD_TOGGLE_COLORING]._cmdID, g_coloringEnabled ? TRUE : FALSE);
    refreshHueColoring(true);
}

void __cdecl cmdOpenDemo() {
    std::wstring demoPath = demoFilePath();
    if (::PathFileExistsW(demoPath.c_str())) {
        ::SendMessage(g_nppData._nppHandle, NPPM_DOOPEN, 0, (LPARAM)demoPath.c_str());
        refreshHueColoring(true);
        // Automatically reveal docked side-by-side preview panel!
        if (g_hDockWnd && !::IsWindowVisible(g_hDockWnd)) {
            ::SendMessage(g_nppData._nppHandle, NPPM_DMMSHOW, 0, (LPARAM)g_hDockWnd);
        }
        updateDockedPreview(true);
    } else {
        ::MessageBoxW(g_nppData._nppHandle, demoPath.c_str(), L"Demo file not found", MB_OK | MB_ICONWARNING);
    }
}

void __cdecl cmdAbout() {
    const wchar_t *msg =
        L"Hue Markdown for Notepad++ (v0.2.5)\n\n"
        L"Integrated Side-by-Side Live Preview + In-Editor Syntax Coloring for Hue Markdown (.hue.md).\n\n"
        L"Supported syntax:\n"
        L"  • Spans: {red: text}, {warn: text}, {blue bg-gray: text}, {#c0ffee: hex}\n"
        L"  • Diff spans: {+: added text}, {-: removed text}\n"
        L"  • Multi-state tasks: - [ ], - [-], - [!], - [?], - [x]\n"
        L"  • Key caps & progress bars: [[Ctrl+Shift+H]], [========..] 80%\n"
        L"  • Drawn boxes & split columns: Unicode (┌──┐), Rounded (╭──╮), ASCII (+--)\n\n"
        L"Shortcuts:\n"
        L"  • Ctrl+Shift+H : Toggle Integrated Side-by-Side Live Preview Panel\n"
        L"  • Ctrl+Shift+G : Downgrade Current Buffer to GitHub Alerts";
    ::MessageBoxW(g_nppData._nppHandle, msg, L"About Hue Markdown", MB_OK | MB_ICONINFORMATION);
}

static void ensureBrowserEmulationEdge() {
    HKEY hKey = nullptr;
    if (::RegCreateKeyExW(
            HKEY_CURRENT_USER,
            L"Software\\Microsoft\\Internet Explorer\\Main\\FeatureControl\\FEATURE_BROWSER_EMULATION",
            0, nullptr, 0, KEY_SET_VALUE, nullptr, &hKey, nullptr) == ERROR_SUCCESS) {
        DWORD mode = 11001; // IE11 Edge mode
        ::RegSetValueExW(hKey, L"notepad++.exe", 0, REG_DWORD, (const BYTE *)&mode, sizeof(mode));
        ::RegCloseKey(hKey);
    }
}

// ---------------------------------------------------------------------------
// Docking Window Procedure
// ---------------------------------------------------------------------------

LRESULT CALLBACK DockWndProc(HWND hWnd, UINT uMsg, WPARAM wParam, LPARAM lParam) {
    switch (uMsg) {
        case WM_CREATE: {
            return 0;
        }
        case WM_SIZE: {
            if (g_pWebHost) {
                g_pWebHost->Resize(LOWORD(lParam), HIWORD(lParam));
            }
            return 0;
        }
        case WM_TIMER: {
            if (wParam == 1001) {
                ::KillTimer(hWnd, 1001);
                updateDockedPreview(false);
            }
            return 0;
        }
        case WM_DESTROY: {
            if (g_pWebHost) {
                delete g_pWebHost;
                g_pWebHost = nullptr;
            }
            return 0;
        }
    }
    return DefWindowProc(hWnd, uMsg, wParam, lParam);
}

// ---------------------------------------------------------------------------
// Exported Notepad++ Plugin Entry Points
// ---------------------------------------------------------------------------

static void initMenuItem(int idx, const wchar_t *name, PFUNCPLUGINCMD fn, bool checked, ShortcutKey *shKey) {
    wcsncpy_s(g_funcItems[idx]._itemName, nbChar, name, _TRUNCATE);
    g_funcItems[idx]._pFunc = fn;
    g_funcItems[idx]._cmdID = 0;
    g_funcItems[idx]._init2Check = checked;
    g_funcItems[idx]._pShKey = shKey;
}

extern "C" __declspec(dllexport) BOOL __cdecl isUnicode() {
    return TRUE;
}

extern "C" __declspec(dllexport) void __cdecl setInfo(NppData notpadPlusData) {
    g_nppData = notpadPlusData;
    initMenuItem(CMD_TOGGLE_DOCK_PREVIEW, L"Toggle Side-by-Side Live Preview", cmdToggleDockPreview, false, &g_previewShortcut);
    initMenuItem(CMD_OPEN_BROWSER,        L"Open HTML Preview in Browser",    cmdOpenBrowserPreview, false, nullptr);
    initMenuItem(CMD_AUTO_PREVIEW_SAVE,   L"Auto-Update Preview on Save",     cmdToggleAutoPreview,  g_autoPreviewOnSave, nullptr);
    initMenuItem(CMD_DOWNGRADE_GITHUB,    L"Downgrade to GitHub Markdown",    cmdDowngradeToGitHub,  false, &g_downgradeShortcut);
    initMenuItem(CMD_INSERT_INFO_BOX,     L"Insert Info Box (+-- info)",      cmdInsertInfoBox,      false, nullptr);
    initMenuItem(CMD_INSERT_WARN_BOX,     L"Insert Warn Box (+-- warn)",      cmdInsertWarnBox,      false, nullptr);
    initMenuItem(CMD_INSERT_OK_BOX,       L"Insert OK Box (+-- ok)",          cmdInsertOkBox,        false, nullptr);
    initMenuItem(CMD_INSERT_NOTE_BOX,     L"Insert Note Box (+-- note)",      cmdInsertNoteBox,      false, nullptr);
    initMenuItem(CMD_TOGGLE_COLORING,     L"Enable In-Editor Hue Coloring",   cmdToggleColoring,     g_coloringEnabled, nullptr);
    initMenuItem(CMD_OPEN_DEMO,           L"Open Hue Demo Document",          cmdOpenDemo,           false, nullptr);
    initMenuItem(CMD_ABOUT,               L"About Hue Markdown",              cmdAbout,              false, nullptr);
}

extern "C" __declspec(dllexport) const wchar_t * __cdecl getName() {
    return L"Hue Markdown";
}

extern "C" __declspec(dllexport) FuncItem * __cdecl getFuncsArray(int *nbF) {
    *nbF = CMD_COUNT;
    return g_funcItems;
}

extern "C" __declspec(dllexport) void __cdecl beNotified(SCNotification *notifyCode) {
    if (!notifyCode) return;
    switch (notifyCode->nmhdr.code) {
        case NPPN_READY: {
            ensureBrowserEmulationEdge();
            ::OleInitialize(NULL);

            WNDCLASSEX wc = { sizeof(WNDCLASSEX) };
            wc.lpfnWndProc = DockWndProc;
            wc.hInstance = (HINSTANCE)g_hModule;
            wc.lpszClassName = L"HueMarkdownDockWnd";
            wc.hCursor = ::LoadCursor(NULL, IDC_ARROW);
            wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
            ::RegisterClassEx(&wc);

            g_hDockWnd = ::CreateWindowEx(
                WS_EX_CONTROLPARENT,
                L"HueMarkdownDockWnd",
                L"Hue Markdown Live Preview",
                WS_CHILD | WS_CLIPSIBLINGS | WS_CLIPCHILDREN,
                0, 0, 480, 600,
                g_nppData._nppHandle,
                NULL,
                (HINSTANCE)g_hModule,
                NULL
            );

            if (g_hDockWnd) {
                static wchar_t s_moduleName[MAX_PATH] = L"hue-md.dll";
                wchar_t modPath[MAX_PATH] = { 0 };
                if (g_hModule && ::GetModuleFileNameW(g_hModule, modPath, MAX_PATH)) {
                    const wchar_t *base = ::PathFindFileNameW(modPath);
                    if (base && *base) wcsncpy_s(s_moduleName, MAX_PATH, base, _TRUNCATE);
                }
                tTbData tbData = { 0 };
                tbData.hClient = g_hDockWnd;
                tbData.pszName = L"Hue MD Live Preview";
                tbData.dlgID = CMD_TOGGLE_DOCK_PREVIEW;
                tbData.uMask = DWS_DF_CONT_RIGHT | DWS_ICONTAB;
                tbData.pszModuleName = s_moduleName;
                ::SendMessage(g_nppData._nppHandle, NPPM_DMMREGASDCKDLG, 0, (LPARAM)&tbData);
            }

            refreshHueColoring(true);
            break;
        }

        case NPPN_SHUTDOWN: {
            ::OleUninitialize();
            break;
        }

        case NPPN_BUFFERACTIVATED:
        case NPPN_FILEOPENED:
        case NPPN_WORDSTYLESUPDATED:
        case NPPN_DARKMODECHANGED:
            refreshHueColoring(true);
            if (g_hDockWnd && ::IsWindowVisible(g_hDockWnd)) {
                updateDockedPreview(true);
            }
            break;

        case NPPN_FILESAVED:
            refreshHueColoring(true);
            if (g_autoPreviewOnSave && g_hDockWnd && ::IsWindowVisible(g_hDockWnd)) {
                updateDockedPreview(true);
            }
            break;

        case SCN_UPDATEUI:
            refreshHueColoring(false);
            break;

        case SCN_MODIFIED:
            if (notifyCode->modificationType & (SC_MOD_INSERTTEXT | SC_MOD_DELETETEXT)) {
                refreshHueColoring(false);
                if (g_hDockWnd && ::IsWindowVisible(g_hDockWnd)) {
                    ::SetTimer(g_hDockWnd, 1001, 350, NULL);
                }
            }
            break;

        default:
            break;
    }
}

extern "C" __declspec(dllexport) LRESULT __cdecl messageProc(UINT /*Message*/, WPARAM /*wParam*/, LPARAM /*lParam*/) {
    return TRUE;
}

BOOL APIENTRY DllMain(HMODULE hModule, DWORD ul_reason_for_call, LPVOID /*lpReserved*/) {
    if (ul_reason_for_call == DLL_PROCESS_ATTACH) {
        g_hModule = hModule;
    }
    return TRUE;
}
