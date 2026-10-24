"""Extract compared fields from validator_fn in contracts/ShipEscrowV2.py"""
import re

def extract():
    with open('contracts/ShipEscrowV2.py', 'r', encoding='utf-8') as f:
        code = f.read()

    val_fn_match = re.search(r'def validator_fn\(result\).*?:(.*?)(?=\ndef|\n\s{8}leader_json =)', code, re.DOTALL)
    if not val_fn_match:
        print("Could not find validator_fn")
        return

    body = val_fn_match.group(1)
    comparisons = re.findall(r'leader_packet\.get\("([^"]+)"\)\s*!=\s*val_packet\.get\("([^"]+)"\)', body)
    int_comp = re.findall(r'int\(leader_packet\.get\("([^"]+)"', body)

    print("Script-extracted compared fields from real validator_fn in contracts/ShipEscrowV2.py:")
    fields = []
    for lp, vp in comparisons:
        fields.append(lp)
        print(f"  - {lp} (leader vs validator)")
    for ic in int_comp:
        if ic not in fields:
            fields.append(ic)
            print(f"  - {ic} (integer comparison leader vs validator)")

    print(f"\nTotal compared fields: {len(fields)}")
    print(f"Fields: {fields}")

if __name__ == '__main__':
    extract()
