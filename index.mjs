import { Bot } from "grammy";
import { SocksProxyAgent } from 'socks-proxy-agent';
import express from 'express';
import cors from 'cors';
import { validateInitData, extractUserInfo } from './utils/validate-init-data.mjs';

// 配置和常量
const CONFIG = {
  MEMBERSHIP_PRICE: 1, // 1 star ≈ $0.02
  CURRENCY: 'XTR',
  PROVIDER_TOKEN: process.env.PROVIDER_TOKEN || "",  // 测试用的provider token
  PROXY_URL: 'socks5://127.0.0.1:1080',
  API_BASE_URL: process.env.API_BASE_URL || 'https://your-website.com/api',
  API_KEY: process.env.API_KEY,
  BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  MEMBERSHIP_PHOTO_URL: process.env.MEMBERSHIP_PHOTO_URL,
  PORT: process.env.PORT || 3000
};

// 代理配置
const PROXY_CONFIG = {
  host: "127.0.0.1",
  port: 1080,
  type: 5
};

// 检查环境变量
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error("错误：TELEGRAM_BOT_TOKEN 环境变量未设置");
  process.exit(1);
}

console.log("正在使用的 bot token:", process.env.TELEGRAM_BOT_TOKEN);
console.log("正在使用代理:", `socks5://${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`);

// 创建代理 agent
const proxyAgent = new SocksProxyAgent(`socks5://${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`);

// 用于记录用户操作的简单日志函数
const logger = {
  info: (message, data = {}) => {
    console.log(new Date().toISOString() + " INFO: " + message, data);
  },
  error: (message, data = {}) => {
    console.error(new Date().toISOString() + " ERROR: " + message, data);
  },
  warn: (message, data = {}) => {
    console.warn(new Date().toISOString() + " WARN: " + message, data);
  }
};

// 创建 bot 实例
const bot = new Bot(CONFIG.BOT_TOKEN, {
  client: {
    baseFetchConfig: {
      compress: true,
      timeout: 30000,
      retry: 3,
      agent: proxyAgent
    }
  }
});

// 添加错误处理中间件
bot.catch((err) => {
  logger.error("Bot error:", err);
});

// 添加调试中间件
bot.use((ctx, next) => {
  logger.info("收到更新:", {
    type: ctx.updateType,
    from: ctx.from,
    text: ctx.message?.text
  });
  return next();
});

// 内存数据存储 (生产环境建议使用数据库)
const paidUsers = new Map();
const userMapping = new Map();

