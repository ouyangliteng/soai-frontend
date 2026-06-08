module.exports = {
  apps: [
    {
      name: "soai-api",
      script: "src/server.js",
      cwd: "/www/wwwroot/soai-lite-api/后端Mock服务",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "8787",
        SOAI_API_PUBLIC_BASE_URL: "https://api.soai.yun",
        SOAI_ADMIN_TOKEN: "replace-with-strong-admin-token",
        SOAI_STORAGE_PROVIDER: "local",
        SOAI_STORAGE_ROOT: "/data/soai-storage",
        SOAI_STORAGE_PUBLIC_BASE_URL: "https://api.soai.yun/storage",
        SOAI_DB_FILE: "/data/soai-storage/db/soai-db.json",
        SOAI_FRAME_FPS: "1",
        SOAI_MAX_VIDEO_DURATION_SEC: "15",
        SOAI_POSE_PROVIDER: "http",
        SOAI_POSE_SERVICE_URL: "http://127.0.0.1:8793",
        SOAI_POSE_MODEL_PROVIDER: "yolo-pose",
        SOAI_POSE_SERVICE_TIMEOUT_MS: "30000",
        SOAI_REQUIRE_REAL_POSE: "true",
        SOAI_POSE_ALLOW_SYNTHETIC_FALLBACK: "false",
        SOAI_MAX_UPLOAD_MB: "150",
        ALIYUN_OSS_BUCKET: "",
        ALIYUN_OSS_REGION: "",
        ALIYUN_OSS_ENDPOINT: "",
        ALIYUN_OSS_PUBLIC_BASE_URL: "",
        ALIYUN_OSS_UPLOAD_EXPIRES_SEC: "900",
        ALIYUN_ACCESS_KEY_ID: "",
        ALIYUN_ACCESS_KEY_SECRET: ""
      },
      max_memory_restart: "800M",
      error_file: "/www/wwwlogs/soai-api-error.log",
      out_file: "/www/wwwlogs/soai-api-out.log",
      merge_logs: true,
      time: true
    }
  ]
};
