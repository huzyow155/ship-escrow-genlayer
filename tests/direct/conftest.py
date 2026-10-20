import sys
from pathlib import Path

tests_dir = Path(__file__).resolve().parent.parent
if str(tests_dir) not in sys.path:
    sys.path.insert(0, str(tests_dir))

import genlayer
import gltest.direct.loader as loader

_orig_find = loader._find_contract_class


def _patched_find_contract_class(module):
    for name in dir(module):
        if name.startswith("_") or name in ("Contract", "gl.Contract"):
            continue
        obj = getattr(module, name)
        if isinstance(obj, type) and name in ("ShipEscrowV2", "ShipReputationV2"):
            return obj
    return _orig_find(module)


loader._find_contract_class = _patched_find_contract_class


# Hook genlayer.gl to bridge VMContext prank, mock_web, and mock_llm
import gltest.direct.vm as vm_module

_orig_prank = vm_module.VMContext.prank


def _patched_prank(self, address):
    if isinstance(address, bytes):
        hex_addr = "0x" + address.hex().lower()
    elif hasattr(address, "as_hex"):
        hex_addr = address.as_hex.lower()
    else:
        hex_addr = str(address).lower()
    genlayer.gl.set_sender(hex_addr)
    return _orig_prank(self, address)


vm_module.VMContext.prank = _patched_prank

_orig_mock_web = vm_module.VMContext.mock_web


def _patched_mock_web(self, url, response, *args, **kwargs):
    genlayer.gl.nondet.web.pages[url] = response
    return _orig_mock_web(self, url, response)


vm_module.VMContext.mock_web = _patched_mock_web

_orig_mock_llm = vm_module.VMContext.mock_llm


def _patched_mock_llm(self, pattern, response):
    genlayer.gl.nondet.prompt_handler = lambda p: response
    return _orig_mock_llm(self, pattern, response)


vm_module.VMContext.mock_llm = _patched_mock_llm
