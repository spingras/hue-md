#define UNICODE
#define _UNICODE
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <ole2.h>
#include <exdisp.h>
#include <mshtml.h>
#include <stdio.h>

#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "oleaut32.lib")
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "gdi32.lib")

class WebHost : public IOleClientSite, public IOleInPlaceSite, public IOleInPlaceFrame {
    LONG m_cRef;
    HWND m_hWnd;
    IOleObject *m_pOleObj;
    IWebBrowser2 *m_pWebBrowser;

public:
    WebHost(HWND hWnd) : m_cRef(1), m_hWnd(hWnd), m_pOleObj(nullptr), m_pWebBrowser(nullptr) {}
    ~WebHost() { Close(); }

    // IUnknown
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

    // IOleClientSite
    HRESULT STDMETHODCALLTYPE SaveObject() override { return S_OK; }
    HRESULT STDMETHODCALLTYPE GetMoniker(DWORD, DWORD, IMoniker**) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE GetContainer(IOleContainer**) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE ShowObject() override { return S_OK; }
    HRESULT STDMETHODCALLTYPE OnShowWindow(BOOL) override { return S_OK; }
    HRESULT STDMETHODCALLTYPE RequestNewObjectLayout() override { return E_NOTIMPL; }

    // IOleWindow
    HRESULT STDMETHODCALLTYPE GetWindow(HWND *phwnd) override { *phwnd = m_hWnd; return S_OK; }
    HRESULT STDMETHODCALLTYPE ContextSensitiveHelp(BOOL) override { return E_NOTIMPL; }

    // IOleInPlaceSite
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

    // IOleInPlaceFrame
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
        RECT rc;
        GetClientRect(m_hWnd, &rc);
        hr = m_pOleObj->DoVerb(OLEIVERB_SHOW, nullptr, this, 0, m_hWnd, &rc);
        hr = m_pOleObj->QueryInterface(IID_IWebBrowser2, (void**)&m_pWebBrowser);
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

    void Navigate(const wchar_t *url) {
        if (!m_pWebBrowser) return;
        BSTR bstr = SysAllocString(url);
        VARIANT vEmpty;
        VariantInit(&vEmpty);
        m_pWebBrowser->Navigate(bstr, &vEmpty, &vEmpty, &vEmpty, &vEmpty);
        SysFreeString(bstr);
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

int main() {
    OleInitialize(NULL);
    HWND hWnd = CreateWindowEx(0, L"STATIC", L"test", WS_POPUP, 0, 0, 100, 100, NULL, NULL, NULL, NULL);
    WebHost *host = new WebHost(hWnd);
    bool ok = host->CreateBrowser();
    printf("CreateBrowser result: %s\n", ok ? "SUCCESS" : "FAILED");
    delete host;
    DestroyWindow(hWnd);
    OleUninitialize();
    return 0;
}
