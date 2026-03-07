"""Run py_compile on translated code to validate syntax."""
import subprocess
import py_compile
from pathlib import Path
from typing import List, Tuple, Dict
from utils.logger import logger, log_compiler_error


def compile_translated_files(translated_dir: str) -> Tuple[bool, List[Dict[str, str]]]:
    """
    Run py_compile on all .py files in the translated directory.
    
    Returns:
        (all_passed, errors) - Whether all files compiled, and list of error dicts
    """
    path = Path(translated_dir)
    errors = []
    total = 0
    passed = 0

    for py_file in sorted(path.rglob("*.py")):
        total += 1
        try:
            py_compile.compile(str(py_file), doraise=True)
            passed += 1
        except py_compile.PyCompileError as e:
            error_msg = str(e)
            errors.append({
                "file": str(py_file.relative_to(path)),
                "error": error_msg,
            })
            log_compiler_error(str(py_file), error_msg, 0)
            logger.warning(f"Compile error in {py_file}: {error_msg[:100]}")

    logger.info(f"Compilation: {passed}/{total} files passed")
    all_passed = len(errors) == 0
    return all_passed, errors


def compile_single_file(file_path: str) -> Tuple[bool, str]:
    """Compile a single file and return success status + error message."""
    try:
        py_compile.compile(file_path, doraise=True)
        return True, ""
    except py_compile.PyCompileError as e:
        return False, str(e)
