module.exports = {
  apps: [
    {
      name: "soai-lite-api",
      script: "src/server.js",
      cwd: "/www/wwwroot/soai-lite-api",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "8787",
        SOAI_API_PUBLIC_BASE_URL: "https://api.soai.yun",
        SOAI_ADMIN_TOKEN: "replace-with-strong-admin-token",
        WECHAT_MINI_APP_ID: "wx85e25dc803ceab29",
        WECHAT_MINI_APP_SECRET: "replace-with-wechat-mini-program-app-secret",
        SOAI_WECHAT_LOGIN_ALLOW_MOCK: "false",
        SOAI_WECHAT_LOGIN_ALLOW_MOCK_ON_ERROR: "false",
        SOAI_STORAGE_PROVIDER: "local",
        SOAI_STORAGE_ROOT: "/data/soai-storage",
        SOAI_STORAGE_PUBLIC_BASE_URL: "https://api.soai.yun/storage",
        SOAI_DB_FILE: "/data/soai-storage/db/soai-db.json",
        SOAI_FRAME_FPS: "5",
        SOAI_MAX_VIDEO_DURATION_SEC: "15",
        SOAI_POSE_PROVIDER: "http",
        SOAI_POSE_SERVICE_URL: "http://127.0.0.1:8793",
        SOAI_POSE_MODEL_PROVIDER: "yolo-pose",
        SOAI_POSE_SERVICE_TIMEOUT_MS: "180000",
        SOAI_REQUIRE_REAL_POSE: "true",
        SOAI_POSE_ALLOW_SYNTHETIC_FALLBACK: "false",
        SOAI_MAX_UPLOAD_MB: "150",
        SOAI_LITE_INVITE_MAX_USERS: "20",
        SOAI_LITE_INVITE_CODES: "replace-with-comma-separated-20-invite-codes",
        SOAI_LITE_INTERNAL_INVITE_CODE: "replace-with-internal-audit-code",
        ALIYUN_OSS_BUCKET: "",
        ALIYUN_OSS_REGION: "",
        ALIYUN_OSS_ENDPOINT: "",
        ALIYUN_OSS_PUBLIC_BASE_URL: "",
        ALIYUN_OSS_UPLOAD_EXPIRES_SEC: "900",
        ALIYUN_ACCESS_KEY_ID: "",
        ALIYUN_ACCESS_KEY_SECRET: ""
      },
      max_memory_restart: "800M",
      error_file: "/root/.pm2/logs/soai-lite-api-error.log",
      out_file: "/root/.pm2/logs/soai-lite-api-out.log",
      merge_logs: true,
      time: true
    }
  ]
};
