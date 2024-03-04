#!/bin/bash

# 切换到指定目录
cd /Users/mlamp/Library/CloudStorage/OneDrive-个人/write

# 添加所有更改到暂存区
git add .

# 提交更改
git commit -m "Automatic commit $(date +"%Y-%m-%d %H:%M:%S")"

# 推送更改到远程仓库
git push

