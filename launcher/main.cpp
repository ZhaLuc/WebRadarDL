#include <winsock2.h>
#include <ws2tcpip.h>
#include <iphlpapi.h>
#include <windows.h>
#include <shellapi.h>
#include <tlhelp32.h>

#include <chrono>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <string>
#include <thread>
#include <vector>

namespace fs = std::filesystem;

struct session_state_t
{
    DWORD host_node_pid = 0;
    DWORD tunnel_pid = 0;
    DWORD browser_pid = 0;
    DWORD reader_pid = 0;
    std::wstring browser_image;
};

static session_state_t g_session;
static std::wstring g_root;
static std::wstring g_webapp;
static std::wstring g_shutdown_file;
static std::wstring g_session_file;
static std::wstring g_public_url_file;
static volatile bool g_shutdown_requested = false;

static DWORD get_process_by_name(const wchar_t* name);

static void set_console_color(WORD color)
{
    const HANDLE console = GetStdHandle(STD_OUTPUT_HANDLE);
    SetConsoleTextAttribute(console, color);
}

static void print_line(const char* label, const char* message, WORD color)
{
    set_console_color(FOREGROUND_INTENSITY | FOREGROUND_GREEN | FOREGROUND_BLUE);
    std::printf("  [%s] ", label);
    set_console_color(color);
    std::printf("%s\n", message);
    set_console_color(FOREGROUND_RED | FOREGROUND_GREEN | FOREGROUND_BLUE);
    std::fflush(stdout);
}

static void print_ok(const char* step, const char* message)
{
    print_line(step, message, FOREGROUND_GREEN | FOREGROUND_INTENSITY);
}

static void print_warn(const char* step, const char* message)
{
    print_line(step, message, FOREGROUND_RED | FOREGROUND_GREEN | FOREGROUND_INTENSITY);
}

static void print_fail(const char* step, const char* message)
{
    print_line(step, message, FOREGROUND_RED | FOREGROUND_INTENSITY);
}

static void print_banner()
{
    set_console_color(FOREGROUND_GREEN | FOREGROUND_BLUE | FOREGROUND_INTENSITY);
    std::printf("\n  WebRadarDL - Deadlock Web Radar\n");
    std::printf("  ================================\n\n");
    set_console_color(FOREGROUND_RED | FOREGROUND_GREEN | FOREGROUND_BLUE);
}

static std::wstring get_exe_directory()
{
    wchar_t buffer[MAX_PATH]{};
    GetModuleFileNameW(nullptr, buffer, MAX_PATH);
    return fs::path(buffer).parent_path().wstring();
}

static std::wstring quote(const std::wstring& value)
{
    return L"\"" + value + L"\"";
}

static bool file_exists(const std::wstring& path)
{
    return fs::exists(path);
}

static bool test_port_open(int port)
{
    WSADATA wsa_data{};
    if (WSAStartup(MAKEWORD(2, 2), &wsa_data) != 0)
        return false;

    SOCKET sock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (sock == INVALID_SOCKET)
    {
        WSACleanup();
        return false;
    }

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(static_cast<u_short>(port));
    inet_pton(AF_INET, "127.0.0.1", &addr.sin_addr);

    const bool open = connect(sock, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) == 0;
    closesocket(sock);
    WSACleanup();
    return open;
}

static bool wait_for_port(int port, int timeout_ms)
{
    const auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(timeout_ms);
    while (std::chrono::steady_clock::now() < deadline)
    {
        if (test_port_open(port))
            return true;
        std::this_thread::sleep_for(std::chrono::milliseconds(250));
    }
    return false;
}

static void stop_process_tree(DWORD pid)
{
    if (!pid)
        return;

    HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snapshot == INVALID_HANDLE_VALUE)
        return;

    PROCESSENTRY32W entry{};
    entry.dwSize = sizeof(entry);
    if (Process32FirstW(snapshot, &entry))
    {
        do
        {
            if (entry.th32ParentProcessID == pid)
                stop_process_tree(entry.th32ProcessID);
        } while (Process32NextW(snapshot, &entry));
    }
    CloseHandle(snapshot);

    HANDLE process = OpenProcess(PROCESS_TERMINATE | SYNCHRONIZE, FALSE, pid);
    if (process)
    {
        TerminateProcess(process, 0);
        CloseHandle(process);
    }
}

