import * as THREE from "three";

/** 화면 픽셀 → z=0 평면과의 교차 (Perspective / Orthographic 공통 Raycaster) */
export function clientToWorldOnZPlane(
  clientX: number,
  clientY: number,
  camera: THREE.Camera,
  size: { width: number; height: number },
  planeZ = 0,
) {
  const x = (clientX / size.width) * 2 - 1;
  const y = -(clientY / size.height) * 2 + 1;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ);
  const hit = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, hit);
  return hit;
}

export function worldToClient(
  v: THREE.Vector3,
  camera: THREE.Camera,
  size: { width: number; height: number },
) {
  const projected = v.clone().project(camera);
  const x = (projected.x * 0.5 + 0.5) * size.width;
  const y = (-projected.y * 0.5 + 0.5) * size.height;
  return { x, y };
}
