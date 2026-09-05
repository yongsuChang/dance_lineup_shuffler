"""실명 db.json 을 가짜 닉네임으로 치환한 샘플 데이터를 만든다. (레거시 포맷 유지)
사용: python3 scripts/anonymize.py <input.json> <output.json>
"""
import json, sys, random

WORDS = ["사과","바나나","포도","수박","딸기","레몬","자몽","키위","망고","체리",
"토끼","여우","판다","수달","고래","코알라","사슴","다람쥐","두루미","부엉이",
"하늘","바다","숲","별빛","노을","안개","이슬","구름","바람","파도",
"민트","코랄","라임","올리브","인디고","라벤더","버건디","아이보리","네이비","카키",
"피아노","기타","첼로","플루트","드럼","하프","오보에","트럼펫","비올라","클라리넷",
"은하","혜성","오로라","달빛","유성","성운","위성","궤도","일식","월식",
"연필","지우개","공책","물감","붓","팔레트","크레파스","색연필","스케치","캔버스"]

def main(src, dst):
    random.seed(42)
    d = json.load(open(src, encoding="utf-8"))
    names = set()
    for s in d["students"]: names.add(s["nickname"])
    for p in d["pairs"]:
        names.add(p["leader"])
        if p["follower"]: names.add(p["follower"])
    names.update(d.get("photo_exclusions", []))
    names.discard("")
    pool = WORDS[:]
    random.shuffle(pool)
    assert len(pool) >= len(names), (len(pool), len(names))
    mapping = {n: pool[i] for i, n in enumerate(sorted(names))}
    f = lambda n: mapping.get(n, n) if n else n
    for s in d["students"]: s["nickname"] = f(s["nickname"])
    for p in d["pairs"]:
        p["leader"] = f(p["leader"]); p["follower"] = f(p["follower"])
    d["photo_exclusions"] = [f(n) for n in d.get("photo_exclusions", [])]
    d["settings"]["year"] = 2026
    json.dump(d, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("mapped", len(mapping), "names ->", dst)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
