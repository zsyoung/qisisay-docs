"""
日更文章 RAG 查询接口
语义检索 + Claude 生成回答。
"""

import os
import sys
import chromadb
from anthropic import Anthropic
from sentence_transformers import SentenceTransformer

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
COLLECTION_NAME = "ri_geng_articles"
EMBED_MODEL = "BAAI/bge-base-zh-v1.5"

# 懒加载，避免每次启动都加载模型
_model = None


def get_model():
    global _model
    if _model is None:
        print(f"加载嵌入模型 {EMBED_MODEL}...", file=sys.stderr)
        _model = SentenceTransformer(EMBED_MODEL)
    return _model

SYSTEM_PROMPT = """你是启四的投资知识库助手。你的任务是根据检索到的历史文章片段，回答用户的问题。

规则：
1. 只基于提供的文章片段回答，不编造内容
2. 引用时标注文章标题和日期，格式为【标题, 日期】
3. 如果文章片段中没有相关信息，明确说"未找到相关文章"
4. 回答要简洁准确，保留启四的原话和关键数据
5. 如果启四在不同时期态度有变化，按时间线梳理"""


def search(query, top_k=8, year=None):
    """语义检索相关文章片段。"""
    model = get_model()
    query_embedding = model.encode([query], normalize_embeddings=True).tolist()

    client = chromadb.PersistentClient(path=DATA_DIR)
    collection = client.get_collection(name=COLLECTION_NAME)

    where = {"year": year} if year else None
    results = collection.query(
        query_embeddings=query_embedding,
        n_results=top_k,
        where=where,
        include=["documents", "metadatas", "distances"],
    )

    hits = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        hits.append({
            "text": doc,
            "title": meta.get("title", ""),
            "date": meta.get("date", ""),
            "year": meta.get("year", ""),
            "section_title": meta.get("section_title", ""),
            "filepath": meta.get("filepath", ""),
            "distance": dist,
        })

    return hits


def format_context(hits):
    """将检索结果格式化为 Claude 的上下文。"""
    parts = []
    for i, h in enumerate(hits, 1):
        parts.append(
            f"--- 片段 {i} ---\n"
            f"标题: {h['title']}\n"
            f"日期: {h['date']}\n"
            f"段落: {h['section_title']}\n"
            f"相关度: {1 - h['distance']:.2f}\n"
            f"内容:\n{h['text']}"
        )
    return "\n\n".join(parts)


def ask(question, top_k=8, year=None):
    """检索 + Claude 回答。"""
    # 1. 检索
    hits = search(question, top_k=top_k, year=year)
    if not hits:
        print("未检索到相关内容，请确认索引已构建（运行 indexer.py）")
        return

    # 2. 打印检索结果
    print("=" * 60)
    print(f"检索到 {len(hits)} 个相关片段：")
    print("=" * 60)
    for i, h in enumerate(hits, 1):
        score = 1 - h["distance"]
        print(f"  {i}. [{h['date']}] {h['title']} (相关度: {score:.2f})")
        if h["section_title"]:
            print(f"     段落: {h['section_title']}")
    print()

    # 3. 调用 Claude 生成回答
    context = format_context(hits)
    user_msg = f"以下是检索到的相关文章片段：\n\n{context}\n\n问题：{question}"

    # 读取 API 配置：优先环境变量，其次 ~/.claude/settings.json
    env_vars = {}
    for key in ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL",
                 "ANTHROPIC_MODEL", "ANTHROPIC_DEFAULT_SONNET_MODEL"]:
        val = os.environ.get(key)
        if val:
            env_vars[key] = val

    if not env_vars.get("ANTHROPIC_API_KEY") and not env_vars.get("ANTHROPIC_AUTH_TOKEN"):
        settings_path = os.path.expanduser("~/.claude/settings.json")
        if os.path.exists(settings_path):
            import json
            with open(settings_path) as f:
                settings = json.load(f)
            for k, v in settings.get("env", {}).items():
                if k not in env_vars:
                    env_vars[k] = v

    api_key = env_vars.get("ANTHROPIC_API_KEY") or env_vars.get("ANTHROPIC_AUTH_TOKEN")
    base_url = env_vars.get("ANTHROPIC_BASE_URL")
    client_kwargs = {}
    if api_key:
        client_kwargs["api_key"] = api_key
    if base_url:
        client_kwargs["base_url"] = base_url
    client = Anthropic(**client_kwargs)
    model = env_vars.get("ANTHROPIC_MODEL") or env_vars.get("ANTHROPIC_DEFAULT_SONNET_MODEL", "claude-sonnet-4-20250514")

    print("正在生成回答...")
    print("=" * 60)

    resp = client.messages.create(
        model=model,
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )
    for block in resp.content:
        if block.type == "text":
            print(block.text)

    print()


def search_only(query, top_k=8, year=None):
    """仅检索，不调用 Claude。"""
    hits = search(query, top_k=top_k, year=year)
    if not hits:
        print("未检索到相关内容")
        return

    print(f"检索到 {len(hits)} 个相关片段：\n")
    for i, h in enumerate(hits, 1):
        score = 1 - h["distance"]
        print(f"{'=' * 60}")
        print(f"片段 {i} | [{h['date']}] {h['title']} | 相关度: {score:.2f}")
        if h["section_title"]:
            print(f"段落: {h['section_title']}")
        print(f"文件: {h['filepath']}")
        print("-" * 60)
        # 截取前300字
        preview = h["text"][:300] + ("..." if len(h["text"]) > 300 else "")
        print(preview)
        print()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="日更文章 RAG 查询")
    parser.add_argument("query", nargs="?", help="查询内容")
    parser.add_argument("-k", "--top-k", type=int, default=8, help="返回结果数 (默认 8)")
    parser.add_argument("-y", "--year", help="限定年份，如 2024")
    parser.add_argument("--search-only", action="store_true", help="仅检索，不调用 Claude 生成回答")

    args = parser.parse_args()

    if not args.query:
        print("用法: python query.py '你的问题'")
        print("示例: python query.py '我对茅台的态度是什么'")
        print("选项: -k 10 (返回10个结果)  -y 2024 (限定年份)  --search-only (仅检索)")
        sys.exit(0)

    if args.search_only:
        search_only(args.query, top_k=args.top_k, year=args.year)
    else:
        ask(args.query, top_k=args.top_k, year=args.year)
