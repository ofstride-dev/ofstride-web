import sys
with open("src/components/AdminAnalysisReport.jsx", "rb") as f:
    content = f.read()
# Replace {flex-shrink-0 with "flex-shrink-0
content = content.replace(b"{flex-shrink-0", b'"flex-shrink-0', 1)
# Replace the closing }> with ">
content = content.replace(b" }>\n", b'">\n', 1)
with open("src/components/AdminAnalysisReport.jsx", "wb") as f:
    f.write(content)
print("Fixed")
