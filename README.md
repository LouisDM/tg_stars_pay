# Telegram Stars 支付系统

这是一个使用 Telegram Stars 支付系统的示例项目。通过这个机器人，用户可以：
- 使用 `/start` 开始使用机器人
- 使用 `/getlink` 获取支付链接
- 使用 `/pay` 直接发起支付
- 使用 `/status` 查看会员状态

## 功能特点

- ✨ 支持 Telegram Stars 支付
- 🔐 安全的用户验证机制
- 🔄 完整的支付流程
- 📱 支持 Mini App 集成
- 🌐 RESTful API 接口
- 📝 详细的日志记录
- ⚡ 异步支付处理
- 🔙 支持退款功能

## 技术栈

- Node.js
- Express.js - Web 服务器框架
- grammY - Telegram Bot 框架
- CORS - 跨域资源共享
- Telegram Web App SDK - Mini App 开发

## 快速开始

### 前置要求

- Node.js 14.0 或更高版本
- npm 6.0 或更高版本
- Telegram Bot Token
- HTTPS 域名（生产环境必需）

### 安装步骤

1. 克隆项目
```bash
git clone https://github.com/your-username/telegram-stars-example.git
cd telegram-stars-example
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
```bash
cp .env.example .env
```

4. 编辑 `.env` 文件，设置必要的环境变量：
```
TELEGRAM_BOT_TOKEN=你的机器人token
MEMBERSHIP_PHOTO_URL=会员服务图片URL（可选）
```

5. 启动服务
```bash
npm run start
```

## 运行方法

1. 直接运行（使用环境变量中的配置）
```bash
npm start
```

2. 使用自定义代理运行
```bash
export https_proxy=http://127.0.0.1:1080
export http_proxy=http://127.0.0.1:1080
export all_proxy=socks5://127.0.0.1:1080
npm start
```

## 配置说明

- 必需的配置：`TELEGRAM_BOT_TOKEN`（从 @BotFather 获取）
- 可选的配置：`MEMBERSHIP_PHOTO_URL`（会员服务的展示图片URL）
- 代理配置：`host` 和 `port`（根据你的代理软件配置修改）

## 使用方法

### 机器人命令

- `/start` - 启动机器人并关联账号
- `/pay` - 直接发起支付
- `/getlink` - 获取支付链接
- `/status` - 查看会员状态
- `/refund` - 申请退款

### API 接口

#### 创建支付链接

```http
POST /api/create-payment-link
Content-Type: application/json

{
    "initData": "Telegram Mini App initData",
    "websiteUserId": "用户在网站的ID"
}
```

响应示例：
```json
{
    "success": true,
    "data": {
        "paymentLink": "https://t.me/your_bot?start=pay_xxx",
        "userInfo": {
            "id": 123456789,
            "firstName": "John",
            "lastName": "Doe",
            "username": "johndoe"
        }
    }
}
```

#### 验证用户

```http
POST /api/validate-user
Content-Type: application/json

{
    "initData": "Telegram Mini App initData"
}
```

## Mini App 集成

1. 在你的 Mini App 中引入 Telegram Web App SDK：
```html
<script src="https://telegram.org/js/telegram-web-app.js"></script>
```

2. 调用支付接口示例：
```javascript
async function getPaymentLink(websiteUserId) {
    const initData = window.Telegram.WebApp.initData;
    const response = await fetch('your-api-url/api/create-payment-link', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            initData,
            websiteUserId
        })
    });
    
    const result = await response.json();
    if (result.success) {
        window.Telegram.WebApp.openLink(result.data.paymentLink);
    }
}
```

## 支付流程

1. 用户在 Mini App 中触发支付
2. 后端验证用户身份并创建支付链接
3. 用户确认支付金额
4. Telegram 处理支付流程
5. 支付成功后自动开通会员
6. 用户可查看会员状态或申请退款

详细的支付流程说明请查看 [payment-flow.md](docs/payment-flow.md)。

## 注意事项

1. **安全性**
   - 所有请求都需要验证 initData
   - 不要在代码中硬编码敏感信息
   - 生产环境必须使用 HTTPS

2. **最佳实践**
   - 建议实现请求频率限制
   - 保存详细的支付记录
   - 实现完善的错误处理
   - 添加监控和告警机制

3. **调试说明**
   - 开发环境可使用 ngrok 进行测试
   - 建议先使用小额支付测试
   - 查看日志以排查问题

## 错误代码说明

- `Invalid Telegram data` - initData 验证失败
- `User account not linked` - 用户未关联网站账号
- `User already has active membership` - 用户已是会员
- `Payment processing error` - 支付处理错误

## 贡献指南

欢迎提交 Issue 和 Pull Request。在提交 PR 之前，请确保：

1. 代码符合项目规范
2. 添加必要的测试
3. 更新相关文档
4. 遵循 Git commit 规范

## 许可证

本项目采用 MIT 许可证，详见 [LICENSE](LICENSE) 文件。

## 相关资源

- [Telegram Bot API 文档](https://core.telegram.org/bots/api)
- [Telegram Mini App 开发指南](https://core.telegram.org/bots/webapps)
- [Stars 支付系统介绍](https://core.telegram.org/bots/payments#stars-for-digital-goods)

## 联系方式

如有问题或建议，欢迎通过以下方式联系：

- 提交 [Issue](https://github.com/your-username/telegram-stars-example/issues)
- 发送邮件至 [your-email@example.com](mailto:your-email@example.com)
- 在 Telegram 上联系 [@your_telegram_username](https://t.me/your_telegram_username)
