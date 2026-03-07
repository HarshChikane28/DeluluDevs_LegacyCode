"""Java parser using javalang to extract functions and call relationships."""
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from utils.logger import logger

try:
    import javalang
except ImportError:
    javalang = None
    logger.warning("javalang not installed. Java parsing will be limited.")


def parse_java_file(file_path: str, file_content: str) -> List[Dict[str, Any]]:
    """Parse a Java file and extract method nodes with call information."""
    functions = []

    if javalang is None:
        return _fallback_parse_java(file_path, file_content)

    try:
        tree = javalang.parse.parse(file_content)
    except Exception as e:
        logger.error(f"Failed to parse {file_path}: {e}")
        return _fallback_parse_java(file_path, file_content)

    for path_nodes, node in tree.filter(javalang.tree.ClassDeclaration):
        class_name = node.name
        for method in (node.methods or []):
            func_id = f"{file_path}::{class_name}.{method.name}"
            params = []
            if method.parameters:
                for p in method.parameters:
                    param_type = _get_type_name(p.type) if p.type else "Object"
                    params.append(f"{param_type} {p.name}")

            return_type = _get_type_name(method.return_type) if method.return_type else "void"
            code = _extract_method_source(file_content, method, class_name)
            callees = _extract_method_calls(method)

            functions.append({
                "id": func_id,
                "language": "java",
                "file": file_path,
                "qualified_name": f"{class_name}.{method.name}",
                "params": params,
                "return_type": return_type,
                "code": code,
                "callees": callees,
                "called_by": [],
                "status": "untranslated",
                "translated_code": None,
                "notes": "",
            })

    # Also extract constructors
    for path_nodes, node in tree.filter(javalang.tree.ClassDeclaration):
        class_name = node.name
        for constructor in (node.constructors or []):
            func_id = f"{file_path}::{class_name}.__init__"
            params = []
            if constructor.parameters:
                for p in constructor.parameters:
                    param_type = _get_type_name(p.type) if p.type else "Object"
                    params.append(f"{param_type} {p.name}")
            code = _extract_constructor_source(file_content, constructor, class_name)
            callees = _extract_constructor_calls(constructor)
            functions.append({
                "id": func_id,
                "language": "java",
                "file": file_path,
                "qualified_name": f"{class_name}.__init__",
                "params": params,
                "return_type": "void",
                "code": code,
                "callees": callees,
                "called_by": [],
                "status": "untranslated",
                "translated_code": None,
                "notes": "",
            })

    return functions


def _get_type_name(type_node) -> str:
    """Extract type name from javalang type node."""
    if type_node is None:
        return "void"
    if hasattr(type_node, "name"):
        return type_node.name
    return str(type_node)


def _extract_method_source(file_content: str, method, class_name: str) -> str:
    """Extract method source code from file content using position info."""
    if method.position:
        lines = file_content.split("\n")
        start_line = method.position.line - 1
        # Find the end of the method by brace matching
        brace_count = 0
        end_line = start_line
        found_start = False
        for i in range(start_line, len(lines)):
            for ch in lines[i]:
                if ch == "{":
                    brace_count += 1
                    found_start = True
                elif ch == "}":
                    brace_count -= 1
            if found_start and brace_count == 0:
                end_line = i
                break
        return "\n".join(lines[start_line : end_line + 1])
    return f"// Could not extract source for {class_name}.{method.name}"


def _extract_constructor_source(file_content: str, constructor, class_name: str) -> str:
    """Extract constructor source code from file content."""
    if constructor.position:
        lines = file_content.split("\n")
        start_line = constructor.position.line - 1
        brace_count = 0
        end_line = start_line
        found_start = False
        for i in range(start_line, len(lines)):
            for ch in lines[i]:
                if ch == "{":
                    brace_count += 1
                    found_start = True
                elif ch == "}":
                    brace_count -= 1
            if found_start and brace_count == 0:
                end_line = i
                break
        return "\n".join(lines[start_line : end_line + 1])
    return f"// Could not extract source for {class_name} constructor"


def _extract_method_calls(method) -> List[str]:
    """Extract method call names from a method AST node."""
    callees = []
    try:
        if method.body:
            for _, node in method.filter(javalang.tree.MethodInvocation):
                if node.member:
                    qualifier = node.qualifier or ""
                    if qualifier:
                        callees.append(f"{qualifier}.{node.member}")
                    else:
                        callees.append(node.member)
    except Exception:
        pass
    return list(set(callees))


def _extract_constructor_calls(constructor) -> List[str]:
    """Extract method calls from a constructor."""
    callees = []
    try:
        if constructor.body:
            for _, node in constructor.filter(javalang.tree.MethodInvocation):
                if node.member:
                    qualifier = node.qualifier or ""
                    if qualifier:
                        callees.append(f"{qualifier}.{node.member}")
                    else:
                        callees.append(node.member)
    except Exception:
        pass
    return list(set(callees))


def _fallback_parse_java(file_path: str, file_content: str) -> List[Dict[str, Any]]:
    """Regex-based fallback parser for when javalang fails."""
    functions = []
    # Match method declarations
    method_pattern = re.compile(
        r'(public|private|protected|static|\s)*\s+'
        r'(\w[\w<>\[\],\s]*?)\s+'
        r'(\w+)\s*\((.*?)\)\s*(\{|throws)',
        re.MULTILINE | re.DOTALL
    )

    for match in method_pattern.finditer(file_content):
        modifiers = match.group(1) or ""
        return_type = match.group(2).strip()
        method_name = match.group(3).strip()
        params_str = match.group(4).strip()

        # Skip if this looks like a control structure
        if method_name in ("if", "for", "while", "switch", "catch", "return"):
            continue

        # Extract method body via brace matching
        start_pos = match.start()
        brace_start = file_content.find("{", match.end() - 1)
        if brace_start == -1:
            continue

        brace_count = 0
        end_pos = brace_start
        for i in range(brace_start, len(file_content)):
            if file_content[i] == "{":
                brace_count += 1
            elif file_content[i] == "}":
                brace_count -= 1
            if brace_count == 0:
                end_pos = i
                break

        code = file_content[start_pos : end_pos + 1]

        # Extract calls via simple pattern
        call_pattern = re.compile(r'(\w+)\s*\(')
        callees = []
        for cm in call_pattern.finditer(code):
            callee = cm.group(1)
            if callee not in ("if", "for", "while", "switch", "catch", "return", "new", method_name):
                callees.append(callee)

        func_id = f"{file_path}::{method_name}"
        functions.append({
            "id": func_id,
            "language": "java",
            "file": file_path,
            "qualified_name": method_name,
            "params": [p.strip() for p in params_str.split(",") if p.strip()],
            "return_type": return_type,
            "code": code,
            "callees": list(set(callees)),
            "called_by": [],
            "status": "untranslated",
            "translated_code": None,
            "notes": "parsed with fallback regex",
        })

    return functions
