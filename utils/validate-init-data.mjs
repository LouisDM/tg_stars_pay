import crypto from 'crypto';

/**
 * 验证来自 Telegram Mini App 的 initData
 * @param {string} initData - 从 Telegram.WebApp.initData 获取的初始化数据
 * @param {string} botToken - Bot Token
 * @returns {Object} 解析后的数据对象，验证失败则抛出错误
 */
export function validateInitData(initData, botToken) {
  try {
    // 1. 解析 initData 字符串
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) {
      throw new Error('Hash not found in initData');
    }

    // 2. 按字母顺序排序数据字段
    const dataToCheck = Array.from(urlParams.entries())
      .filter(([key]) => key !== 'hash')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // 3. 使用 bot token 的 HMAC-SHA-256 进行验证
    const secretKey = crypto
      .createHash('sha256')
      .update(botToken)
      .digest();

    const hmac = crypto
      .createHmac('sha256', secretKey)
      .update(dataToCheck)
      .digest('hex');

    // 4. 比较计算的哈希值与接收到的哈希值
    if (hmac !== hash) {
      throw new Error('Invalid hash');
    }

    // 5. 解析并返回数据对象
    const result = {};
    for (const [key, value] of urlParams.entries()) {
      if (key !== 'hash') {
        try {
          result[key] = JSON.parse(value);
        } catch {
          result[key] = value;
        }
      }
    }

    return result;
  } catch (error) {
    throw new Error(`InitData validation failed: ${error.message}`);
  }
}

/**
 * 从 initData 中提取用户信息
 * @param {Object} validatedData - 已验证的 initData 对象
 * @returns {Object} 用户信息对象
 */
export function extractUserInfo(validatedData) {
  if (!validatedData.user) {
    throw new Error('User data not found in initData');
  }

  const user = typeof validatedData.user === 'string' 
    ? JSON.parse(validatedData.user) 
    : validatedData.user;

  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
    languageCode: user.language_code,
    isPremium: user.is_premium || false
  };
}
