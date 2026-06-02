import os
import unittest

from pose_service import (
    COCO_ORDER,
    KEYPOINT_NAMES,
    best_coco_pose_to_soai,
    coco_points_to_soai,
    empty_keypoints,
    normalize_provider_name,
    provider_status,
)


class PoseContractTest(unittest.TestCase):
    def test_coco_points_are_mapped_to_soai_keypoints(self):
        xy = [[index * 10 + 1, index * 10 + 2] for index, _ in enumerate(COCO_ORDER)]
        confidence = [0.5 + index * 0.01 for index, _ in enumerate(COCO_ORDER)]

        keypoints = coco_points_to_soai(xy, confidence)

        self.assertEqual(sorted(keypoints.keys()), sorted(KEYPOINT_NAMES))
        self.assertEqual(keypoints["nose"]["x"], 1)
        self.assertEqual(keypoints["leftShoulder"]["x"], 51)
        self.assertEqual(keypoints["rightShoulder"]["y"], 62)
        self.assertEqual(keypoints["leftAnkle"]["x"], 151)
        self.assertEqual(keypoints["rightAnkle"]["confidence"], 0.66)

    def test_best_coco_pose_selects_highest_confidence_person(self):
        low_xy = [[10, 10] for _ in COCO_ORDER]
        high_xy = [[20, 20] for _ in COCO_ORDER]
        low_confidence = [0.2 for _ in COCO_ORDER]
        high_confidence = [0.9 for _ in COCO_ORDER]

        keypoints = best_coco_pose_to_soai([
            (low_xy, low_confidence),
            (high_xy, high_confidence),
        ])

        self.assertEqual(keypoints["leftHip"]["x"], 20)
        self.assertEqual(keypoints["leftHip"]["confidence"], 0.9)

    def test_empty_candidates_return_zero_confidence_keypoints(self):
        keypoints = best_coco_pose_to_soai([])
        self.assertEqual(sorted(keypoints.keys()), sorted(KEYPOINT_NAMES))
        self.assertTrue(all(item["confidence"] == 0 for item in keypoints.values()))
        self.assertEqual(keypoints, empty_keypoints())

    def test_provider_status_reports_missing_model_configuration(self):
        old_yolo = os.environ.pop("YOLO_POSE_MODEL_PATH", None)
        old_config = os.environ.pop("RTMPOSE_CONFIG_PATH", None)
        old_checkpoint = os.environ.pop("RTMPOSE_CHECKPOINT_PATH", None)
        try:
            self.assertEqual(normalize_provider_name("yolopose"), "yolo-pose")
            self.assertEqual(normalize_provider_name("rtm-pose"), "rtmpose")
            self.assertIn("YOLO_POSE_MODEL_PATH", provider_status("yolo-pose")["missing"])
            self.assertIn("RTMPOSE_CONFIG_PATH", provider_status("rtmpose")["missing"])
            self.assertIn("RTMPOSE_CHECKPOINT_PATH", provider_status("rtmpose")["missing"])
        finally:
            if old_yolo is not None:
                os.environ["YOLO_POSE_MODEL_PATH"] = old_yolo
            if old_config is not None:
                os.environ["RTMPOSE_CONFIG_PATH"] = old_config
            if old_checkpoint is not None:
                os.environ["RTMPOSE_CHECKPOINT_PATH"] = old_checkpoint


if __name__ == "__main__":
    unittest.main()