static void kill_processes_by_name(const wchar_t* name)
{
    HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snapshot == INVALID_HANDLE_VALUE)
        return;

    PROCESSENTRY32W entry{};
    entry.dwSize = sizeof(entry);
    if (Process32FirstW(snapshot, &entry))
    {
        do
        {
            if (_wcsicmp(entry.szExeFile, name) == 0)
                stop_process_tree(entry.th32ProcessID);
        } while (Process32NextW(snapshot, &entry));
    }
    CloseHandle(snapshot);
}

static void stop_port_listeners(int port)
{
    DWORD table_size = 0;
    GetExtendedTcpTable(nullptr, &table_size, FALSE, AF_INET, TCP_TABLE_OWNER_PID_LISTENER, 0);
    if (!table_size)
        return;

    std::vector<BYTE> buffer(table_size);
    auto* table = reinterpret_cast<PMIB_TCPTABLE_OWNER_PID>(buffer.data());
    if (GetExtendedTcpTable(table, &table_size, FALSE, AF_INET, TCP_TABLE_OWNER_PID_LISTENER, 0) != NO_ERROR)
        return;

    for (DWORD i = 0; i < table->dwNumEntries; ++i)
    {
        const auto& row = table->table[i];
        if (ntohs(static_cast<u_short>(row.dwLocalPort)) == port && row.dwOwningPid)
            stop_process_tree(row.dwOwningPid);
    }
}

static void cleanup_stale_processes()
{
    kill_processes_by_name(L"cloudflared.exe");
    kill_processes_by_name(L"radar_reader.exe");
    kill_processes_by_name(L"usermode.exe");
    stop_port_listeners(5173);
    stop_port_listeners(5174);
    stop_port_listeners(22006);

    DeleteFileW(g_shutdown_file.c_str());
    DeleteFileW(g_public_url_file.c_str());
    DeleteFileW((g_root + L"\\.cloudflared.log").c_str());
    DeleteFileW(g_session_file.c_str());
    std::this_thread::sleep_for(std::chrono::milliseconds(500));
}

static int run_silent_command(const std::wstring& command, const std::wstring& working_directory)
{
    const std::wstring silent = command + L" >nul 2>&1";
    STARTUPINFOW startup_info{};
    startup_info.cb = sizeof(startup_info);
    startup_info.dwFlags = STARTF_USESHOWWINDOW;
    startup_info.wShowWindow = SW_HIDE;
    PROCESS_INFORMATION process_info{};

    std::wstring mutable_command = silent;
    if (!CreateProcessW(
            nullptr,
            mutable_command.data(),
            nullptr,
            nullptr,
            FALSE,
            CREATE_NO_WINDOW,
            nullptr,
            working_directory.c_str(),
            &startup_info,
            &process_info))
    {
        return -1;
    }

    WaitForSingleObject(process_info.hProcess, INFINITE);
    DWORD exit_code = 1;
    GetExitCodeProcess(process_info.hProcess, &exit_code);
    CloseHandle(process_info.hThread);
    CloseHandle(process_info.hProcess);
    return static_cast<int>(exit_code);
}

static int run_visible_command(const std::wstring& command, const std::wstring& working_directory)
{
    STARTUPINFOW startup_info{};
    startup_info.cb = sizeof(startup_info);
    PROCESS_INFORMATION process_info{};

    std::wstring mutable_command = command;
    if (!CreateProcessW(
            nullptr,
            mutable_command.data(),
            nullptr,
            nullptr,
            TRUE,
            0,
            nullptr,
            working_directory.c_str(),
            &startup_info,
            &process_info))
    {
        return -1;
    }

    WaitForSingleObject(process_info.hProcess, INFINITE);
    DWORD exit_code = 1;
    GetExitCodeProcess(process_info.hProcess, &exit_code);
    CloseHandle(process_info.hThread);
    CloseHandle(process_info.hProcess);
    return static_cast<int>(exit_code);
}

static bool run_hidden_command(const std::wstring& command, const std::wstring& working_directory, DWORD* out_pid)
{
    STARTUPINFOW startup_info{};
    startup_info.cb = sizeof(startup_info);
    startup_info.dwFlags = STARTF_USESHOWWINDOW;
    startup_info.wShowWindow = SW_HIDE;
    PROCESS_INFORMATION process_info{};

    std::wstring mutable_command = command;
    if (!CreateProcessW(
            nullptr,
            mutable_command.data(),
            nullptr,
            nullptr,
            FALSE,
            CREATE_NO_WINDOW,
            nullptr,
            working_directory.c_str(),
            &startup_info,
            &process_info))
    {
        return false;
    }

    if (out_pid)
        *out_pid = process_info.dwProcessId;

    CloseHandle(process_info.hThread);
    CloseHandle(process_info.hProcess);
    return true;
}

