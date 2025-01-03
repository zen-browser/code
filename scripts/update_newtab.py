import os
import subprocess

def update_newtab(init: bool = True):
  # Change to the newtab directory and install dependencies if initializing
  if init:
    subprocess.run(
      ["sh", "-c", "(cd ./engine/browser/components/newtab && ../../../mach npm install && ../../../mach npm install meow@9.0.0)"],
      check=True
    )
  
  # Bundle the newtab components
  subprocess.run(
    ["sh", "-c", "cd ./engine && ./mach npm run bundle --prefix=browser/components/newtab"],
    check=True
  )

if __name__ == "__main__":
  update_newtab(False)
