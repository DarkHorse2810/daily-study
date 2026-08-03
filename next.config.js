/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 写真から解答を読み取る機能で、スマホ/iPadのカメラで撮った画像（数MBになりがち）を
    // Server Actionに渡すため、デフォルトの1MB上限だと画像送信時にリクエストが拒否され
    // 「An error occurred in the Server Components render」という汎用エラーになっていた。
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

module.exports = nextConfig;
