class GlVM:
    class UserError(Exception):
        pass

    class VMError(Exception):
        pass

    class Return:
        def __init__(self, calldata):
            self.calldata = calldata

    @staticmethod
    def unpack_result(res):
        if isinstance(res, GlVM.Return):
            return res.calldata
        raise res

    @staticmethod
    def run_nondet(leader_fn, validator_fn, **kwargs):
        res = leader_fn()
        wrapped = GlVM.Return(res)
        valid = validator_fn(wrapped)
        if not valid:
            raise GlVM.UserError("Validator rejected leader output")
        return res


class GlPublic:
    @staticmethod
    def view(fn):
        return fn

    @staticmethod
    def write(fn):
        return fn


class GlEqPrinciple:
    @staticmethod
    def strict_eq(fn):
        return fn()


class GlWebResponse:
    def __init__(self, status=200, body=b""):
        self.status = status
        self.body = body


class GlWeb:
    def __init__(self):
        self.pages = {}
        self.get_handler = None

    def get(self, url):
        if self.get_handler:
            return self.get_handler(url)
        if url in self.pages:
            content = self.pages[url]
            if isinstance(content, GlWebResponse):
                return content
            body_bytes = content.encode("utf-8") if isinstance(content, str) else content
            return GlWebResponse(status=200, body=body_bytes)
        return GlWebResponse(status=404, body=b"Not Found")


class GlNondet:
    def __init__(self):
        self.prompt_handler = None
        self.web = GlWeb()

    def exec_prompt(self, p, response_format=""):
        if self.prompt_handler:
            return self.prompt_handler(p)
        return '{"results": ["YES"]}'


class GlMessage:
    class SenderAddress:
        as_hex = "0x1111111111111111111111111111111111111111"

        def __str__(self):
            return self.as_hex

    sender_address = SenderAddress()


class Address:
    def __init__(self, val: str = ""):
        self.as_hex = str(val).lower()

    def __str__(self):
        return self.as_hex

    def __eq__(self, other):
        if isinstance(other, Address):
            return self.as_hex == other.as_hex
        return self.as_hex == str(other).lower()


class Contract:
    def __new__(cls, *args, **kwargs):
        inst = super().__new__(cls)
        for attr, attr_type in getattr(cls, '__annotations__', {}).items():
            if 'dict' in str(attr_type) or 'TreeMap' in str(attr_type):
                setattr(inst, attr, {})
        return inst


class GlMock:
    Contract = Contract
    vm = GlVM()
    public = GlPublic()
    eq_principle = GlEqPrinciple()
    nondet = GlNondet()
    message = GlMessage()
    contracts_registry = {}

    @classmethod
    def set_sender(cls, addr: str):
        cls.message.sender_address.as_hex = str(addr).lower()

    @classmethod
    def register_contract(cls, addr: str, instance):
        cls.contracts_registry[str(addr).lower()] = instance

    @classmethod
    def get_contract_at(cls, addr):
        addr_str = str(addr).lower()
        if addr_str in cls.contracts_registry:
            inst = cls.contracts_registry[addr_str]
            class BoundView:
                def view(self_bv):
                    return inst
            return BoundView()
        raise ValueError(f"Contract at {addr_str} not registered in GlMock")

    @classmethod
    def reset(cls):
        cls.set_sender("0x1111111111111111111111111111111111111111")
        cls.contracts_registry.clear()
        cls.nondet.prompt_handler = None
        cls.nondet.web.pages.clear()
        cls.nondet.web.get_handler = None


gl = GlMock()
TreeMap = dict
