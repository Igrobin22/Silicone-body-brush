Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

siteDir = fso.GetParentFolderName(WScript.ScriptFullName)
pythonExe = shell.ExpandEnvironmentStrings("%USERPROFILE%") & "\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
siteUrl = "http://127.0.0.1:8000/"
logFile = siteDir & "\preview-server.log"

If Not fso.FileExists(pythonExe) Then
  MsgBox "Could not find the bundled Python runtime:" & vbCrLf & pythonExe, vbExclamation, "PureForm preview"
  WScript.Quit 1
End If

command = "cmd /c cd /d """ & siteDir & """ && """ & pythonExe & """ -m http.server 8000 --bind 127.0.0.1 > """ & logFile & """ 2>&1"
shell.Run command, 0, False
WScript.Sleep 1200
shell.Run siteUrl, 1, False