// API 请求工具函数
async function callApi(endpoint, method = 'POST', data = {}) {
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.API_KEY}`
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    logger.error(`API call failed: ${endpoint}`, error);
    throw error;
  }
}

// Bot 命令处理器
bot.command("start", async (ctx) => {
  const userId = ctx.from?.id;
  logger.info("Received /start command", { userId });
  
  try {
    const startParam = ctx.message?.text.split(' ')[1];
    logger.info("Start parameter:", { startParam });
    
    if (startParam) {
      userMapping.set(userId, startParam);
      logger.info("Mapped user IDs", { telegramId: userId, websiteId: startParam });
      
      await ctx.reply(
        `欢迎！您的 Telegram 账号已经与网站账号 (ID: ${startParam}) 关联。可用的命令：\n\n` +
        `/pay - 支付会员费\n` +
        `/status - 查看会员状态\n` +
        `/refund - 申请退款\n` +
        `/getlink - 获取支付链接`
      );
    } else {
      await ctx.reply(
        "请从我们的网站启动机器人以关联您的账号。如果您已经完成关联，可用的命令：\n\n" +
        `/pay - 支付会员费\n` +
        `/status - 查看会员状态\n` +
        `/refund - 申请退款\n` +
        `/getlink - 获取支付链接`
      );
    }
  } catch (error) {
    logger.error("Error in /start command", error);
    await ctx.reply("抱歉，出现了一个错误。请重试。");
  }
});

bot.command("pay", async (ctx) => {
  const userId = ctx.from?.id;
  logger.info("Received /pay command", { userId });
  
  try {
    if (!userMapping.has(userId)) {
      await ctx.reply("请从我们的网站启动机器人以关联您的账号。");
      return;
    }

    // 检查用户是否已经是会员
    if (paidUsers.has(userId)) {
      await ctx.reply("您已经是会员！使用 /status 查看您的会员状态。");
      return;
    }

    await ctx.replyWithInvoice(
      "会员费", // 标题
      "获取高级功能", // 描述
      "{}", // payload
      CONFIG.CURRENCY,
      [{ amount: CONFIG.MEMBERSHIP_PRICE, label: "高级会员" }]
    );
    
    logger.info("Sent invoice", { userId });
  } catch (error) {
    logger.error("Error in /pay command", error);
    await ctx.reply("抱歉，支付出现了一个错误。请重试。");
  }
});

bot.on("pre_checkout_query", async (ctx) => {
  const userId = ctx.from?.id;
  logger.info("Received pre_checkout_query", { userId });
  
  try {
    await ctx.answerPreCheckoutQuery(true);
    logger.info("Approved pre_checkout_query", { userId });
  } catch (error) {
    logger.error("Error in pre_checkout_query", error);
    try {
      await ctx.answerPreCheckoutQuery(false, "支付处理错误，请重试");
    } catch (e) {
      logger.error("Failed to send pre_checkout_query error", e);
    }
  }
});

bot.on("message:successful_payment", async (ctx) => {
  const userId = ctx.from?.id;
  logger.info("Received successful_payment", { userId });
  
  try {
    if (!ctx.message?.successful_payment || !ctx.from) {
      logger.error("Missing payment data", { userId });
      return;
    }

    const websiteUserId = userMapping.get(userId);
    if (!websiteUserId) {
      logger.error("No website user mapping found", { userId });
      await ctx.reply("支付成功，但找不到您的网站账号。请联系支持。");
      return;
    }

    const paymentInfo = {
      chargeId: ctx.message.successful_payment.telegram_payment_charge_id,
      websiteUserId: websiteUserId,
      paidAt: new Date().toISOString(),
      amount: ctx.message.successful_payment.total_amount,
      currency: ctx.message.successful_payment.currency
    };

    // 保存支付信息
    paidUsers.set(userId, paymentInfo);
    
    // 调用网站 API 激活会员
    try {
      await callApi('set-membership', 'POST', {
        userId: websiteUserId,
        telegramUserId: userId,
        ...paymentInfo
      });

      logger.info("Activated membership", { userId, websiteUserId });
      await ctx.reply(
        "感谢您的支付！您的会员已经激活。您现在可以访问我们的网站的高级功能。"
      );
    } catch (error) {
      logger.error("Failed to activate membership", { userId, error });
      await ctx.reply(
        "支付成功，但激活会员出现了一个错误。我们的团队将尽快解决这个问题。"
      );
    }
  } catch (error) {
    logger.error("Error in successful_payment", error);
  }
});

bot.command("getlink", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("无法识别用户ID，请重试");
    return;
  }

  try {
    const data = {
      title: "会员服务",
      description: "获取高级功能",
      payload: JSON.stringify({ userId }),
      currency: "XTR",
      prices: [{
        label: "高级会员",
        amount: 100
      }],
      provider_token: "XTR"
    };

    logger.info("Creating invoice with params", data);
    const invoiceLink = await ctx.api.createInvoiceLink(
      data.title,
      data.description,
      data.payload,
      data.provider_token,
      data.currency,
      data.prices
    );
    
    await ctx.reply(
      "这是您的支付链接：\n" + invoiceLink + "\n\n" +
      "点击链接完成支付。支付后，您的会员将自动激活。"
    );
  } catch (error) {
    logger.error("创建支付链接失败", { userId, error });
    await ctx.reply("抱歉，创建支付链接出现了错误。请重试。");
  }
});

bot.command("status", async (ctx) => {
  const userId = ctx.from?.id;
  logger.info("Received /status command", { userId });
  
  try {
    const websiteUserId = userMapping.get(userId);
    if (!websiteUserId) {
      await ctx.reply("您的 Telegram 账号尚未关联网站账号。请从我们的网站启动机器人。");
      return;
    }

    const paymentInfo = paidUsers.get(userId);
    if (paymentInfo) {
      await ctx.reply(
        `您的账号状态：
- 网站用户 ID：${websiteUserId}
- 会员状态：激活
- 支付 ID：${paymentInfo.chargeId}
- 支付时间：${new Date(paymentInfo.paidAt).toLocaleString()}`
      );
    } else {
      await ctx.reply(
        `您的账号状态：
