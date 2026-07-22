using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

[assembly: AssemblyTitle("Instalador AtendeFlow")]
[assembly: AssemblyDescription("Instalador oficial do AtendeFlow")]
[assembly: AssemblyCompany("AtendeFlow")]
[assembly: AssemblyProduct("AtendeFlow")]
[assembly: AssemblyCopyright("AtendeFlow")]
[assembly: AssemblyVersion("__ATENDEFLOW_ASSEMBLY_VERSION__")]
[assembly: AssemblyFileVersion("__ATENDEFLOW_ASSEMBLY_VERSION__")]

internal static class InstallerLauncher
{
    [STAThread]
    private static void Main()
    {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string script = Path.Combine(root, "scripts", "bootstrap-windows.ps1");
        if (!File.Exists(script))
        {
            MessageBox.Show(
                "O arquivo scripts\\bootstrap-windows.ps1 não foi encontrado. Extraia todo o conteúdo do ZIP antes de instalar.",
                "AtendeFlow - Instalador",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return;
        }

        try
        {
            var start = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + script + "\"",
                WorkingDirectory = root,
                UseShellExecute = true
            };
            Process.Start(start);
        }
        catch (Exception error)
        {
            MessageBox.Show(
                "Não foi possível iniciar a instalação.\n\n" + error.Message +
                "\n\nComo alternativa, execute Instalar-AtendeFlow.cmd.",
                "AtendeFlow - Instalador",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }
}
