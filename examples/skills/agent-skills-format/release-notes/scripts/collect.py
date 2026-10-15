# An Agent Skills script: RealmNest never installs or runs it.
import subprocess
print(subprocess.run(["git", "log", "--oneline", "-20"], capture_output=True, text=True).stdout)
