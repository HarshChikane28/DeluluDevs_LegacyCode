"""Build prompts for function translation, compilation fix, and file assembly."""
from typing import List, Dict, Any


def build_translation_prompt(
    func_data: Dict[str, Any],
    translated_deps: List[Dict[str, str]],
    filtered_code: str,
    source_lang: str = "java",
) -> str:
    """Build the function translation prompt."""
    deps_section = ""
    if translated_deps:
        deps_parts = []
        for dep in translated_deps:
            deps_parts.append(
                f"----- START {dep['id']} -----\n"
                f"{dep['translated_code']}\n"
                f"----- END {dep['id']} -----"
            )
        deps_section = "\n".join(deps_parts)
    else:
        deps_section = "(none — this is a leaf function)"

    params_str = ", ".join(func_data.get("params", [])) or "(none)"
    return_type = func_data.get("return_type", "void") or "void"
    callee_ids = ", ".join(func_data.get("callees", [])) or "(none)"

    return f"""CONTEXT:
- Source language: {source_lang}
- Target language: python
- Function ID: {func_data['id']}
- File: {func_data['file']}
- Parameters: {params_str}
- Return type: {return_type}
- Callees (IDs): {callee_ids}

ALREADY TRANSLATED DEPENDENCIES:
{deps_section}

SOURCE FUNCTION CODE (comments pre-filtered for relevance):
{filtered_code}

INSTRUCTIONS (READ CAREFULLY):
1) Translate the SOURCE FUNCTION CODE from {source_lang} to Python.
2) Preserve semantics and logic exactly. Do NOT invent new behavior or external API calls.
3) Use the translated versions of dependencies included above where this function calls them.
4) Keep function responsibilities and signatures equivalent; adapt types to Python idioms.
5) Use Python type hints where the original has type annotations.
6) If helper functions or imports are required, include them above the function but keep changes minimal.
7) Return ONLY the translated function code as plain text (no markdown, no commentary, no ```python blocks).
8) If you must report missing info, append exactly one JSON object on a new line after the code: {{"missing":["reason1",...]}}.
END."""


def build_scc_bundle_prompt(
    functions: List[Dict[str, Any]],
    translated_deps: List[Dict[str, str]],
    filtered_codes: List[str],
    source_lang: str = "java",
) -> str:
    """Build prompt for translating a bundle of mutually-recursive functions."""
    deps_section = ""
    if translated_deps:
        deps_parts = []
        for dep in translated_deps:
            deps_parts.append(
                f"----- START {dep['id']} -----\n"
                f"{dep['translated_code']}\n"
                f"----- END {dep['id']} -----"
            )
        deps_section = "\n".join(deps_parts)
    else:
        deps_section = "(none)"

    funcs_section = ""
    for func, code in zip(functions, filtered_codes):
        funcs_section += f"\n--- {func['id']} ---\n{code}\n"

    return f"""CONTEXT:
- Source language: {source_lang}
- Target language: python
- This is a BUNDLE of {len(functions)} mutually-recursive functions that must be translated together.

ALREADY TRANSLATED DEPENDENCIES:
{deps_section}

SOURCE FUNCTIONS (comments pre-filtered):
{funcs_section}

INSTRUCTIONS:
1) Translate ALL functions above from {source_lang} to Python.
2) Preserve mutual recursion and calling patterns exactly.
3) Output all translated functions concatenated, each separated by a single newline.
4) Return ONLY the translated code (no markdown, no commentary, no ```python blocks).
END."""


def build_fix_prompt(file_path: str, compiler_errors: str) -> str:
    """Build compilation fix prompt."""
    return f"""CONTEXT:
- Target language: python
- Failing file: {file_path}
- Compiler output (stderr):
{compiler_errors}

TASK:
1) Provide a minimal patch to fix the compilation error(s). Change as little code as possible.
2) Output ONLY a JSON object with keys:
   "patches": [{{"file":"path","find":"text_to_find","replace":"replacement_text"}}, ...],
   "explanation": "one short sentence" (optional)
3) If the error arises from missing translations or unknown external references, instead return:
   {{"missing":["symbol1","symbol2",...]}}

IMPORTANT:
- Do NOT include any other text. Return ONLY the JSON object.
- Do NOT wrap in markdown code blocks."""


def build_file_assembly_prompt(
    target_file_path: str,
    translated_functions: List[Dict[str, str]],
    has_main: bool = False,
) -> str:
    """Build file assembly prompt to combine translated functions into a complete file."""
    funcs_section = ""
    for tf in translated_functions:
        funcs_section += f"\n# --- {tf['id']} ---\n{tf['code']}\n"

    main_note = ""
    if has_main:
        main_note = '\n- Include an `if __name__ == "__main__":` block since the original had a main method'

    return f"""For file: {target_file_path}
Given translated functions:
{funcs_section}

TASK:
- Produce the full file content in Python with:
  - Required imports at top (use standard library where possible)
  - Translated functions placed in logical order
  - Type hints preserved{main_note}
- Return ONLY the complete file content (no commentary, no markdown blocks).
"""
