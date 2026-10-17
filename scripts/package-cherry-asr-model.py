"""Shard an audited native Qwen3-ASR conversion without changing tensor values.

Run with uv run --with torch==2.14.1 --with safetensors==0.8.0
--with huggingface_hub==2.2.0 python scripts/package-cherry-asr-model.py INPUT OUTPUT.
"""
import hashlib
import json
from pathlib import Path
import shutil
import sys

from huggingface_hub import save_torch_state_dict
from safetensors.torch import load_file

source, output = map(Path, sys.argv[1:])
config = json.loads((source / 'config.json').read_text())
if config['text_config']['num_hidden_layers'] != 28 or config['quantization'] != {'group_size': 64, 'bits': 8, 'mode': 'affine'}:
    raise ValueError('Expected Qwen3-ASR 1.7B affine 8-bit conversion')
output.mkdir(parents=True, exist_ok=False)
save_torch_state_dict(load_file(source / 'model.safetensors'), output, max_shard_size='1500MB')
for name in ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'generation_config.json', 'processor_config.json', 'chat_template.jinja']:
    shutil.copy2(source / name, output / name)
files = []
for path in sorted(output.iterdir()):
    with path.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    files.append({'relPath': path.name, 'asset': path.name, 'sizeBytes': path.stat().st_size, 'sha256': digest})
manifest = {
    'repository': 'CherryHQ/mlx-node',
    'tag': 'qwen3-asr-1.7b-8bit-5db3d24bc87a-r1',
    'sourceRevision': '5db3d24bc87a9eb6fdb48c7ab3c9d8f126bf8d7d',
    'modelRevision': 'bcd2b5b7f32b480ab5790554cfa8347f246a14f3',
    'upstream': 'Qwen/Qwen3-ASR-1.7B-hf',
    'files': files,
}
(output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
