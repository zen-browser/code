import hashlib
import argparse
import sys
import logging
from pathlib import Path

# Initialize logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

FLATID = "io.github.zen_browser.zen"

def get_sha256sum(filename):  
    """Calculate the SHA256 checksum of a file.

    Args:
        filename (str): The path to the file to checksum.

    Returns:
        str: The SHA256 checksum of the file.
    """
    sha256 = hashlib.sha256()
    try:
        with open(filename, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256.update(byte_block)
    except FileNotFoundError:
        logging.error(f"File '{filename}' not found.")
        sys.exit(1)
    except Exception as e:
        logging.error(f"Error reading file '{filename}': {e}")
        sys.exit(1)
    return sha256.hexdigest()

def build_template(template, linux_sha256, flatpak_sha256, version):
    """Build the release template with provided checksums and version.

    Args:
        template (str): The template string to format.
        linux_sha256 (str): The SHA256 of the Linux archive.
        flatpak_sha256 (str): The SHA256 of the Flatpak archive.
        version (str): The version of the release.

    Returns:
        str: The formatted template.
    """
    logging.info(f"Building template with version {version}")
    logging.info(f"\tLinux archive SHA256: {linux_sha256}")
    logging.info(f"\tFlatpak archive SHA256: {flatpak_sha256}")
    return template.format(linux_sha256=linux_sha256, 
                           flatpak_sha256=flatpak_sha256,
                           version=version)

def get_template(template_root):
    """Read the template file from the specified root directory.

    Args:
        template_root (str): The root directory for the template.

    Returns:
        str: The content of the template file.

    Raises:
        FileNotFoundError: If the template file does not exist.
    """
    file_path = Path(template_root) / f"{FLATID}.yml.template"
    logging.info(f"Reading template from {file_path}")
    try:
        return file_path.read_text()
    except FileNotFoundError:
        logging.error(f"Template '{file_path}' not found.")
        sys.exit(1)
    except Exception as e:
        logging.error(f"Error reading template '{file_path}': {e}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description='Prepare flatpak release')
    parser.add_argument('--version', help='Version of the release', required=True)
    parser.add_argument('--linux-archive', help='Linux archive', required=True)
    parser.add_argument('--flatpak-archive', help='Flatpak archive', required=True)
    parser.add_argument('--output', help='Output file', default=f"{FLATID}.yml")
    parser.add_argument('--template-root', help='Template root', default="flatpak")
    args = parser.parse_args()

    linux_sha256 = get_sha256sum(args.linux_archive)
    flatpak_sha256 = get_sha256sum(args.flatpak_archive)
    template = build_template(get_template(args.template_root), linux_sha256, flatpak_sha256, args.version)

    output_path = Path(args.output)
    logging.info(f"Writing output to {output_path}")
    try:
        output_path.write_text(template)
    except Exception as e:
        logging.error(f"Error writing output to '{output_path}': {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
