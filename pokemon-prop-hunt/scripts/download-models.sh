#!/bin/bash
TOKEN="6a5b6900bb3d4f57bb8caa30ae813492"
OUT_DIR="/home/ubuntu/DevForge/pokemon-prop-hunt/public/models"
mkdir -p "$OUT_DIR"

download_model() {
  local uid="$1"
  local name="$2"
  
  echo "[$name] Getting download URL..."
  local url=$(curl -s "https://api.sketchfab.com/v3/models/$uid/download" \
    -H "Authorization: Token $TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if 'glb' in data:
    print(data['glb']['url'])
elif 'gltf' in data:
    print('GLTF:' + data['gltf']['url'])
else:
    print('ERROR')
" 2>/dev/null)

  if [[ "$url" == ERROR* ]] || [[ -z "$url" ]]; then
    echo "[$name] FAILED to get download URL"
    return 1
  fi

  if [[ "$url" == GLTF:* ]]; then
    local gltf_url="${url#GLTF:}"
    echo "[$name] No GLB, downloading GLTF zip..."
    curl -sL "$gltf_url" -o "$OUT_DIR/${name}.zip"
    echo "[$name] Downloaded GLTF zip ($(du -h "$OUT_DIR/${name}.zip" | cut -f1))"
    return 0
  fi

  echo "[$name] Downloading GLB..."
  curl -sL "$url" -o "$OUT_DIR/${name}.glb"
  local size=$(du -h "$OUT_DIR/${name}.glb" | cut -f1)
  echo "[$name] Done ($size)"
}

declare -A MODELS
MODELS=(
  ["pokeball"]="9b29539199c14ddea4de7776c4d758df"
  ["pikachu"]="c22dab8fc3064c76a0c502d64555a74f"
  ["bulbasaur"]="64815cda802746b8b1be2e2246db4b35"
  ["charmander"]="f243d57b2d52477982014722d23d13c0"
  ["squirtle"]="102ca3237aac44a6b5b15d6e3fbdc1df"
  ["eevee"]="9b7f0605ef1443d5a25757484ca484c7"
  ["snorlax"]="875b17ed30d84003b1dc0e682e6b9650"
  ["gengar"]="b24c17c4cdb74b15a15fab7363c2b5bb"
  ["jigglypuff"]="76ab579e21b74697a90efe566a7293c3"
  ["pokemon-room"]="b23b6b253207463c97db2a7092adff74"
)

for name in "${!MODELS[@]}"; do
  download_model "${MODELS[$name]}" "$name" &
done

wait
echo ""
echo "=== All downloads complete ==="
ls -lh "$OUT_DIR/"
