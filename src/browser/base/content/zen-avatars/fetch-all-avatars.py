# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
import os
import requests
import random

JAR_ENTRY_TEMPLATE = "\tcontent/browser/zen-avatars/{0}\t(content/zen-avatars/{0})"
URL = "https://source.boringavatars.com/bauhaus/120/${}?colors={}"

COLORS = {
    "dark": ["DDDDDD", "5E9188", "3E5954", "253342", "232226"],
    "light": ["9D9382", "FFC1B2", "FFDBC8", "FFF6C7", "DCD7C2"],
}


def random_string(length):
  return "".join(random.choices("abcdefghijklmnopqrstuvwxyz", k=length))


def generate_list_names():
  names = []
  for i in range(1, 101):
    names.append(random_string(random.randint(5, 10)))
  return names


def write_jar_file(jar_file):
  with open("jar.inc.mn", "w") as f:
    f.write(jar_file)


def fetch_all_avatars():
  names = generate_list_names()
  jar_file = ""
  for theme in COLORS:
    for [i, name] in enumerate(names):
      url = URL.format(name, ",".join(COLORS[theme]))
      response = requests.get(url)
      with open(f"avatar-{i}-{theme}.svg", "w") as f:
        f.write(response.text)
      jar_file += JAR_ENTRY_TEMPLATE.format(f"avatar-{i}-{theme}.svg") + "\n"
      print(
          f"SUCCESS: Fetched 'avatar-{i}-{theme}.svg' for name '{name}' with theme '{theme}'"
      )
  write_jar_file(jar_file)


def clear_all_avatars():
  for file in os.listdir():
    if file.startswith("avatar-") and file.endswith(".svg"):
      os.remove(file)
      print(f"SUCCESS: Removed '{file}'")


def main():
  if not os.getcwd().endswith("zen-avatars"):
    print("ERROR: Please run this script from the 'zen-avatars' directory")
    return
  clear_all_avatars()
  fetch_all_avatars()


if __name__ == "__main__":
  main()
