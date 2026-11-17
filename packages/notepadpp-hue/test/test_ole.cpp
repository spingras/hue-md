#define UNICODE
#define _UNICODE
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <ole2.h>
#include <exdisp.h>
#include <mshtml.h>
#include <mshtmhst.h>
#include <stdio.h>

#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "oleaut32.lib")
#pragma comment(lib, "user32.lib")

int main() {
    OleInitialize(NULL);
    printf("OLE initialized successfully\n");
    OleUninitialize();
    return 0;
}
