module.exports = function (req, res) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'private, no-store, max-age=0');
  const publicKey = process.env.PERFECTPAY_PUBLIC_KEY || '';
  const secretKey = process.env.PERFECTPAY_SECRET_KEY || '';
  res.status(200).json({
    configured: Boolean(publicKey && secretKey),
    publicKey,
    apiBase: process.env.PERFECTPAY_API_BASE || 'https://api.perfectpay.ai',
    sdkUrl: process.env.PERFECTPAY_SDK_URL || 'https://sdk.perfectpay.ai/web/latest/v1/PerfectLoader.js',
    currency: process.env.PERFECTPAY_CURRENCY || 'BRL'
  });
};
