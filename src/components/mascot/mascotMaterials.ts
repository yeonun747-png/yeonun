import * as THREE from "three";

/**
 * GLB 원본 PBR 재질을 유지하면서 웹에서 색감은 살리되,
 * 환경 반사(I·유리 광택)는 줄이고 털·동물 캐릭터에 가깝게 만듭니다.
 */
export function configureMascotPbrMaterials(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const skinned = obj instanceof THREE.SkinnedMesh;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const raw of mats) {
      if (!raw) continue;
      if (skinned && "skinning" in raw) {
        (raw as unknown as { skinning: boolean }).skinning = true;
      }

      if (
        raw instanceof THREE.MeshStandardMaterial ||
        raw instanceof THREE.MeshPhysicalMaterial
      ) {
        const m = raw;
        if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
        if (m.emissiveMap) m.emissiveMap.colorSpace = THREE.SRGBColorSpace;

        const baseEnv = m.envMapIntensity ?? 1;
        m.envMapIntensity = Math.min(baseEnv * 0.42, 0.48);

        const r0 = m.roughness ?? 0.5;
        m.roughness = THREE.MathUtils.clamp(r0 + 0.16, 0.42, 0.92);
        m.metalness = THREE.MathUtils.clamp(m.metalness ?? 0, 0, 0.04);

        if (m instanceof THREE.MeshPhysicalMaterial) {
          m.clearcoat = Math.min(m.clearcoat ?? 0, 0.06);
          if (m.clearcoatRoughness !== undefined) {
            m.clearcoatRoughness = Math.max(m.clearcoatRoughness ?? 0.5, 0.55);
          }
          m.transmission = Math.min(m.transmission ?? 0, 0);
        }

        m.needsUpdate = true;
      }
    }
  });
}
