# 智能窗帘控制系统

## 项目介绍

智能窗帘控制系统是一个基于uni-app开发的物联网应用，通过连接OneNET物联网平台，实现对智能窗帘设备的远程监控和控制。该应用支持实时显示光照强度、窗帘角度，并可在自动/手动模式间切换，手动模式下可精确调节窗帘开合角度。

!应用预览

## 功能特点

- **双模式控制**：支持自动/手动两种模式
  - 自动模式：窗帘根据光照强度自动调节角度
  - 手动模式：用户可精确控制窗帘角度（30°步进调节）
- **实时数据监控**：
  - 光照强度实时显示（lux）
  - 窗帘当前角度显示（0°-180°）
- **用户友好界面**：
  - 直观的卡片式布局
  - 数据更新动画效果
  - 错误提示及重试机制
  - 支持下拉刷新

## 技术架构

### 前端框架

- uni-app (Vue 2.0)

### 数据通信

- OneNET物联网平台物模型API
- HTTP请求（uni.request）

### 安全认证

- HMAC-SHA1签名认证

## 工作原理

### 数据流程

1. **数据获取**
   - 应用通过定时轮询（3秒间隔）从OneNET平台获取设备数据
   - 支持手动下拉刷新获取最新数据
2. **控制流程**
   - 模式切换：通过[onCurtainModeSwitch](vscode-file://vscode-app/d:/Work/Microsoft VS Code/resources/app/out/vs/code/electron-sandbox/workbench/workbench.html)方法发送模式更改指令
   - 角度控制：通过[updateCurtainAngle](vscode-file://vscode-app/d:/Work/Microsoft VS Code/resources/app/out/vs/code/electron-sandbox/workbench/workbench.html)方法发送角度调整指令
3. **响应式更新**
   - 设备属性变化时展示动画效果
   - 操作结果通过Toast提示

### API通信

应用使用OneNET平台的物模型API进行通信：

1. **查询设备属性**

   GET /thingmodel/query-device-property

2. **设置设备属性**

   POST /thingmodel/set-device-property

所有API请求都通过HMAC-SHA1签名认证，由[key.js](vscode-file://vscode-app/d:/Work/Microsoft VS Code/resources/app/out/vs/code/electron-sandbox/workbench/workbench.html)中的`createCommonToken`函数生成认证令牌。

## 开发说明

### 项目结构

├── pages/

│  └── index/

│    └── index.vue   # 主界面

├── static/        # 静态资源

├── utils/

│  └── api.js       # API封装

├── key.js         # 认证token生成

├── App.vue        # 应用入口

├── main.js        # 应用初始化

└── manifest.json     # 应用配置

### 设备通信模型

设备属性定义：

- `light`: 光照强度值（lux）
- `angle`: 窗帘角度（0°-180°）
- `mode`: 工作模式（0-自动，1-手动）

## 使用说明

### 安装和运行

1. 克隆项目到本地
2. 使用HBuilderX打开项目
3. 运行到模拟器或真机

### 基本操作

1. **查看数据**：
   - 光照强度和窗帘角度实时显示在主界面
   - 下拉刷新获取最新数据
2. **模式切换**：
   - 点击开关切换自动/手动模式
3. **手动控制**：
   - 手动模式下，使用"+30°"和"-30°"按钮调整窗帘角度

## 注意事项

1. 应用需要网络连接才能正常工作
2. OneNET平台的认证信息需要妥善保管
3. 设备离线时会显示错误提示，可点击"重试"按钮重新连接

------

开发者：[阿白]
基于uni-app框架和OneNET物联网平台