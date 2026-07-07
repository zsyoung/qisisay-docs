"""
启四 AI 写作助手
根据今日市场要点，生成日更文章初稿。
"""

import os
import sys
import json
import argparse
from datetime import datetime

# 复用 query.py 的 RAG 检索和 Claude 调用
from query import search, format_context, get_model, DATA_DIR, COLLECTION_NAME
from writer_prompt import STYLE_PROMPT, DAILY_TEMPLATE, WEEKLY_TEMPLATE

try:
    from anthropic import Anthropic
except ImportError:
    Anthropic = None


def get_claude_client():
    """获取 Claude 客户端（复用 query.py 的逻辑）。"""
    env_vars = {}
    for key in ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL",
                 "ANTHROPIC_MODEL", "ANTHROPIC_DEFAULT_SONNET_MODEL"]:
        val = os.environ.get(key)
        if val:
            env_vars[key] = val

    if not env_vars.get("ANTHROPIC_API_KEY") and not env_vars.get("ANTHROPIC_AUTH_TOKEN"):
        settings_path = os.path.expanduser("~/.claude/settings.json")
        if os.path.exists(settings_path):
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
    return Anthropic(**client_kwargs), env_vars


def generate_daily_review(market_points, top_k=8):
    """生成每日复盘的「今日复盘」部分。"""
    # 1. RAG 检索相关历史文章
    hits = search(market_points, top_k=top_k)
    context = format_context(hits) if hits else "无相关历史文章。"

    # 2. 构造 prompt
    today = datetime.now().strftime("%Y年%m月%d日")
    user_msg = f"""今天的日期是{today}。

今日市场要点：
{market_points}

以下是检索到的相关历史文章片段，供参考（不要直接复制，只借鉴分析思路和数据）：

{context}

请根据以上信息，撰写「今日复盘」部分。要求：
1. 1500-3000字
2. 从行情概况切入，分析原因，给出你的判断
3. 引用具体数据（涨跌幅、成交量、估值等）
4. 如果有历史相似行情，可以类比
5. 分点论述，结构清晰
6. 保持你一贯的口语化但有深度的风格"""

    # 3. 调用 Claude
    client, env_vars = get_claude_client()
    model = env_vars.get("ANTHROPIC_MODEL") or env_vars.get("ANTHROPIC_DEFAULT_SONNET_MODEL", "claude-sonnet-4-20250514")

    resp = client.messages.create(
        model=model,
        max_tokens=4000,
        system=STYLE_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )

    for block in resp.content:
        if block.type == "text":
            return block.text
    return ""


def generate_weekly_analysis(topic, top_k=10):
    """生成周报的主题分析部分。"""
    hits = search(topic, top_k=top_k)
    context = format_context(hits) if hits else "无相关历史文章。"

    today = datetime.now().strftime("%Y年%m月%d日")
    user_msg = f"""今天的日期是{today}。

本周主题：{topic}

以下是检索到的相关历史文章片段：

{context}

请撰写周报的深度分析部分。要求：
1. 2000-4000字
2. 围绕主题展开，有深度有观点
3. 引用数据和历史案例
4. 给出明确的判断和操作建议
5. 分点论述，结构清晰
6. 标题用 ## 二级标题"""

    client, env_vars = get_claude_client()
    model = env_vars.get("ANTHROPIC_MODEL") or env_vars.get("ANTHROPIC_DEFAULT_SONNET_MODEL", "claude-sonnet-4-20250514")

    resp = client.messages.create(
        model=model,
        max_tokens=6000,
        system=STYLE_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )

    for block in resp.content:
        if block.type == "text":
            return block.text
    return ""


