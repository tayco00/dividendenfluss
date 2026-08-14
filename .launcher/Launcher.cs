using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("Dividendenfluss")]
[assembly: AssemblyDescription("Dividendenfluss")]
[assembly: AssemblyProduct("Dividendenfluss")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

internal static class Program
{
    private const string MutexName = "Local\\DividendenflussDesktopApp_v1";
    internal const string AppUrl = "http://localhost:3000/";

    [STAThread]
    private static void Main(string[] args)
    {
        bool noOpen = Array.IndexOf(args, "--no-open") >= 0;
        bool createdNew;

        using (Mutex instanceMutex = new Mutex(true, MutexName, out createdNew))
        {
            if (!createdNew)
            {
                if (!noOpen)
                {
                    OpenBrowser();
                }
                return;
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            using (DividendApplicationContext context = new DividendApplicationContext(noOpen))
            {
                if (context.Ready)
                {
                    Application.Run(context);
                }
            }

            GC.KeepAlive(instanceMutex);
        }
    }

    internal static void OpenBrowser()
    {
        try
        {
            Process.Start(new ProcessStartInfo(AppUrl) { UseShellExecute = true });
        }
        catch
        {
            MessageBox.Show(
                "Die Anwendung läuft unter " + AppUrl,
                "Dividendenfluss",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
        }
    }
}

internal sealed class DividendApplicationContext : ApplicationContext
{
    private readonly NotifyIcon trayIcon;
    private Process serverProcess;
    private bool ownsServer;
    private bool shuttingDown;

    internal bool Ready { get; private set; }

    internal DividendApplicationContext(bool noOpen)
    {
        ContextMenuStrip menu = new ContextMenuStrip();
        ToolStripMenuItem openItem = new ToolStripMenuItem("Dividendenfluss öffnen");
        ToolStripMenuItem exitItem = new ToolStripMenuItem("Beenden");

        openItem.Font = new Font(openItem.Font, FontStyle.Bold);
        openItem.Click += delegate { Program.OpenBrowser(); };
        exitItem.Click += delegate { ExitThread(); };

        menu.Items.Add(openItem);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(exitItem);

        trayIcon = new NotifyIcon();
        trayIcon.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        trayIcon.Text = "Dividendenfluss";
        trayIcon.ContextMenuStrip = menu;
        trayIcon.Visible = true;
        trayIcon.DoubleClick += delegate { Program.OpenBrowser(); };

        try
        {
            if (!IsApplicationReady())
            {
                StartServer();
                if (!WaitUntilReady())
                {
                    throw new InvalidOperationException(
                        "Die Anwendung konnte nicht gestartet werden. Details stehen im Unterordner .runtime.");
                }
            }

            Ready = true;
            trayIcon.BalloonTipTitle = "Dividendenfluss ist bereit";
            trayIcon.BalloonTipText = "Die Anwendung läuft lokal auf diesem Gerät.";
            trayIcon.ShowBalloonTip(2200);

            if (!noOpen)
            {
                Program.OpenBrowser();
            }
        }
        catch (Exception exception)
        {
            Ready = false;
            trayIcon.Visible = false;
            MessageBox.Show(
                exception.Message,
                "Dividendenfluss",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            StopOwnedServer();
        }
    }

    private static string AppDirectory
    {
        get
        {
            DirectoryInfo launcherDirectory = new DirectoryInfo(AppDomain.CurrentDomain.BaseDirectory);
            return launcherDirectory.Parent.FullName;
        }
    }

    private static string FindNpm()
    {
        string path = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
        foreach (string directory in path.Split(Path.PathSeparator))
        {
            try
            {
                string candidate = Path.Combine(directory.Trim(), "npm.cmd");
                if (File.Exists(candidate))
                {
                    return candidate;
                }
            }
            catch
            {
                // Ignore invalid PATH entries and continue with the next one.
            }
        }

        string standardCandidate = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            "nodejs",
            "npm.cmd");
        return File.Exists(standardCandidate) ? standardCandidate : null;
    }

    private static bool IsApplicationReady()
    {
        try
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(Program.AppUrl);
            request.Timeout = 1600;
            request.ReadWriteTimeout = 1600;
            request.Proxy = null;
            request.UserAgent = "Dividendenfluss Desktop";

            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            using (StreamReader reader = new StreamReader(response.GetResponseStream()))
            {
                string content = reader.ReadToEnd();
                return response.StatusCode == HttpStatusCode.OK &&
                       content.IndexOf("Dividendenfluss", StringComparison.OrdinalIgnoreCase) >= 0;
            }
        }
        catch
        {
            return false;
        }
    }

    private void StartServer()
    {
        string npm = FindNpm();
        if (string.IsNullOrEmpty(npm))
        {
            throw new InvalidOperationException(
                "Node.js wurde nicht gefunden. Bitte Node.js installieren und das Programm erneut öffnen.");
        }

        string runtimeDirectory = Path.Combine(AppDirectory, ".runtime");
        Directory.CreateDirectory(runtimeDirectory);

        if (!Directory.Exists(Path.Combine(AppDirectory, "node_modules")))
        {
            int installExitCode = RunHiddenCommand(
                npm,
                "ci --ignore-scripts --no-audit --no-fund",
                true);
            if (installExitCode != 0)
            {
                throw new InvalidOperationException("Die einmalige Vorbereitung ist fehlgeschlagen.");
            }
        }

        ProcessStartInfo startInfo = CreateCommandStartInfo(npm, "run dev");
        startInfo.UseShellExecute = false;
        startInfo.CreateNoWindow = true;
        startInfo.WindowStyle = ProcessWindowStyle.Hidden;

        serverProcess = Process.Start(startInfo);
        if (serverProcess == null)
        {
            throw new InvalidOperationException("Der lokale Dienst konnte nicht gestartet werden.");
        }

        ownsServer = true;
        File.WriteAllText(Path.Combine(runtimeDirectory, "server.pid"), serverProcess.Id.ToString());
    }

    private static ProcessStartInfo CreateCommandStartInfo(string npm, string arguments)
    {
        ProcessStartInfo info = new ProcessStartInfo();
        info.FileName = Environment.GetEnvironmentVariable("COMSPEC") ?? "cmd.exe";
        info.Arguments = "/d /s /c \"\"" + npm + "\" " + arguments + "\"";
        info.WorkingDirectory = AppDirectory;
        return info;
    }

    private static int RunHiddenCommand(string npm, string arguments, bool wait)
    {
        ProcessStartInfo info = CreateCommandStartInfo(npm, arguments);
        info.UseShellExecute = false;
        info.CreateNoWindow = true;
        info.WindowStyle = ProcessWindowStyle.Hidden;

        using (Process process = Process.Start(info))
        {
            if (process == null)
            {
                return -1;
            }
            if (!wait)
            {
                return 0;
            }
            process.WaitForExit();
            return process.ExitCode;
        }
    }

    private bool WaitUntilReady()
    {
        for (int attempt = 0; attempt < 60; attempt += 1)
        {
            Thread.Sleep(500);
            if (IsApplicationReady())
            {
                return true;
            }
            if (serverProcess != null && serverProcess.HasExited)
            {
                return false;
            }
        }
        return false;
    }

    private void StopOwnedServer()
    {
        if (!ownsServer || serverProcess == null)
        {
            return;
        }

        try
        {
            if (!serverProcess.HasExited)
            {
                ProcessStartInfo stopInfo = new ProcessStartInfo();
                stopInfo.FileName = "taskkill.exe";
                stopInfo.Arguments = "/PID " + serverProcess.Id + " /T /F";
                stopInfo.UseShellExecute = false;
                stopInfo.CreateNoWindow = true;
                stopInfo.WindowStyle = ProcessWindowStyle.Hidden;

                using (Process stopProcess = Process.Start(stopInfo))
                {
                    if (stopProcess != null)
                    {
                        stopProcess.WaitForExit(6000);
                    }
                }
            }
        }
        catch
        {
            // Windows will end remaining child processes during shutdown.
        }

        ownsServer = false;
    }

    protected override void ExitThreadCore()
    {
        if (shuttingDown)
        {
            return;
        }

        shuttingDown = true;
        trayIcon.Visible = false;
        StopOwnedServer();
        trayIcon.Dispose();
        base.ExitThreadCore();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            trayIcon.Dispose();
        }
        base.Dispose(disposing);
    }
}
