module.exports = {
  apps: [
    {
      name: "soai-pose-service",
      script: "pose_service.py",
      cwd: "/www/wwwroot/soai-frontend/PythonPose服务",
      interpreter: "python3",
      instances: 1,
      exec_mode: "fork",
      env: {
        POSE_HOST: "127.0.0.1",
        POSE_PORT: "8793",
        POSE_PROVIDER: "synthetic",
        YOLO_POSE_MODEL_PATH: "",
        RTMPOSE_CONFIG_PATH: "",
        RTMPOSE_CHECKPOINT_PATH: "",
        RTMPOSE_DEVICE: "cpu"
      },
      max_memory_restart: "1600M",
      error_file: "/www/wwwlogs/soai-pose-service-error.log",
      out_file: "/www/wwwlogs/soai-pose-service-out.log",
      merge_logs: true,
      time: true
    }
  ]
};