static bool ensure_npm_dependencies()
{
    const std::wstring node_modules = g_webapp + L"\\node_modules";
    if (file_exists(node_modules))
    {
        print_ok("1/6", "npm dependencies already installed");
        return true;
    }

    print_warn("1/6", "Installing npm dependencies (first run)...");
    const int code = run_visible_command(L"cmd.exe /c npm install", g_webapp);
    if (code != 0)
    {
        print_fail("1/6", "npm install failed");
        return false;
    }

    print_ok("1/6", "npm dependencies installed");
    return true;
}

static bool ensure_web_build()
{
    const std::wstring dist_index = g_webapp + L"\\dist\\index.html";
    if (file_exists(dist_index))
    {
        print_ok("2/6", "web build present");
        return true;
    }

    print_warn("2/6", "Building web UI (first run)...");
    const int code = run_visible_command(L"cmd.exe /c npm run build", g_webapp);
    if (code != 0)
    {
        print_fail("2/6", "npm run build failed");
        return false;
    }

    print_ok("2/6", "web UI built");
    return true;
}

static bool start_host_server()
{
    print_warn("3/6", "Starting web server + relay (hidden)...");
    const std::wstring command = L"cmd.exe /c node host.js";
    if (!run_hidden_command(command, g_webapp, &g_session.host_node_pid))
    {
        print_fail("3/6", "could not start host.js");
        return false;
    }

    if (!wait_for_port(5173, 60000))
    {
        print_fail("3/6", "web server did not open port 5173");
        return false;
    }

    print_ok("3/6", "web server + relay online (http://localhost:5173)");
    return true;
}

static bool ensure_firewall_rule()
{
    const wchar_t* rule_name = L"WebRadarDL (TCP 5173)";
    std::wstring check = L"netsh advfirewall firewall show rule name=\"" + std::wstring(rule_name) + L"\"";
    if (run_silent_command(L"cmd.exe /c " + check, g_root) == 0)
        return true;

    std::wstring add = L"netsh advfirewall firewall add rule name=\"" + std::wstring(rule_name)
        + L"\" dir=in action=allow protocol=TCP localport=5173 profile=private";
    run_silent_command(L"cmd.exe /c " + add, g_root);
    return true;
}

static bool start_public_tunnel(std::wstring* public_url)
{
    print_ok("4/6", "public share link starts automatically (see Settings -> Share)");
    (void)public_url;
    return true;
}

static bool start_memory_reader()
{
    std::wstring reader = g_root + L"\\usermode\\release\\radar_reader.exe";
    if (!file_exists(reader))
        reader = g_root + L"\\usermode\\release\\usermode.exe";

    if (!file_exists(reader))
    {
        print_fail("5/6", "radar_reader.exe not found - build DL_WebRadar.sln");
        return false;
    }

    print_warn("5/6", "Starting radar_reader.exe (approve UAC if prompted)...");
    if (!get_process_by_name(L"deadlock.exe"))
        print_warn("5/6", "deadlock.exe is not running - join a match after launch");

    SHELLEXECUTEINFOW info{};
    info.cbSize = sizeof(info);
    info.fMask = SEE_MASK_NOCLOSEPROCESS;
    info.hwnd = nullptr;
    info.lpVerb = L"runas";
    info.lpFile = reader.c_str();
    info.lpDirectory = (g_root + L"\\usermode\\release").c_str();
    info.nShow = SW_SHOW;

    if (!ShellExecuteExW(&info) || !info.hProcess)
    {
        print_fail("5/6", "radar_reader.exe did not start");
        return false;
    }

    g_session.reader_pid = GetProcessId(info.hProcess);
    CloseHandle(info.hProcess);
    std::this_thread::sleep_for(std::chrono::seconds(2));

    if (get_process_by_name(L"radar_reader.exe") || get_process_by_name(L"usermode.exe"))
        print_ok("5/6", "memory reader running");
    else
        print_warn("5/6", "memory reader not detected yet - approve UAC or start manually");

    return true;
}

static DWORD get_process_by_name(const wchar_t* name)
{
    HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snapshot == INVALID_HANDLE_VALUE)
        return 0;

    PROCESSENTRY32W entry{};
    entry.dwSize = sizeof(entry);
    DWORD pid = 0;
    if (Process32FirstW(snapshot, &entry))
    {
        do
        {
            if (_wcsicmp(entry.szExeFile, name) == 0)
            {
                pid = entry.th32ProcessID;
                break;
            }
        } while (Process32NextW(snapshot, &entry));
    }
    CloseHandle(snapshot);
    return pid;
}

