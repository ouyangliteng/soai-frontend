module.exports = {
  apps: [
    {
      name: "soai-api",
      script: "src/server.js",
      cwd: "/www/wwwroot/soai-frontend/后端Mock服务",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "8787",
        SOAI_API_PUBLIC_BASE_URL: "https://api.soai.yun",
        SOAI_STORAGE_PROVIDER: "local",
        SOAI_STORAGE_ROOT: "/data/soai-storage",
        SOAI_STORAGE_PUBLIC_BASE_URL: "https://api.soai.yun/storage",
        SOAI_DB_FILE: "/data/soai-storage/db/soai-db.json",
        SOAI_FRAME_FPS: "4",
        SOAI_POSE_PROVIDER: "synthetic"
      },
      max_memory_restart: "800M",
      error_file: "/www/wwwlogs/soai-api-error.log",
      out_file: "/www/wwwlogs/soai-api-out.log",
      merge_logs: true,
      time: true
    }
  ]
};
