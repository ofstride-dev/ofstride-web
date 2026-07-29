with open("src/components/AdminAnalysisReport.jsx", "rb") as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if b"className={" in line:
        idx = line.find(b"className={")
        after_brace = line[idx+11:]
        if after_brace and after_brace[0:1] not in (b"`", b"$", b"'"):
            print(f"Line {i+1}: {repr(line)}")
