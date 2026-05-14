export function normalizeIdKey(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

export function getAnimalIdentityKeys(animal) {
  return {
    id: normalizeIdKey(animal?.id),
    cloud: normalizeIdKey(animal?.cloud_id),
    local: normalizeIdKey(animal?.metadata?.local_id),
  };
}

export function resolveAnimalFromMap({ map, animalId, cloudAnimalId, localAnimalId }) {
  if (!(map instanceof Map)) return null;
  const idKey = normalizeIdKey(animalId);
  const cloudKey = normalizeIdKey(cloudAnimalId);
  const localKey = normalizeIdKey(localAnimalId);

  return (
    (idKey ? map.get(`id:${idKey}`) : null)
    || (cloudKey ? map.get(`cloud:${cloudKey}`) : null)
    || (localKey ? map.get(`local:${localKey}`) : null)
    || null
  );
}
