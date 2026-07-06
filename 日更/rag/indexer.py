"""
日更文章 RAG 索引器
扫描所有 .md 文件，分块后存入 ChromaDB 向量数据库。
"""

import os
import re
import hashlib
import chromadb
from sentence_transformers import SentenceTransformer

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
COLLECTION_NAME = "ri_geng_articles"

# 中文嵌入模型
EMBED_MODEL = "BAAI/bge-base-zh-v1.5"

# 扫描这些年份目录
YEAR_DIRS = ["2021", "2022", "2023", "2024", "2025", "2026"]


def get_file_hash(filepath):
    """文件内容的 MD5，用于增量更新判断。"""
    with open(filepath, "r", encoding="utf-8") as f:
        return hashlib.md5(f.read().encode()).hexdigest()


def extract_date(filename):
    """从文件名提取日期，如 0101xxx.md -> 20250101。"""
    m = re.match(r"(\d{4})", filename)
    if m:
        return m.group(1)
    return ""


def extract_title(filename):
    """从文件名提取标题。"""
    name = filename.replace(".md", "").replace(".txt", "")
    # 去掉前4位数字日期
    m = re.match(r"\d{4}(.*)", name)
    if m:
        return m.group(1)
    return name


def chunk_article(content, title, max_chars=600, min_chars=100):
    """
    将文章按 Markdown 标题分段，再按字数切块。
    每块保留标题上下文。
    """
    # 按二级标题分段
    sections = re.split(r"\n(?=#{1,3} )", content)

    chunks = []
    for section in sections:
        section = section.strip()
        if not section or len(section) < min_chars:
            continue

        # 提取段落标题
        header_match = re.match(r"^(#{1,3})\s+(.+)", section)
        section_title = header_match.group(2) if header_match else ""

        # 如果段落足够短，整段作为一个 chunk
        if len(section) <= max_chars:
            chunks.append({
                "text": section,
                "section_title": section_title,
            })
            continue

        # 段落太长，按段落再切
        paragraphs = section.split("\n\n")
        current = ""
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            if len(current) + len(para) + 2 > max_chars and len(current) >= min_chars:
                chunks.append({
                    "text": current,
                    "section_title": section_title,
                })
                current = para
            else:
                current = current + "\n\n" + para if current else para

        if current and len(current) >= min_chars:
            chunks.append({
                "text": current,
                "section_title": section_title,
            })

    return chunks


def scan_articles():
    """扫描所有文章，返回 (filepath, metadata) 列表。"""
    articles = []
    for year in YEAR_DIRS:
        year_path = os.path.join(BASE_DIR, year)
        if not os.path.isdir(year_path):
            continue
        for root, _, files in os.walk(year_path):
            for f in sorted(files):
                if f.endswith(".md") or f.endswith(".txt"):
                    filepath = os.path.join(root, f)
                    date_str = extract_date(f)
                    # 从目录路径推断年月
                    rel = os.path.relpath(filepath, year_path)
                    parts = rel.split(os.sep)
                    month = parts[0] if len(parts) > 1 and parts[0].isdigit() else ""

                    articles.append({
                        "filepath": filepath,
                        "filename": f,
                        "title": extract_title(f),
                        "year": year,
                        "month": month,
                        "date": f"{year}{month}{date_str}" if month and date_str else "",
                    })
    return articles


def build_index(force=False):
    """构建或增量更新向量索引。"""
    print(f"加载嵌入模型 {EMBED_MODEL}...")
    model = SentenceTransformer(EMBED_MODEL)

    client = chromadb.PersistentClient(path=DATA_DIR)

    # 如果强制重建，删除旧 collection（模型变了，旧向量不兼容）
    if force:
        try:
            client.delete_collection(name=COLLECTION_NAME)
            print("已删除旧索引")
        except Exception:
            pass

    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    # 获取已索引文件的 hash
    existing = {}
    if not force and collection.count() > 0:
        # 通过 metadata 中的 file_hash 判断是否需要更新
        all_meta = collection.get(include=["metadatas"])
        for meta in all_meta["metadatas"]:
            fp = meta.get("filepath", "")
            fh = meta.get("file_hash", "")
            if fp and fh:
                existing[fp] = fh

    articles = scan_articles()
    print(f"扫描到 {len(articles)} 篇文章")

    added = 0
    skipped = 0
    updated = 0

    for i, art in enumerate(articles):
        filepath = art["filepath"]
        current_hash = get_file_hash(filepath)

        # 检查是否需要更新
        if not force and filepath in existing:
            if existing[filepath] == current_hash:
                skipped += 1
                continue
            else:
                # 文件有变化，删除旧 chunks
                old_ids = [
                    id_
                    for id_, meta in zip(
                        collection.get()["ids"],
                        collection.get(include=["metadatas"])["metadatas"],
                    )
                    if meta.get("filepath") == filepath
                ]
                if old_ids:
                    collection.delete(ids=old_ids)
                updated += 1

        # 读取并分块
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception as e:
            print(f"  跳过 {filepath}: {e}")
            continue

        if len(content.strip()) < 50:
            continue

        chunks = chunk_article(content, art["title"])
        if not chunks:
            continue

        # 生成 IDs 和文档
        ids = []
        documents = []
        metadatas = []

        for j, chunk in enumerate(chunks):
            chunk_id = f"{current_hash}_{j}"
            # ChromaDB metadata 只支持 str/int/float/bool
            meta = {
                "filepath": filepath,
                "filename": art["filename"],
                "title": art["title"],
                "year": art["year"],
                "month": art["month"],
                "date": art["date"],
                "section_title": chunk.get("section_title", ""),
                "file_hash": current_hash,
                "chunk_index": j,
            }
            ids.append(chunk_id)
            documents.append(chunk["text"])
            metadatas.append(meta)

        # 批量计算嵌入并写入
        batch_size = 64
        for start in range(0, len(ids), batch_size):
            end = start + batch_size
            batch_docs = documents[start:end]
            embeddings = model.encode(batch_docs, normalize_embeddings=True).tolist()
            collection.add(
                ids=ids[start:end],
                embeddings=embeddings,
                documents=batch_docs,
                metadatas=metadatas[start:end],
            )

        added += len(chunks)

        if (i + 1) % 100 == 0:
            print(f"  已处理 {i + 1}/{len(articles)} 篇...")

    print(f"\n完成！新增 {added} 个文本块，跳过 {skipped} 篇未变化，更新 {updated} 篇")
    print(f"数据库总量：{collection.count()} 个文本块")
    print(f"存储位置：{DATA_DIR}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="日更文章 RAG 索引器")
    parser.add_argument("--force", action="store_true", help="强制重建索引")
    args = parser.parse_args()

    build_index(force=args.force)