static bool open_browser()
{
    print_warn("6/6", "Opening browser...");
    const std::wstring url = L"http://localhost:5173";
    const std::vector<std::wstring> candidates = {
        L"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        L"C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        L"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        L"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    };

    for (const auto& browser : candidates)
    {
        if (!file_exists(browser))
            continue;

        std::wstring command = quote(browser) + L" --app=" + url + L" --new-window";
        if (run_hidden_command(command, g_root, &g_session.browser_pid))
        {
            g_session.browser_image = browser;
            print_ok("6/6", "browser opened");
            return true;
        }
    }

    ShellExecuteW(nullptr, L"open", url.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
    print_ok("6/6", "browser opened (default handler)");
    return true;
}

static void write_session_file()
{
    std::ofstream output(g_session_file);
    output << "{\n";
    output << "  \"hostNodePid\": " << g_session.host_node_pid << ",\n";
    output << "  \"tunnelPid\": " << g_session.tunnel_pid << ",\n";
    output << "  \"browserPid\": " << g_session.browser_pid << ",\n";
    output << "  \"readerPid\": " << g_session.reader_pid << "\n";
    output << "}\n";
}

static void shutdown_all(const char* reason)
{
    set_console_color(FOREGROUND_RED | FOREGROUND_GREEN | FOREGROUND_INTENSITY);
    std::printf("\n  Shutting down (%s)...\n", reason);
    set_console_color(FOREGROUND_RED | FOREGROUND_GREEN | FOREGROUND_BLUE);

    if (g_session.browser_pid)
        stop_process_tree(g_session.browser_pid);
    if (g_session.tunnel_pid)
        stop_process_tree(g_session.tunnel_pid);
    if (g_session.host_node_pid)
        stop_process_tree(g_session.host_node_pid);
    if (g_session.reader_pid)
        stop_process_tree(g_session.reader_pid);

    kill_processes_by_name(L"cloudflared.exe");
    kill_processes_by_name(L"radar_reader.exe");
    kill_processes_by_name(L"usermode.exe");
    stop_port_listeners(5173);
    stop_port_listeners(22006);

    DeleteFileW(g_shutdown_file.c_str());
    DeleteFileW(g_public_url_file.c_str());
    DeleteFileW((g_root + L"\\.cloudflared.log").c_str());
    DeleteFileW(g_session_file.c_str());

    print_ok("done", "all WebRadarDL processes stopped (deadlock.exe untouched)");
}

static BOOL WINAPI console_handler(DWORD signal)
{
    if (signal == CTRL_C_EVENT || signal == CTRL_CLOSE_EVENT || signal == CTRL_BREAK_EVENT)
    {
        g_shutdown_requested = true;
        return TRUE;
    }
    return FALSE;
}

int wmain()
{
    g_root = get_exe_directory();
    g_webapp = g_root + L"\\webapp";
    g_shutdown_file = g_root + L"\\.radar-shutdown";
    g_session_file = g_root + L"\\.radar-session.json";
    g_public_url_file = g_root + L"\\.radar-public-url.txt";

    SetConsoleCtrlHandler(console_handler, TRUE);
    print_banner();

    print_warn("init", "Cleaning up stale processes...");
    cleanup_stale_processes();
    print_ok("init", "ready");

    if (!ensure_npm_dependencies())
        return 1;
    if (!ensure_web_build())
        return 1;
    if (!start_host_server())
        return 1;

    ensure_firewall_rule();
    std::wstring public_url;
    start_public_tunnel(&public_url);
    start_memory_reader();
    open_browser();
    write_session_file();

    set_console_color(FOREGROUND_GREEN | FOREGROUND_INTENSITY);
    std::printf("\n  Ready: http://localhost:5173\n");
    if (!public_url.empty())
        std::wprintf(L"  Public link: %s\n", public_url.c_str());
    std::printf("  Use End Program in Settings, or close this window to stop.\n\n");
    set_console_color(FOREGROUND_RED | FOREGROUND_GREEN | FOREGROUND_BLUE);

    while (!g_shutdown_requested)
    {
        if (file_exists(g_shutdown_file))
        {
            g_shutdown_requested = true;
            break;
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(400));
    }

    shutdown_all(g_shutdown_requested && file_exists(g_shutdown_file) ? "End Program" : "console closed");
    return 0;
}
