"""Generate requirements.txt from source dependencies + translated imports."""
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import List, Set
from utils.logger import logger

# Java library → Python package mapping
JAVA_TO_PYTHON_MAP = {
    "com.google.gson": "json",
    "org.json": "json",
    "org.apache.commons.lang3": None,
    "org.apache.commons.lang": None,
    "org.apache.commons.io": None,
    "org.apache.commons.collections": None,
    "org.apache.commons.math": "numpy",
    "junit": "pytest",
    "org.junit": "pytest",
    "org.testng": "pytest",
    "org.slf4j": None,
    "org.apache.log4j": None,
    "org.apache.logging": None,
    "com.fasterxml.jackson": "json",
    "org.apache.http": "requests",
    "org.apache.httpcomponents": "requests",
    "javax.servlet": "flask",
    "org.springframework.boot": "fastapi",
    "org.springframework.web": "fastapi",
    "org.springframework": "fastapi",
    "java.sql": None,
    "javax.sql": None,
    "org.hibernate": "sqlalchemy",
    "javax.persistence": "sqlalchemy",
    "com.rabbitmq": "pika",
    "org.apache.kafka": "kafka-python",
    "com.amazonaws": "boto3",
    "io.netty": "asyncio",
    "com.google.guava": None,
    "org.yaml.snakeyaml": "pyyaml",
    "com.opencsv": None,
    "org.apache.poi": "openpyxl",
    "javax.mail": "smtplib",
    "org.joda.time": None,
    "com.zaxxer.hikari": "sqlalchemy",
    "redis.clients": "redis",
    "org.mongodb": "pymongo",
    "org.elasticsearch": "elasticsearch",
    "io.grpc": "grpcio",
    "com.google.protobuf": "protobuf",
}

# Python standard library modules (common ones for cross-check)
STDLIB_MODULES = set()
if hasattr(sys, "stdlib_module_names"):
    STDLIB_MODULES = sys.stdlib_module_names
else:
    STDLIB_MODULES = {
        "abc", "asyncio", "argparse", "ast", "base64", "bisect", "calendar",
        "collections", "concurrent", "configparser", "contextlib", "copy",
        "csv", "dataclasses", "datetime", "decimal", "difflib", "email",
        "enum", "errno", "functools", "glob", "gzip", "hashlib", "heapq",
        "html", "http", "importlib", "inspect", "io", "itertools", "json",
        "logging", "math", "multiprocessing", "operator", "os", "pathlib",
        "pickle", "platform", "pprint", "queue", "random", "re", "shutil",
        "signal", "smtplib", "socket", "sqlite3", "ssl", "statistics",
        "string", "struct", "subprocess", "sys", "tempfile", "textwrap",
        "threading", "time", "timeit", "traceback", "typing", "unittest",
        "urllib", "uuid", "warnings", "weakref", "xml", "zipfile", "zlib",
    }


def scan_source_dependencies(repo_path: str) -> List[str]:
    """Phase 1: Scan source build files for dependencies and map to Python packages."""
    repo = Path(repo_path)
    python_packages = set()

    # Parse pom.xml files
    for pom in repo.rglob("pom.xml"):
        try:
            tree = ET.parse(str(pom))
            root = tree.getroot()
            ns = {"m": "http://maven.apache.org/POM/4.0.0"}

            for dep in root.findall(".//m:dependency", ns) + root.findall(".//dependency"):
                group_id = ""
                gnode = dep.find("m:groupId", ns) or dep.find("groupId")
                if gnode is not None and gnode.text:
                    group_id = gnode.text

                for java_prefix, python_pkg in JAVA_TO_PYTHON_MAP.items():
                    if group_id.startswith(java_prefix) and python_pkg:
                        python_packages.add(python_pkg)
        except Exception as e:
            logger.warning(f"Failed to parse {pom}: {e}")

    # Parse build.gradle files
    for gradle in list(repo.rglob("build.gradle")) + list(repo.rglob("build.gradle.kts")):
        try:
            content = gradle.read_text(errors="ignore")
            # Match implementation 'group:artifact:version' patterns
            dep_pattern = re.compile(
                r"(?:implementation|compile|api|testImplementation)\s*['\"]([^'\"]+)['\"]"
            )
            for match in dep_pattern.finditer(content):
                dep_str = match.group(1)
                group_id = dep_str.split(":")[0] if ":" in dep_str else dep_str

                for java_prefix, python_pkg in JAVA_TO_PYTHON_MAP.items():
                    if group_id.startswith(java_prefix) and python_pkg:
                        python_packages.add(python_pkg)
        except Exception as e:
            logger.warning(f"Failed to parse {gradle}: {e}")

    return sorted(python_packages)


def scan_translated_imports(translated_path: str) -> List[str]:
    """Phase 2: Scan translated Python files for non-stdlib imports."""
    path = Path(translated_path)
    third_party = set()

    import_pattern = re.compile(r"^\s*(?:import|from)\s+(\w+)", re.MULTILINE)

    for py_file in path.rglob("*.py"):
        try:
            content = py_file.read_text(errors="ignore")
            for match in import_pattern.finditer(content):
                module = match.group(1)
                if module not in STDLIB_MODULES and module != "__future__":
                    third_party.add(module)
        except Exception:
            pass

    return sorted(third_party)


def build_requirements_txt(phase1: List[str], phase2: List[str]) -> str:
    """Merge Phase 1 and Phase 2 dependencies into requirements.txt content."""
    all_deps = sorted(set(phase1) | set(phase2))
    # Filter out entries that are None or stdlib
    final = [dep for dep in all_deps if dep and dep not in STDLIB_MODULES]
    return "\n".join(final) + "\n" if final else "# No external dependencies detected\n"