def write_daily(market_points, output_path=None):
    """生成每日复盘文章。"""
    print("正在检索相关历史文章...")
    review = generate_daily_review(market_points)

    # 组装完整文章
    today = datetime.now().strftime("%Y%m%d")

    # 去掉 AI 可能重复生成的标题
    review_clean = review.strip()
    if review_clean.startswith("## 今日复盘"):
        review_clean = review_clean[len("## 今日复盘"):].strip()
    elif review_clean.startswith("# 今日复盘"):
        review_clean = review_clean[len("# 今日复盘"):].strip()

    article = f"## 今日复盘\n\n{review_clean}\n\n"

    # 添加模板中的固定部分（ETF趋势、账户记录、数据观察）
    # 这些部分留空让用户手动填写
    article += """## ETF趋势分析模型

**市场强度分析**

最强势资产：___

最弱势资产：___

**趋势信号统计**

确立多头：___只 | 确立空头：___只

新增多头：___

新增空头：___

## 账户记录

1、轮动账户，今日收益率+___%。

2026年+___%；

2025年+41.21%；

2024年+18.92%；

2023年+29.98%。

2、四维轮动策略，今日___%。

2025/1/14成立以来，累计+___%，最大回撤-___%。

## 数据观察

> **✦可转债等权指数：**
>
> 今天涨幅___%，中位数___元，位于___星级估值区，___。
>
> **✦强赎倒计时：**
>
> ___
>
> **✦大盘拥挤度：**
>
> ___%

> 风险提示：本文内容仅供参考，不构成投资建议。投资决策应基于独立思考，据此操作盈亏自负，作者不承担任何连带责任。
"""

    if not output_path:
        output_path = f"../{today[:4]}/{today[4:6]}/{today}今日复盘.md"

    # 确保目录存在
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(article)

    print(f"\n已生成：{output_path}")
    print(f"「今日复盘」部分约 {len(review)} 字")
    print("其余部分（ETF趋势、账户记录、数据观察）请手动填写。")

    return article


def write_weekly(topic, output_path=None):
    """生成周报。"""
    print("正在检索相关历史文章...")
    analysis = generate_weekly_analysis(topic)

    today = datetime.now().strftime("%Y%m%d")
    article = f"""## 一、账户情况（周复盘）

**当前仓位**：场内___%，场外每周四定投四维轮动。

（手动填写）

## 二、{topic}

{analysis}

## 三、当前估值及分析

### 1、沪深300估值

日期：{datetime.now().strftime("%Y-%m-%d")}

十年期国债收益率：___%

沪深300：___，PE：___（百分位：___%）

股债收益差：___%（百分位：___%）

> 股债收益差抄底逃顶逻辑：
>
> 当股债收益差百分位达到95%以上时，沪深300就会进入钻石坑，即最佳抄底区间；
>
> 当股债收益差百分位达到5%以下时，沪深300就会达到危险顶部；
>
> 当股债收益差百分位小于20%时，可以考虑逐步减仓清仓。

### 2、转债估值

当前中位数：___，___星级，___

所有历史范围内所处百分位：___%

> 风险提示：本文内容仅供参考，不构成投资建议。投资决策应基于独立思考，据此操作盈亏自负，作者不承担任何连带责任。
"""

    if not output_path:
        output_path = f"../{today[:4]}/{today[4:6]}/{today}周报.md"

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(article)

    print(f"\n已生成：{output_path}")
    print(f"主题分析部分约 {len(analysis)} 字")
    print("账户情况和估值数据请手动填写。")

    return article


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="启四 AI 写作助手")
    parser.add_argument("type", choices=["daily", "weekly"], help="文章类型：daily=每日复盘，weekly=周报")
    parser.add_argument("points", help="今日市场要点或周报主题（用引号包裹）")
    parser.add_argument("-o", "--output", help="输出文件路径（默认自动命名）")
    parser.add_argument("-k", "--top-k", type=int, default=8, help="检索历史文章数量")

    args = parser.parse_args()

    if args.type == "daily":
        write_daily(args.points, output_path=args.output)
    else:
        write_weekly(args.points, output_path=args.output)
