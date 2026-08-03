import copy
import json
import unittest
from pathlib import Path

from dhevals_core.model_manifest import load_model_manifest, model_manifest_hash, validate_model_manifest
from dhevals_core.models import ValidationError
from dhevals_core.model_manifest_cli import main as manifest_cli_main


ROOT = Path(__file__).resolve().parents[3]
MANIFEST_PATH = ROOT / "benchmarks" / "models" / "sacilm" / "v0.1" / "model.json"


class ModelManifestTests(unittest.TestCase):
    def test_initial_sacilm_manifest_is_valid_and_hashable(self):
        manifest = load_model_manifest(MANIFEST_PATH)
        self.assertEqual(manifest["id"], "sacilm")
        self.assertEqual(manifest["post_training"]["tool"], "Unsloth")
        self.assertEqual(manifest["training_runtime"]["provider"], "RunPod")
        self.assertEqual(len(model_manifest_hash(manifest)), 64)

    def test_external_model_manifest_can_record_a_different_post_training_tool(self):
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        manifest["id"] = "qwen-external"
        manifest["post_training"]["tool"] = "Axolotl"
        self.assertEqual(validate_model_manifest(manifest)["post_training"]["tool"], "Axolotl")

    def test_draft_manifest_requires_explicit_ready_gate(self):
        with self.assertRaisesRegex(ValidationError, "status must be ready"):
            load_model_manifest(MANIFEST_PATH, require_ready=True)

    def test_ready_manifest_rejects_unfrozen_provenance(self):
        manifest = load_model_manifest(MANIFEST_PATH)
        manifest["status"] = "ready"
        with self.assertRaisesRegex(ValidationError, "checkpoint.sha256 must contain"):
            validate_model_manifest(manifest, require_ready=True)

    def test_ready_manifest_accepts_concrete_training_provenance(self):
        manifest = load_model_manifest(MANIFEST_PATH)
        manifest.update({"status": "ready"})
        manifest["base_model"].update({"id": "base-model-v1", "license": "apache-2.0"})
        manifest["checkpoint"].update({"id": "sacilm-v1", "revision": "git:abc123", "sha256": "a" * 64})
        manifest["post_training"].update({"quantization": "4bit-nf4", "training_commit": "git:def456"})
        manifest["post_training"]["dataset"].update({"sha256": "b" * 64, "license": "internal-reviewed"})
        manifest["post_training"]["config"].update({"lora": "r=16-alpha=32", "sequence_length": 4096, "packing": True})
        manifest["training_runtime"].update({"hardware": "A100-80GB", "image": "ghcr.io/example/unsloth@sha256:" + "c" * 64})
        validated = validate_model_manifest(manifest, require_ready=True)
        self.assertEqual(validated["status"], "ready")

    def test_credentials_are_rejected_even_when_nested(self):
        manifest = load_model_manifest(MANIFEST_PATH)
        unsafe = copy.deepcopy(manifest)
        unsafe["inference_runtime"]["headers"] = {"api_key": "do-not-store"}
        with self.assertRaisesRegex(ValidationError, "looks like a credential"):
            validate_model_manifest(unsafe)

    def test_invalid_dataset_hash_is_rejected(self):
        manifest = load_model_manifest(MANIFEST_PATH)
        invalid = copy.deepcopy(manifest)
        invalid["post_training"]["dataset"]["sha256"] = "abc"
        with self.assertRaisesRegex(ValidationError, "dataset.sha256"):
            validate_model_manifest(invalid)

    def test_cli_validate_and_hash(self):
        self.assertEqual(manifest_cli_main(["validate", "--manifest", str(MANIFEST_PATH)]), 0)
        self.assertEqual(manifest_cli_main(["hash", "--manifest", str(MANIFEST_PATH)]), 0)


if __name__ == "__main__":
    unittest.main()