- 网站用户 ID：${websiteUserId}
- 会员状态：未激活
- 您可以使用 /pay 购买会员`
      );
    }
  } catch (error) {
    logger.error("Error in /status command", error);
    await ctx.reply("抱歉，查看状态出现了一个错误。请重试。");
  }
});

bot.command("refund", async (ctx) => {
  const userId = ctx.from?.id;
  logger.info("Received /refund command", { userId });
  
  try {
    if (!userId || !paidUsers.has(userId)) {
      await ctx.reply("您尚未支付，无法退款");
      return;
    }

    const paymentInfo = paidUsers.get(userId);
    
    try {
      // 调用 Telegram API 进行退款
      await ctx.api.refundStarPayment(userId, paymentInfo.chargeId);
      
      // 调用网站 API 取消会员资格
      await callApi('cancel-membership', 'POST', {
        userId: paymentInfo.websiteUserId,
        telegramUserId: userId,
        chargeId: paymentInfo.chargeId
      });
      
      // 移除支付记录
      paidUsers.delete(userId);
      
      logger.info("Processed refund successfully", { userId });
      await ctx.reply(
        "退款成功！星星已经返还到您的账号。会员特权已经取消。"
      );
    } catch (error) {
      logger.error("Failed to process refund", { userId, error });
      await ctx.reply(
        "退款处理错误。请稍后重试或联系支持。"
      );
    }
  } catch (error) {
    logger.error("Error in /refund command", error);
    await ctx.reply("抱歉，退款出现了一个错误。请重试。");
  }
});

// 错误处理中间件
bot.catch((err) => {
  const ctx = err.ctx;
  logger.error(`Error while handling update ${ctx.update.update_id}:`, err.error);
  
  // 尝试向用户发送错误消息
  try {
    if (ctx.message) {
      ctx.reply("抱歉，处理您的请求时出现了问题。请稍后再试。").catch(e => {
        logger.error("Failed to send error message:", e);
      });
    }
  } catch (e) {
    logger.error("Error in error handler:", e);
  }
});

// 启动 bot
console.log("正在启动机器人...");
bot.start({
  onStart(botInfo) {
    console.log("机器人启动成功！", {
      username: botInfo.username,
      id: botInfo.id
    });
  },
  drop_pending_updates: true
}).catch(err => {
  console.error("启动失败:", err);
  process.exit(1);
});

// 创建 Express 应用
const app = express();
app.use(cors());
app.use(express.json());

// Mini App API 路由
app.post('/api/validate-user', async (req, res) => {
  try {
    const { initData } = req.body;
    if (!initData) {
      throw new Error('initData is required');
    }

    // 验证 initData
    const validatedData = validateInitData(initData, CONFIG.BOT_TOKEN);
    const userInfo = extractUserInfo(validatedData);

    // 检查用户是否已经映射
    const websiteUserId = userMapping.get(userInfo.id);
    const paymentInfo = paidUsers.get(userInfo.id);

    res.json({
      success: true,
      user: {
        ...userInfo,
        websiteUserId,
        membershipStatus: paymentInfo ? 'active' : 'inactive',
        membershipInfo: paymentInfo || null
      }
    });
  } catch (error) {
    logger.error('Error validating user:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// 创建支付链接的 API 接口
app.post('/api/create-payment-link', async (req, res) => {
  try {
    const { initData, websiteUserId } = req.body;
    
    if (!initData || !websiteUserId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    // 验证 initData 并获取用户信息
    const validatedData = validateInitData(initData, CONFIG.BOT_TOKEN);
    const userInfo = extractUserInfo(validatedData);
    const userId = userInfo.id;

    // 将用户ID映射保存到内存中
    userMapping.set(userId, websiteUserId);
    
    // 创建支付链接
    const invoiceLink = await bot.api.createInvoiceLink(
      "会员服务",
      "获取高级功能",
      "{}", 
      "XTR",
      [{ label: "高级会员", amount: 100 }]
    );
    
    res.json({
      success: true,
      data: {
        paymentLink: invoiceLink,
        userInfo: userInfo // 可选：返回用户信息供前端使用
      }
    });
    
  } catch (error) {
    logger.error('Error creating payment link via API', error);
    
    // 返回用户友好的错误信息
    let errorMessage = 'Failed to create payment link';
    if (error.message.includes('InitData validation failed')) {
      errorMessage = 'Invalid Telegram data';
    } else if (error.message === 'User not linked to website account') {
      errorMessage = 'User account not linked';
    } else if (error.message === 'User is already a member') {
      errorMessage = 'User already has active membership';
    }
    
    res.status(400).json({
      success: false,
      error: errorMessage
    });
  }
});

// 添加健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    botRunning: true,
    timestamp: new Date().toISOString()
  });
});

// 启动 Express 服务器
app.listen(CONFIG.PORT, () => {
  logger.info(`API server started on port ${CONFIG.PORT}`);
});
