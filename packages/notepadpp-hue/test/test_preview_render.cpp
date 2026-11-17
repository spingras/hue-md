#include "../src/HueMarkdownPlugin.cpp"

struct WebHostTestAccess {
    static bool contains(WebHost &host, const wchar_t *expected) {
        IDispatch *dispatch = nullptr;
        if (!host.m_pWebBrowser || FAILED(host.m_pWebBrowser->get_Document(&dispatch)) || !dispatch) return false;
        IHTMLDocument2 *doc = nullptr;
        HRESULT hr = dispatch->QueryInterface(IID_IHTMLDocument2, reinterpret_cast<void**>(&doc));
        dispatch->Release();
        if (FAILED(hr)) return false;
        IHTMLElement *body = nullptr;
        doc->get_body(&body);
        doc->Release();
        if (!body) return false;
        BSTR text = nullptr;
        body->get_innerText(&text);
        body->Release();
        bool found = text && wcsstr(text, expected);
        SysFreeString(text);
        return found;
    }
};

int main() {
    if (FAILED(OleInitialize(nullptr))) return 1;
    HWND window = CreateWindowExW(0, L"STATIC", L"Hue preview rendering test", WS_OVERLAPPEDWINDOW,
        0, 0, 600, 400, nullptr, nullptr, GetModuleHandleW(nullptr), nullptr);
    if (!window) return 1;
    ShowWindow(window, SW_SHOWNOACTIVATE);
    int result = 1;
    {
        WebHost host(window);
        if (!host.CreateBrowser()) { printf("FAIL: browser activation\n"); return 1; }
        wchar_t temp[MAX_PATH];
        GetTempPathW(MAX_PATH, temp);
        std::wstring file = std::wstring(temp) + L"hue-render-test.html";
        std::wstring command = L"node.exe \"" + std::wstring(g_repoRoot) + L"\\packages\\md-hue\\bin\\md-hue.js\" html \"" + std::wstring(g_repoRoot) + L"\\demo\\demo.hue.md\" --standalone -o \"" + file + L"\"";
        if (!runProcessHidden(command)) { printf("FAIL: rendering Hue demo HTML\n"); return 1; }
        if (FAILED(host.Navigate(file.c_str()))) { printf("FAIL: navigation\n"); return 1; }
        DWORD deadline = GetTickCount() + 10000;
        while (static_cast<LONG>(deadline - GetTickCount()) > 0) {
            MSG message;
            while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) {
                TranslateMessage(&message);
                DispatchMessageW(&message);
            }
            if (WebHostTestAccess::contains(host, L"Hue demo") && WebHostTestAccess::contains(host, L"passing")) { result = 0; break; }
            MsgWaitForMultipleObjects(0, nullptr, FALSE, 50, QS_ALLINPUT);
        }
        DeleteFileW(file.c_str());
    }
    DestroyWindow(window);
    OleUninitialize();
    printf(result == 0 ? "PASS: actual embedded browser document rendered\n" : "FAIL: embedded browser stayed blank\n");
    return result;
}
