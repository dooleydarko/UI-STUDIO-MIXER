import Cocoa
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    var window: NSWindow!
    var webView: WKWebView!

    var appTitle: String {
        return (Bundle.main.infoDictionary?["AGAppTitle"] as? String) ?? "Antigravity Studio"
    }
    var roomName: String {
        return (Bundle.main.infoDictionary?["AGRoom"] as? String) ?? "ui_playground"
    }
    var projectRoot: String {
        return (Bundle.main.infoDictionary?["AGProjectRoot"] as? String) ?? ""
    }
    var companionAppName: String {
        return (Bundle.main.infoDictionary?["AGCompanionApp"] as? String) ?? ""
    }
    var appPort: Int {
        return (Bundle.main.infoDictionary?["AGAppPort"] as? Int) ?? 4173
    }

    var baseURL: String {
        return "http://127.0.0.1:\(appPort)/?room=\(roomName)"
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupMenus()
        setupWindow()
        ensureLocalServerAndLoad()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    func setupMenus() {
        let mainMenu = NSMenu()
        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)

        let appMenu = NSMenu()
        appMenuItem.submenu = appMenu

        appMenu.addItem(withTitle: "About \(appTitle)", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())

        let updateItem = NSMenuItem(title: "Rebuild & Apply App Update", action: #selector(triggerUpdateRebuild), keyEquivalent: "u")
        updateItem.target = self
        appMenu.addItem(updateItem)

        let reloadItem = NSMenuItem(title: "Reload App", action: #selector(reloadView), keyEquivalent: "r")
        reloadItem.target = self
        appMenu.addItem(reloadItem)

        if !companionAppName.isEmpty {
            let switchItem = NSMenuItem(title: "Launch \(companionAppName)", action: #selector(launchCompanionApp), keyEquivalent: "o")
            switchItem.target = self
            appMenu.addItem(switchItem)
        }

        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit \(appTitle)", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        // Edit Menu (enables Cmd+C / Cmd+V / Cmd+A inside WKWebView inputs)
        let editMenuItem = NSMenuItem()
        mainMenu.addItem(editMenuItem)
        let editMenu = NSMenu(title: "Edit")
        editMenuItem.submenu = editMenu
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")

        NSApp.mainMenu = mainMenu
    }

    func setupWindow() {
        let screenFrame = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let width = min(1420, screenFrame.width * 0.92)
        let height = min(900, screenFrame.height * 0.92)
        let originX = screenFrame.midX - width / 2
        let originY = screenFrame.midY - height / 2

        window = NSWindow(
            contentRect: NSRect(x: originX, y: originY, width: width, height: height),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = appTitle
        window.minSize = NSSize(width: 960, height: 640)
        window.backgroundColor = NSColor(calibratedRed: 0.03, green: 0.03, blue: 0.05, alpha: 1.0)
        window.appearance = NSAppearance(named: .darkAqua)

        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.setValue(false, forKey: "drawsBackground")

        window.contentView?.addSubview(webView)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func findNodeBinary() -> String {
        let candidates = [
            "/usr/local/bin/node",
            "/opt/homebrew/bin/node",
            "/usr/bin/node"
        ]
        for path in candidates where FileManager.default.isExecutableFile(atPath: path) {
            return path
        }
        return "/usr/local/bin/node"
    }

    func isServerAlive(completion: @escaping (Bool) -> Void) {
        guard let url = URL(string: "http://127.0.0.1:\(appPort)/api/app-status") else {
            completion(false)
            return
        }
        var req = URLRequest(url: url)
        req.timeoutInterval = 1.0
        URLSession.shared.dataTask(with: req) { _, response, _ in
            let ok = (response as? HTTPURLResponse)?.statusCode == 200
            completion(ok)
        }.resume()
    }

    func startLocalAppServer() {
        let serverScript = "\(projectRoot)/scripts/appServer.js"
        guard FileManager.default.fileExists(atPath: serverScript) else { return }

        let task = Process()
        task.executableURL = URL(fileURLWithPath: findNodeBinary())
        task.arguments = [serverScript]
        task.currentDirectoryURL = URL(fileURLWithPath: projectRoot)

        var env = ProcessInfo.processInfo.environment
        let extraPath = "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
        env["PATH"] = extraPath + ":" + (env["PATH"] ?? "")
        task.environment = env

        let logPath = "/tmp/antigravity-appserver.log"
        FileManager.default.createFile(atPath: logPath, contents: nil)
        if let handle = FileHandle(forWritingAtPath: logPath) {
            task.standardOutput = handle
            task.standardError = handle
        }
        try? task.run()
    }

    func ensureLocalServerAndLoad() {
        webView.loadHTMLString("""
            <html><body style="background:#050509;color:#e5e7eb;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
            <div style="text-align:center;">
              <h2 style="margin-bottom:8px;">Starting \(appTitle)...</h2>
              <p style="color:#9ca3af;font-size:13px;">Connecting to local workspace runtime on port \(appPort)</p>
            </div></body></html>
        """, baseURL: nil)

        isServerAlive { [weak self] alive in
            guard let self = self else { return }
            if alive {
                DispatchQueue.main.async {
                    if let url = URL(string: self.baseURL) {
                        self.webView.load(URLRequest(url: url))
                    }
                }
                return
            }
            self.startLocalAppServer()
            self.pollServerReady(attemptsLeft: 25)
        }
    }

    func pollServerReady(attemptsLeft: Int) {
        if attemptsLeft <= 0 {
            DispatchQueue.main.async {
                self.webView.loadHTMLString("""
                    <html><body style="background:#09090b;color:#fca5a5;font-family:-apple-system,sans-serif;padding:40px;">
                    <h2>Could not start local app server on port \(self.appPort)</h2>
                    <p>Check /tmp/antigravity-appserver.log or run <code>npm run build</code> in \(self.projectRoot).</p>
                    </body></html>
                """, baseURL: nil)
            }
            return
        }
        DispatchQueue.global().asyncAfter(deadline: .now() + 0.25) {
            self.isServerAlive { alive in
                if alive {
                    DispatchQueue.main.async {
                        if let url = URL(string: self.baseURL) {
                            self.webView.load(URLRequest(url: url))
                        }
                    }
                } else {
                    self.pollServerReady(attemptsLeft: attemptsLeft - 1)
                }
            }
        }
    }

    @objc func reloadView() {
        isServerAlive { [weak self] alive in
            DispatchQueue.main.async {
                guard let self = self else { return }
                if alive {
                    self.webView.reload()
                } else {
                    self.ensureLocalServerAndLoad()
                }
            }
        }
    }

    @objc func launchCompanionApp() {
        let companionBundlePath = "\(NSHomeDirectory())/Applications/\(companionAppName).app"
        if FileManager.default.fileExists(atPath: companionBundlePath) {
            NSWorkspace.shared.open(URL(fileURLWithPath: companionBundlePath))
        }
    }

    @objc func triggerUpdateRebuild() {
        guard let url = URL(string: "http://127.0.0.1:\(appPort)/api/app-update") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.timeoutInterval = 120
        window.title = "\(appTitle) — Rebuilding Update..."

        URLSession.shared.dataTask(with: req) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.window.title = self.appTitle
                if let error = error {
                    let alert = NSAlert()
                    alert.messageText = "Update Failed"
                    alert.informativeText = error.localizedDescription
                    alert.runModal()
                    return
                }
                let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 500
                if statusCode == 200 {
                    self.webView.reload()
                    let alert = NSAlert()
                    alert.messageText = "\(self.appTitle) Updated"
                    alert.informativeText = "Latest workspace changes were rebuilt and reloaded."
                    alert.runModal()
                } else {
                    let body = data.flatMap { String(data: $0, encoding: .utf8) } ?? "HTTP \(statusCode)"
                    let alert = NSAlert()
                    alert.messageText = "Update Returned Status \(statusCode)"
                    alert.informativeText = String(body.prefix(500))
                    alert.runModal()
                }
            }
        }.resume()
    }

    // Open external URLs in default browser; keep localhost URLs inside app
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.shouldPerformDownload {
            decisionHandler(.download)
            return
        }
        if let url = navigationAction.request.url,
           let host = url.host,
           host != "127.0.0.1" && host != "localhost" {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = URL(fileURLWithPath: suggestedFilename).lastPathComponent
        panel.canCreateDirectories = true
        panel.begin { result in
            completionHandler(result == .OK ? panel.url : nil)
        }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        let alert = NSAlert()
        alert.messageText = "Download failed"
        alert.informativeText = error.localizedDescription
        alert.runModal()
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            if url.host == "127.0.0.1" || url.host == "localhost" {
                if url.absoluteString.contains("room=engine_foundry"),
                   roomName != "engine_foundry",
                   FileManager.default.fileExists(atPath: "\(NSHomeDirectory())/Applications/AI Engine Foundry.app") {
                    NSWorkspace.shared.open(URL(fileURLWithPath: "\(NSHomeDirectory())/Applications/AI Engine Foundry.app"))
                    return nil
                }
                if url.absoluteString.contains("room=ui_playground"),
                   roomName != "ui_playground",
                   FileManager.default.fileExists(atPath: "\(NSHomeDirectory())/Applications/UI Mixer Studio.app") {
                    NSWorkspace.shared.open(URL(fileURLWithPath: "\(NSHomeDirectory())/Applications/UI Mixer Studio.app"))
                    return nil
                }
                webView.load(URLRequest(url: url))
            } else {
                NSWorkspace.shared.open(url)
            }
        }
        return nil
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.begin { result in
            completionHandler(result == .OK ? panel.urls : nil)
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = appTitle
        alert.informativeText = message
        alert.runModal()
        completionHandler()
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = appTitle
        alert.informativeText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        completionHandler(alert.runModal() == .alertFirstButtonReturn)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
