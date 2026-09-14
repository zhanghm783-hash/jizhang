# 黑马记账

> 一款轻量、纯净的个人桌面记账工具。随手记下每一笔人民币花销，看清钱都花在了哪里。

黑马记账是基于 Tauri 的跨平台桌面应用，支持 **Windows** 和 **macOS**。所有数据保存在你自己的电脑上，**不联网、不上传**，隐私安全。

## ✨ 功能特性

- **记一笔**：快速记录一笔花销——金额、日期、两级分类、支付方式、备注
- **账单流水**：按日期分组展示账单，支持按月切换、编辑与删除（删除有二次确认）
- **本月汇总**：首页顶部实时显示本月总支出与消费笔数
- **统计图表**：
  - 📊 分类占比饼图
  - 📈 近 6 个月消费趋势折线图
  - 🏆 分类花费排行
- **分类管理**：支持自定义增删改分类，内置 10 个一级分类、50 个二级分类（内置分类受保护，不可修改或删除）
- **本地保存**：数据存储在本机 SQLite 数据库中，无需联网即可使用

## 🏗 技术栈

| 用途 | 选型 |
| --- | --- |
| 桌面应用框架 | [Tauri 2](https://tauri.app) |
| 界面开发 | Vue 3 + Vite + TypeScript |
| 界面组件库 | [Element Plus](https://element-plus.org) |
| 状态管理 | Pinia |
| 统计图表 | [ECharts](https://echarts.apache.org) |
| 本地数据库 | SQLite（tauri-plugin-sql） |

## 🚀 快速开始

### 环境要求

- Node.js（LTS 长期支持版）
- Rust（通过 [rustup](https://rustup.rs) 安装）
- Windows：Microsoft C++ Build Tools（勾选「使用 C++ 的桌面开发」工作负载）
- macOS：Xcode Command Line Tools

### 开发运行

```bash
# 安装依赖
npm install

# 启动开发模式（会自动打开应用窗口）
npm run tauri dev
```

### 打包安装包

```bash
npm run tauri build
```

> 注意：Windows 安装包需要在 Windows 上打包，Mac 安装包需要在 Mac 上打包。

## 💾 数据与隐私

- 所有数据保存在本机 SQLite 数据库文件（`heima.db`）中，由 Tauri 的应用数据目录管理
  - Windows：`%APPDATA%` 目录下
  - macOS：`~/Library/Application Support/` 目录下
- 应用完全离线运行，不会联网、不会上传任何数据
- 换电脑时，拷贝数据库文件即可迁移数据

## 📝 版本历史

| 版本 | 更新内容 |
| --- | --- |
| v1.0 | 首个版本：记账统计（记一笔、账单流水、编辑删除、本月汇总、统计图表） |
| v1.1 | 分类管理：支持自定义增删改分类 |
| v1.2 | 应用改名：记账APP |
| v1.3 | 应用改名：黑马记账（最终定名） |
